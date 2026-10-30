import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIgdbClient, normalizeGame } from './igdb.mjs';
import { createPocServer } from './http.mjs';

const payload = {
  id: 42, name: 'Shinobi III', summary: 'Description', cover: { image_id: 'co_test' }, first_release_date: 736300800,
  platforms: [{ id: 29, name: 'Sega Mega Drive/Genesis' }], genres: [{ name: 'Platform' }],
  involved_companies: [{ publisher: true, company: { name: 'Sega' } }, { developer: true, company: { name: 'Développeur' } }],
  age_ratings: [
    { organization: { name: 'ESRB' }, rating_category: { rating: 'M' } },
    { organization: { name: 'PEGI' }, rating_category: { rating: '12' } },
  ],
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('la fiche distingue les éditeurs des développeurs et le PEGI des autres classifications', () => {
  const game = normalizeGame(payload);
  assert.deepEqual(game.publishers, ['Sega']);
  assert.equal(game.pegi, '12');
  assert.equal(game.coverUrl, 'https://images.igdb.com/igdb/image/upload/t_cover_big/co_test.jpg');
  assert.equal(game.platforms[0].name, 'Sega Mega Drive/Genesis');
  const empty = normalizeGame({ id: 1, name: 'Incomplet' });
  assert.equal(empty.coverUrl, ''); assert.equal(empty.pegi, ''); assert.deepEqual(empty.platforms, []);
});

test('le parcours HTTP recherche puis charge les détails sans exposer les identifiants', async (t) => {
  let authCalls = 0; const queries = [];
  const client = createIgdbClient({ clientId: 'test-client', clientSecret: 'test-secret', gapMs: 0, fetchImpl: async (url, options) => {
    if (url.includes('oauth2')) {
      authCalls++; assert.equal(options.body.get('client_secret'), 'test-secret');
      return json({ access_token: 'test-access', expires_in: 3600 });
    }
    assert.equal(options.headers.Authorization, 'Bearer test-access');
    queries.push(options.body); return json([payload]);
  } });
  const server = createPocServer(client); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/health`).then((r) => r.json()); assert.equal(health.configured, true);
  const search = await fetch(`${base}/games/search?q=${encodeURIComponent('Shinobi "III"; limit 500;')}`).then((r) => r.json());
  assert.equal(search.games[0].id, 42); assert.ok(queries[0].startsWith('search "Shinobi \\"III\\"; limit 500;";'.replaceAll('\\\\', '\\')));
  const detail = await fetch(`${base}/games/42`).then((r) => r.json()); assert.equal(detail.game.pegi, '12'); assert.deepEqual(detail.raw, payload);
  assert.equal(authCalls, 1);
  assert.ok(queries[1].includes('age_ratings.organization.name'));
  assert.ok(!JSON.stringify({ health, search, detail }).includes('test-secret'));
  assert.ok(!JSON.stringify({ health, search, detail }).includes('test-access'));
  assert.equal((await fetch(`${base}/games/search?q=x`)).status, 400);
  assert.equal((await fetch(`${base}/games/not-an-id`)).status, 400);
  assert.equal((await fetch(`${base}/health`, { method: 'POST' })).status, 405);
});

test('sans configuration, le serveur reste joignable et explique les identifiants manquants', async () => {
  const client = createIgdbClient({ fetchImpl: () => { throw new Error('Aucun appel externe attendu'); } });
  assert.equal(client.configured, false);
  await assert.rejects(client.search('Diablo'), (error) => error.status === 503 && error.message.includes('server/.env'));
});

test('un jeton expiré est renouvelé une fois et les limites fournisseur remontent proprement', async () => {
  let auth = 0; let calls = 0;
  const client = createIgdbClient({ clientId: 'test', clientSecret: 'test', gapMs: 0, fetchImpl: async (url) => {
    if (url.includes('oauth2')) { auth++; return json({ access_token: `token-${auth}`, expires_in: 3600 }); }
    calls++; return calls === 1 ? json({}, 401) : calls === 2 ? json([payload]) : json({}, 429);
  } });
  assert.equal((await client.search('Shinobi')).games.length, 1); assert.equal(auth, 2);
  await assert.rejects(client.search('Diablo'), (error) => error.status === 429);
});
