import { networkInterfaces } from 'node:os';
import { createConfiguredClient, readServerSettings } from './config.mjs';
import { createPocServer } from './http.mjs';
import { createScanDexClient } from './scandex.mjs';

const port = Number(process.env.IGDB_PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('IGDB_PORT doit être un port valide.');
const client = createConfiguredClient();
const scandex = createScanDexClient({ getToken: () => readServerSettings().scanDexToken });
const server = createPocServer(client, scandex);
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Le port ${port} est déjà utilisé. Ferme l’ancien serveur ou change IGDB_PORT.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '0.0.0.0', () => {
  console.log(`Serveur du POC (IGDB + ScanDex) : http://localhost:${port}`);
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    if (/^(docker|br-|veth|virbr)/.test(name)) continue;
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) console.log(`Adresse pour le téléphone (${name}) : http://${entry.address}:${port}`);
    }
  }
  if (!client.configured) console.log('À configurer : renseigne tes identifiants Twitch dans server/.env. Ils seront pris en compte à la prochaine recherche, sans redémarrage.');
  if (!scandex.configured) console.log('À configurer : renseigne SCANDEX_TOKEN dans server/.env. Le jeton reste sur le serveur et est relu à chaque recherche.');
});
