import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { ApiError, createIgdbClient } from './igdb.mjs';

export function readServerSettings({ envPath = new URL('./.env', import.meta.url), env = process.env } = {}) {
  let values = {};
  try { values = parseEnv(readFileSync(envPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new ApiError(503, 'Le serveur ne peut pas lire server/.env. Vérifie les droits de ce fichier sur l’ordinateur.');
  }
  const value = (key) => Object.hasOwn(values, key) ? values[key] : env[key];
  return { clientId: value('IGDB_CLIENT_ID'), clientSecret: value('IGDB_CLIENT_SECRET'), scanDexToken: value('SCANDEX_TOKEN') };
}

export function createConfiguredClient({ envPath = new URL('./.env', import.meta.url), env = process.env, clientFactory = createIgdbClient } = {}) {
  let active;
  let previous;
  function current() {
    const { clientId, clientSecret } = readServerSettings({ envPath, env });
    const options = { clientId, clientSecret };
    if (!active || options.clientId !== previous.clientId || options.clientSecret !== previous.clientSecret) {
      active = clientFactory(options); previous = options;
    }
    return active;
  }
  return {
    get configured() { return current().configured; },
    search(value) { return current().search(value); },
    detail(value) { return current().detail(value); },
  };
}
