import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IgdbConnectionError, lookupBarcode, searchGames, serverFromScriptUrl } from './api.ts';
import { toDraft, validateDraft } from './draft.ts';

test('la plateforme possédée reste à choisir, même si une seule plateforme est renvoyée', () => {
  const draft = toDraft({ id: 42, name: 'Shinobi III', description: '', coverUrl: '', genres: [], publishers: [], firstReleaseDate: '', pegi: '', platforms: [{ id: 37, name: 'Nintendo 3DS' }] });
  assert.equal(draft.platform, ''); assert.ok(validateDraft(draft).includes('plateforme'));
  draft.platform = 'Mega Drive'; assert.equal(validateDraft(draft), '');
  draft.firstReleaseDate = '2026-02-30'; assert.ok(validateDraft(draft).includes('date valide'));
  draft.firstReleaseDate = ''; draft.pegi = 'M'; assert.ok(validateDraft(draft).includes('PEGI'));
});

test('les réponses brutes, dont les URL HTTP et champs non affichés, sont conservées dans le résultat source', async (t) => {
  const raw = { code: 'OK', total: 1, items: [{ title: 'Diablo III', brand: 'BLIZZARD', ean: '5030917102608', images: ['http://example.test/diablo.jpg'], offers: [{ merchant: 'Exemple' }] }] };
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(raw), { status: 200 }));
  const result = await lookupBarcode('upcitemdb', '5030917102608', '');
  assert.deepEqual(result.raw, raw); assert.equal(result.candidates[0].imageUrls[0], raw.items[0].images[0]);
  assert.equal(result.candidates[0].platform, ''); assert.equal(result.candidates[0].brand, 'BLIZZARD');
});

test('un code absent permet de poursuivre manuellement et une limite de quota a un message spécifique', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ total: 0, items: [] }), { status: 200 }));
  assert.equal((await lookupBarcode('upcitemdb', '3348542180352', '')).status, 'missing');
  mock.mock.mockImplementation(async () => new Response(JSON.stringify({ code: 'TOO_FAST' }), { status: 429 }));
  await assert.rejects(lookupBarcode('upcitemdb', '3348542180352', ''), /rapprochées/);
});

test('une panne locale indique l’adresse du serveur et la commande à lancer', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network request failed'); });
  await assert.rejects(searchGames('http://192.168.0.25:3001', 'Shinobi'), (error) =>
    error instanceof IgdbConnectionError && error.message.includes('192.168.0.25:3001') && error.message.includes('npm run start:igdb'));
});

test('les accès manquants sont distingués d’une panne réseau avant de chercher un jeu', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls++; assert.ok(url.endsWith('/health'));
    return new Response(JSON.stringify({ service: 'OwlGame POC IGDB', configured: false }), { status: 200 });
  });
  await assert.rejects(searchGames('http://192.168.0.25:3001', 'Shinobi'), /serveur est joignable.*IGDB n’est pas configuré/);
  assert.equal(calls, 1);
});

test('l’adresse est déduite d’Expo sans inventer une IP si elle manque', () => {
  assert.equal(serverFromScriptUrl('http://192.168.0.25:8081/index.bundle?platform=android'), 'http://192.168.0.25:3001');
  assert.equal(serverFromScriptUrl(undefined), '');
  assert.equal(serverFromScriptUrl('file:///app/main.jsbundle'), '');
});
