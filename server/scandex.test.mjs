import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createScanDexClient } from './scandex.mjs';
import { createPocServer } from './http.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('le serveur envoie le jeton uniquement à ScanDex et relit sa valeur à chaque recherche', async (t) => {
  let token = 'private-test-token'; const headers = [];
  const raw = { id: 123, igdb_metadata: { name: 'Shinobi III', platform: { name: 'Nintendo 3DS' } } };
  const scandex = createScanDexClient({ getToken: () => token, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://scandex.gamery.app/api/v2/lookup?value=4974365611361');
    headers.push(options.headers.Authorization); return json(raw);
  } });
  const server = createPocServer({ configured: false }, scandex);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/health`).then((r) => r.json()); assert.equal(health.scandexConfigured, true);
  const first = await fetch(`${base}/barcodes/scandex?value=4974365611361`).then((r) => r.json());
  assert.deepEqual(first, raw); token = 'replacement-test-token';
  const second = await fetch(`${base}/barcodes/scandex?value=4974365611361`).then((r) => r.json());
  assert.deepEqual(headers, ['private-test-token', 'replacement-test-token']);
  const returned = JSON.stringify({ health, first, second });
  assert.ok(!returned.includes('private-test-token')); assert.ok(!returned.includes('replacement-test-token'));
});

test('sans jeton ou avec un code invalide, le serveur ne consomme aucune requête ScanDex', async () => {
  let calls = 0;
  const scandex = createScanDexClient({ getToken: () => '', fetchImpl: async () => { calls++; } });
  assert.equal(scandex.configured, false);
  await assert.rejects(scandex.lookup('4974365611361'), (error) => error.status === 503 && error.code === 'SCANDEX_NOT_CONFIGURED');
  await assert.rejects(scandex.lookup('abc'), (error) => error.status === 400);
  assert.equal(calls, 0);
});

test('un refus ScanDex ne transmet pas au téléphone le corps d’erreur susceptible de contenir le jeton', async () => {
  const scandex = createScanDexClient({ getToken: () => 'private-test-token', fetchImpl: async () => json({ message: 'private-test-token' }, 401) });
  await assert.rejects(scandex.lookup('4974365611361'), (error) => {
    assert.equal(error.status, 502); assert.ok(error.message.includes('server/.env'));
    assert.ok(!error.message.includes('private-test-token')); return true;
  });
});
