/** Brand colours and the bundled photograph catalogue. */

export interface Wallpaper {
  id: string;
  name: string;
  tone?: 'light' | 'dark';
}

interface CatalogueEntry {
  id: string;
  name: string;
  tone?: 'light' | 'dark';
}

declare global {
  interface Window {
    CleanFrameWallpapers?: CatalogueEntry[];
  }
}

/** Marks ship as single-colour masks, so the colour lives here. */
export const BRAND_COLOR: Record<string, string> = {
  netflix: '#E50914',
  youtube: '#FF1A1A',
  primevideo: '#00A8E1',
  spotify: '#1ED760',
  jellyfin: '#00A4DC',
  disneyplus: '#2D6BFF',
  stremio: '#8B5CF6',
  appletv: '#FFFFFF',
  abciview: '#F5C518',
  sbs: '#FF7A00',
  applemusic: '#FA243C',
};

export const INK = '#FFFFFF';

/**
 * Rendered size per mark, in px, computed from each SVG's measured ink box so
 * every logo carries the same visual weight. Without this a wide wordmark like
 * Prime Video renders a fraction of the size of a square mark like Jellyfin.
 * Values are for the 112px chip; scale them for other contexts.
 */
export const MARK_BOX: Record<string, number> = {
  abciview: 99,
  applemusic: 84,
  appletv: 96,
  disneyplus: 90,
  jellyfin: 88,
  netflix: 96,
  primevideo: 100,
  sbs: 88,
  spotify: 72,
  stremio: 72,
  youtube: 85,
};

export const DEFAULT_MARK = 88;

export function markSize(brand: string, scale = 1): number {
  return Math.round((MARK_BOX[brand] ?? DEFAULT_MARK) * scale);
}

export function colorFor(brand: string): string {
  return BRAND_COLOR[brand] ?? INK;
}

export function wallpaperList(): Wallpaper[] {
  const raw = window.CleanFrameWallpapers ?? [];
  return raw.map((w) => ({ id: w.id, name: w.name, tone: w.tone ?? 'dark' }));
}

export function wallpaper(id: string, list: Wallpaper[]): Wallpaper {
  return list.find((w) => w.id === id) ?? list[0] ?? { id: 'misty', name: 'Misty coast', tone: 'light' };
}

export const wallSrc = (id: string): string => `./assets/wallpapers/${id}.jpg`;
export const wallThumb = (id: string): string => `./assets/wallpapers/${id}-thumb.jpg`;
export const markSrc = (brand: string): string => `./assets/icons/${brand}.svg`;
