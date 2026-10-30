import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupBarcodeWithFallback } from './api.ts';

const SERVER = 'http://127.0.0.1:3001';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const scandexMatch = { id: 123, igdb_metadata: { name: 'Shinobi III', platform: { name: 'Nintendo 3DS' } } };
const upcMatch = { code: 'OK', total: 1, items: [{ title: 'Diablo III pour PC', images: ['http://example.test/diablo.jpg'], brand: 'BLIZZARD' }] };

test('un titre trouvé dans ScanDex est prioritaire et ne déclenche aucune requête UPCitemdb', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url); assert.ok(url.startsWith(SERVER + '/barcodes/scandex?')); assert.equal(options.headers.Authorization, undefined);
    return json(scandexMatch);
  });
  const result = await lookupBarcodeWithFallback('4974365611361', SERVER);
  assert.equal(result.provider, 'scandex'); assert.equal(result.result.candidates[0].name, 'Shinobi III');
  assert.equal(calls.length, 1); assert.deepEqual(result.attempts.map((attempt) => attempt.status), ['match']);
  assert.deepEqual(result.attempts[0].raw, scandexMatch);
});

test('un code absent de ScanDex est recherché ensuite dans UPCitemdb avec le même numéro', async (t) => {
  const calls = []; const progress = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url); assert.ok(url.includes('5030917102608'));
    return calls.length === 1 ? json({ message: 'Absent' }, 404) : json(upcMatch);
  });
  const result = await lookupBarcodeWithFallback('5030917102608', SERVER, (provider) => progress.push(provider));
  assert.ok(calls[0].includes('scandex')); assert.ok(calls[1].includes('upcitemdb'));
  assert.equal(result.provider, 'upcitemdb'); assert.equal(result.result.candidates[0].imageUrls[0], 'http://example.test/diablo.jpg');
  assert.deepEqual(progress, ['scandex', 'upcitemdb']); assert.deepEqual(result.attempts.map((attempt) => attempt.status), ['missing', 'match']);
});

test('un code connu sans jeu ScanDex et absent de UPCitemdb aboutit à la saisie manuelle', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1
    ? json({ igdb_metadata: null, status: 'unmatched' }) : json({ code: 'OK', total: 0, items: [] }));
  const result = await lookupBarcodeWithFallback('3348542180352', SERVER);
  assert.equal(calls, 2); assert.equal(result.provider, null); assert.equal(result.result.status, 'missing');
  assert.deepEqual(result.result.candidates, []); assert.deepEqual(result.attempts.map((attempt) => attempt.status), ['unmatched', 'missing']);
});

test('une limite ScanDex laisse UPCitemdb répondre tout en conservant la cause du passage au suivant', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? json({}, 429) : json(upcMatch));
  const result = await lookupBarcodeWithFallback('5030917102608', SERVER);
  assert.equal(result.provider, 'upcitemdb'); assert.equal(result.attempts[0].status, 'error');
  assert.ok(result.attempts[0].message.includes('limite')); assert.equal(result.attempts[1].status, 'match');
});

test('un jeton non configuré sur le serveur permet de poursuivre avec UPCitemdb', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    return url.includes('/barcodes/scandex')
      ? json({ code: 'SCANDEX_NOT_CONFIGURED', message: 'Renseigne SCANDEX_TOKEN dans server/.env.' }, 503)
      : json(upcMatch);
  });
  const result = await lookupBarcodeWithFallback('5030917102608', SERVER);
  assert.equal(calls.filter((url) => url.includes('upcitemdb')).length, 1);
  assert.equal(result.provider, 'upcitemdb'); assert.deepEqual(result.attempts.map((attempt) => attempt.status), ['skipped', 'match']);
});

test('deux services indisponibles ne sont pas présentés comme deux codes absents', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network request failed'); });
  const result = await lookupBarcodeWithFallback('3348542180352', SERVER);
  assert.equal(result.provider, null); assert.deepEqual(result.result.candidates, []);
  assert.deepEqual(result.attempts.map((attempt) => attempt.status), ['error', 'error']);
});
