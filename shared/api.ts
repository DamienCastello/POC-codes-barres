export type Provider = 'scandex' | 'upcitemdb';
export type PocMode = Provider | 'final';
export type ProviderCandidate = { name: string; platform: string; brand: string; description: string; imageUrls: string[]; ean: string };
export type ProviderResult = { status: 'match' | 'missing' | 'unmatched'; candidates: ProviderCandidate[]; raw: unknown };
export type LookupAttempt = { provider: Provider; status: ProviderResult['status'] | 'error' | 'skipped'; raw?: unknown; message?: string };
export type CombinedLookup = { result: ProviderResult; provider: Provider | null; attempts: LookupAttempt[] };
export type IgdbGame = {
  id: number; name: string; description: string; coverUrl: string; firstReleaseDate: string;
  platforms: { id: number; name: string }[]; genres: string[]; publishers: string[]; pegi: string; url: string;
};
export class IgdbConnectionError extends Error {}
export class ScanDexConfigurationError extends Error {}
type Product = { title?: string; brand?: string; description?: string; images?: string[]; ean?: string };

export async function fetchJson(url: string, headers?: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal });
    const body = await response.json().catch(() => null);
    return { response, body };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('La recherche a dépassé 25 secondes. Réessaie.');
    throw new Error(`Connexion impossible à ${new URL(url).hostname}. Vérifie le réseau du téléphone.`);
  } finally { clearTimeout(timeout); }
}

export async function lookupBarcode(provider: Provider, code: string, server: string): Promise<ProviderResult> {
  const scandex = provider === 'scandex';
  const { response, body } = scandex
    ? await localJson(server, `/barcodes/scandex?value=${encodeURIComponent(code)}`)
    : await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`);
  if (scandex && body?.code === 'SCANDEX_NOT_CONFIGURED') throw new ScanDexConfigurationError(body.message ?? 'Renseigne SCANDEX_TOKEN dans server/.env.');
  if (response.status === 404 || body?.code === 'NOT_FOUND') return { status: 'missing', candidates: [], raw: body };
  if (response.status === 401 || response.status === 403) throw new Error(scandex
    ? 'Accès refusé. Vérifie SCANDEX_TOKEN dans server/.env.' : 'Accès refusé par UPCitemdb. Tu peux poursuivre par titre dans IGDB.');
  if (response.status === 429) throw new Error(body?.code === 'TOO_FAST'
    ? 'Recherches trop rapprochées. Attends quelques secondes avant de réessayer.'
    : 'Le fournisseur limite temporairement les recherches. Tu peux poursuivre en saisissant le titre du jeu.');
  if (!response.ok) throw new Error(scandex && typeof body?.message === 'string' ? body.message : `Le fournisseur a répondu avec le code HTTP ${response.status}.`);
  if (!body || typeof body !== 'object') throw new Error('Le fournisseur a renvoyé une réponse illisible.');
  if (scandex) {
    const game = body.igdb_metadata;
    if (typeof game?.name !== 'string' || !game.name.trim()) return { status: 'unmatched', candidates: [], raw: body };
    return { status: 'match', raw: body, candidates: [{ name: game.name, platform: game.platform?.name ?? '', brand: '', description: '', imageUrls: [], ean: code }] };
  }
  const candidates = (Array.isArray(body.items) ? body.items as Product[] : [])
    .filter((product) => typeof product.title === 'string' && product.title.trim())
    .map((product) => ({ name: product.title ?? '', platform: '', brand: product.brand ?? '', description: product.description ?? '',
      imageUrls: Array.isArray(product.images) ? product.images.filter((url): url is string => typeof url === 'string') : [], ean: product.ean ?? code }));
  return { status: candidates.length ? 'match' : 'missing', candidates, raw: body };
}

export async function lookupBarcodeWithFallback(code: string, server: string, onProvider?: (provider: Provider) => void): Promise<CombinedLookup> {
  const attempts: LookupAttempt[] = [];
  for (const provider of ['scandex', 'upcitemdb'] as const) {
    onProvider?.(provider);
    try {
      const result = await lookupBarcode(provider, code, server);
      attempts.push({ provider, status: result.status, raw: result.raw });
      if (result.status === 'match') return { result, provider, attempts };
    } catch (error) {
      attempts.push({ provider, status: error instanceof ScanDexConfigurationError ? 'skipped' : 'error', message: error instanceof Error ? error.message : 'Le fournisseur est indisponible.' });
    }
  }
  return { result: { status: 'missing', candidates: [], raw: null }, provider: null, attempts };
}

export function apiBaseUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error();
    return url.origin;
  } catch { throw new Error('Indique une adresse comme http://192.168.1.20:3001, sans chemin ni identifiants.'); }
}

export function serverFromScriptUrl(script?: string) {
  try {
    if (!script) return '';
    const url = new URL(script);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return `http://${url.hostname}:3001`;
  } catch { return ''; }
}

async function localJson(server: string, path: string) {
  const base = apiBaseUrl(server);
  try { return await fetchJson(`${base}${path}`); }
  catch {
    throw new IgdbConnectionError(`Serveur du POC injoignable à ${base}. Lance « npm run start:igdb » sur l’ordinateur, puis vérifie l’adresse et le Wi-Fi du téléphone.`);
  }
}

export async function checkIgdbServer(server: string, requireCredentials = false): Promise<{ configured: boolean; scandexConfigured: boolean }> {
  const { response, body } = await localJson(server, '/health');
  if (!response.ok || body?.service !== 'OwlGame POC IGDB') throw new IgdbConnectionError('Cette adresse ne correspond pas au serveur IGDB du POC. Utilise l’adresse affichée par « npm run start:igdb ».');
  if (requireCredentials && !body.configured) throw new IgdbConnectionError('Le serveur est joignable, mais IGDB n’est pas configuré. Renseigne IGDB_CLIENT_ID et IGDB_CLIENT_SECRET dans server/.env sur l’ordinateur, puis relance la recherche.');
  return { configured: Boolean(body.configured), scandexConfigured: Boolean(body.scandexConfigured) };
}

export async function searchGames(server: string, query: string): Promise<{ games: IgdbGame[]; raw: unknown }> {
  await checkIgdbServer(server, true);
  const { response, body } = await localJson(server, `/games/search?q=${encodeURIComponent(query.trim())}`);
  if (!response.ok) throw new Error(body?.message ?? `Le serveur IGDB a répondu HTTP ${response.status}.`);
  if (!Array.isArray(body?.games)) throw new Error('Le serveur IGDB a renvoyé une réponse inattendue.');
  return body;
}

export async function getGame(server: string, id: number): Promise<{ game: IgdbGame; raw: unknown }> {
  const { response, body } = await localJson(server, `/games/${id}`);
  if (!response.ok) throw new Error(body?.message ?? `Le serveur IGDB a répondu HTTP ${response.status}.`);
  if (!body?.game?.id) throw new Error('La fiche IGDB reçue est incomplète.');
  return body;
}
