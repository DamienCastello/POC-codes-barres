import { createServer } from 'node:http';
import { ApiError } from './igdb.mjs';

export function createPocServer(client, scandex) {
  return createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    const send = (status, body) => { response.writeHead(status); response.end(JSON.stringify(body)); };
    try {
      if (request.method !== 'GET') return send(405, { message: 'Utilise une requête GET.' });
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/health') return send(200, { service: 'OwlGame POC IGDB', configured: client.configured, scandexConfigured: scandex?.configured ?? false });
      if (url.pathname === '/barcodes/scandex') {
        if (!scandex) throw new ApiError(503, 'ScanDex n’est pas configuré sur ce serveur.', 'SCANDEX_NOT_CONFIGURED');
        const result = await scandex.lookup(url.searchParams.get('value'));
        return send(result.status, result.body);
      }
      if (url.pathname === '/games/search') return send(200, await client.search(url.searchParams.get('q')));
      const match = url.pathname.match(/^\/games\/([^/]+)$/);
      if (match) return send(200, await client.detail(match[1]));
      send(404, { message: 'Adresse inconnue sur le serveur du POC.' });
    } catch (error) {
      const timedOut = ['TimeoutError', 'AbortError'].includes(error.name);
      send(error instanceof ApiError ? error.status : timedOut ? 504 : 502, {
        ...(error instanceof ApiError && error.code ? { code: error.code } : {}),
        message: error instanceof ApiError ? error.message : timedOut
          ? 'Le service externe met trop de temps à répondre. Réessaie.'
          : 'Le serveur ne parvient pas à joindre Twitch ou IGDB. Vérifie sa connexion Internet.',
      });
    }
  });
}
