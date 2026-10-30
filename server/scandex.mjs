import { ApiError } from './igdb.mjs';

export function createScanDexClient({ getToken, fetchImpl = fetch }) {
  return {
    get configured() { return Boolean(getToken()?.trim()); },
    async lookup(value) {
      if (typeof value !== 'string' || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) {
        throw new ApiError(400, 'Saisis un code EAN/UPC de 8, 12, 13 ou 14 chiffres.');
      }
      const token = getToken()?.trim();
      if (!token) throw new ApiError(503, 'Renseigne SCANDEX_TOKEN dans server/.env sur l’ordinateur.', 'SCANDEX_NOT_CONFIGURED');
      try {
        const response = await fetchImpl(`https://scandex.gamery.app/api/v2/lookup?value=${encodeURIComponent(value)}`, {
          headers: { Accept: 'application/json', Authorization: token }, signal: AbortSignal.timeout(12000),
        });
        if (response.status === 401 || response.status === 403) throw new ApiError(502, 'ScanDex refuse le jeton configuré sur le serveur. Vérifie SCANDEX_TOKEN dans server/.env.');
        if (response.status === 429) throw new ApiError(429, 'ScanDex limite temporairement les recherches. Réessaie plus tard.');
        if (!response.ok && response.status !== 404) throw new ApiError(502, `ScanDex a répondu HTTP ${response.status}.`);
        const body = await response.json();
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(502, 'ScanDex a renvoyé une réponse inattendue.');
        return { status: response.status, body };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(502, 'Le serveur ne parvient pas à joindre ScanDex ou à lire sa réponse. Réessaie.');
      }
    },
  };
}
