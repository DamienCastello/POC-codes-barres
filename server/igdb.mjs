import { setTimeout as delay } from 'node:timers/promises';

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function normalizeGame(game) {
  const names = (items = []) => [...new Set(items.map((item) => item.name).filter(Boolean))];
  const pegi = (game.age_ratings ?? [])
    .filter((item) => item.organization?.name?.toUpperCase().includes('PEGI'))
    .map((item) => String(item.rating_category?.rating ?? '').match(/\b(3|7|12|16|18)\b/)?.[1])
    .filter(Boolean);
  const imageId = game.cover?.image_id;
  return {
    id: game.id,
    name: game.name ?? '',
    description: game.summary ?? '',
    coverUrl: typeof imageId === 'string' && /^[\w-]+$/.test(imageId)
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg` : '',
    firstReleaseDate: Number.isFinite(game.first_release_date)
      ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10) : '',
    platforms: (game.platforms ?? []).map(({ id, name }) => ({ id, name })),
    genres: names(game.genres),
    publishers: names((game.involved_companies ?? []).filter((item) => item.publisher).map((item) => item.company).filter(Boolean)),
    pegi: [...new Set(pegi)].join(', '),
    url: game.url ?? 'https://www.igdb.com',
  };
}

export function createIgdbClient({ clientId, clientSecret, fetchImpl = fetch, gapMs = 300 }) {
  let token;
  let expiresAt = 0;
  let tokenRequest;
  let queue = Promise.resolve();
  let lastStart = 0;
  const configured = Boolean(clientId?.trim() && clientSecret?.trim());

  async function accessToken() {
    if (!configured) throw new ApiError(503, 'Renseigne IGDB_CLIENT_ID et IGDB_CLIENT_SECRET dans server/.env, puis relance la recherche.');
    if (token && Date.now() < expiresAt) return token;
    if (!tokenRequest) {
      tokenRequest = (async () => {
        const response = await fetchImpl('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new ApiError(502, 'Twitch refuse les identifiants IGDB. Vérifie le Client ID et le Client Secret du serveur.');
        const body = await response.json();
        if (!body.access_token || !Number.isFinite(body.expires_in) || body.expires_in <= 0) {
          throw new ApiError(502, 'La réponse d’authentification Twitch est incomplète.');
        }
        token = body.access_token;
        expiresAt = Date.now() + Math.max(0, body.expires_in - 60) * 1000;
        return token;
      })().finally(() => { tokenRequest = undefined; });
    }
    return tokenRequest;
  }

  function request(query) {
    const operation = queue.then(async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const bearer = await accessToken();
        await delay(Math.max(0, gapMs - (Date.now() - lastStart)));
        lastStart = Date.now();
        const response = await fetchImpl('https://api.igdb.com/v4/games', {
          method: 'POST',
          headers: { 'Client-ID': clientId, Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
          body: query,
          signal: AbortSignal.timeout(12000),
        });
        if (response.status === 401 && attempt === 0) { token = undefined; continue; }
        if (response.status === 429) throw new ApiError(429, 'IGDB limite temporairement les requêtes. Patiente quelques secondes avant de réessayer.');
        if (!response.ok) throw new ApiError(502, `La recherche IGDB a échoué (HTTP ${response.status}).`);
        const body = await response.json();
        if (!Array.isArray(body)) throw new ApiError(502, 'La réponse IGDB est inattendue.');
        return body;
      }
    });
    queue = operation.catch(() => {});
    return operation;
  }

  return {
    configured,
    async search(value) {
      const query = value?.trim();
      if (!query || query.length < 2 || query.length > 120 || /[\u0000-\u001f]/.test(query)) {
        throw new ApiError(400, 'Saisis un titre de 2 à 120 caractères.');
      }
      const raw = await request(`search ${JSON.stringify(query)}; fields name,cover.image_id,first_release_date,platforms.name; limit 12;`);
      return { games: raw.map(normalizeGame), raw };
    },
    async detail(value) {
      if (!/^[1-9]\d{0,9}$/.test(String(value))) throw new ApiError(400, 'L’identifiant du jeu est invalide.');
      const raw = await request(`fields name,summary,cover.image_id,first_release_date,platforms.name,genres.name,involved_companies.publisher,involved_companies.company.name,age_ratings.organization.name,age_ratings.rating_category.rating,url; where id = ${value}; limit 1;`);
      if (!raw.length) throw new ApiError(404, 'Cette fiche n’est plus disponible dans IGDB.');
      return { game: normalizeGame(raw[0]), raw: raw[0] };
    },
  };
}
