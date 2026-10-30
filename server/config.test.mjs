import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createConfiguredClient, readServerSettings } from './config.mjs';

test('les accès ajoutés dans .env sont pris en compte sans redémarrer le serveur', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'owlgame-igdb-config-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const file = join(directory, '.env'); let creations = 0;
  const client = createConfiguredClient({ envPath: file, env: {}, clientFactory: ({ clientId, clientSecret }) => {
    creations++;
    return { configured: Boolean(clientId && clientSecret), search: () => 'ok', detail: () => 'ok' };
  } });
  assert.equal(client.configured, false);
  writeFileSync(file, 'IGDB_CLIENT_ID=test-id\nIGDB_CLIENT_SECRET=test-secret\n');
  assert.equal(client.configured, true); assert.equal(client.search('Shinobi'), 'ok'); assert.equal(creations, 2);
  writeFileSync(file, 'IGDB_CLIENT_ID=\nIGDB_CLIENT_SECRET=\n');
  assert.equal(client.configured, false);
});

test('SCANDEX_TOKEN est relu depuis le fichier local sans exposer les autres accès', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'owlgame-scandex-config-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const file = join(directory, '.env');
  writeFileSync(file, 'SCANDEX_TOKEN=first-test-token\n');
  assert.equal(readServerSettings({ envPath: file, env: {} }).scanDexToken, 'first-test-token');
  writeFileSync(file, 'SCANDEX_TOKEN=second-test-token\n');
  assert.equal(readServerSettings({ envPath: file, env: {} }).scanDexToken, 'second-test-token');
});
