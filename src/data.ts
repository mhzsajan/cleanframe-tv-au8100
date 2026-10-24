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
