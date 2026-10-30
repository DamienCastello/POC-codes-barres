import type { IgdbGame } from './api';

export type Draft = { name: string; description: string; coverUrl: string; genres: string; publishers: string; firstReleaseDate: string; pegi: string; platform: string };
export const LABELS: Record<Exclude<keyof Draft, 'platform'>, string> = {
  name: 'Nom du jeu', description: 'Description', coverUrl: 'URL de la jaquette', genres: 'Genres',
  publishers: 'Éditeurs', firstReleaseDate: 'Première sortie (AAAA-MM-JJ)', pegi: 'PEGI (3, 7, 12, 16 ou 18)',
};

export function toDraft(game: IgdbGame): Draft {
  return { name: game.name, description: game.description, coverUrl: game.coverUrl, genres: game.genres.join(', '),
    publishers: game.publishers.join(', '), firstReleaseDate: game.firstReleaseDate, pegi: game.pegi, platform: '' };
}

export function validateDraft(draft: Draft) {
  if (!draft.name.trim() || !draft.platform.trim()) return 'Confirme au minimum le nom du jeu et la plateforme de ta boîte.';
  if (draft.firstReleaseDate && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.firstReleaseDate)
    || Number.isNaN(Date.parse(draft.firstReleaseDate)) || new Date(draft.firstReleaseDate).toISOString().slice(0, 10) !== draft.firstReleaseDate)) {
    return 'La première sortie doit être une date valide au format AAAA-MM-JJ, ou rester vide.';
  }
  if (draft.pegi && !/^(3|7|12|16|18)$/.test(draft.pegi.trim())) return 'Choisis un seul PEGI parmi 3, 7, 12, 16 ou 18, ou laisse le champ vide.';
  if (draft.coverUrl) {
    try { if (new URL(draft.coverUrl).protocol !== 'https:') throw new Error(); }
    catch { return 'La jaquette doit avoir une URL HTTPS valide, ou le champ doit rester vide.'; }
  }
  return '';
}
