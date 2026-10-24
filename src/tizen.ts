/** Typed access to the TV. This is the only module that talks to Tizen. */

export interface TvApp {
  appId: string;
  name: string;
  /** Brand key used to pick a bundled mark and colour; empty when unknown. */
  brand: BrandKey | '';
}

export type BrandKey =
  | 'stremio' | 'jellyfin' | 'spotify' | 'netflix' | 'youtube' | 'primevideo'
  | 'disneyplus' | 'appletv' | 'abciview' | 'sbs' | 'applemusic';

/** App IDs known well enough to get a proper mark. */
const KNOWN: Record<string, BrandKey> = {
  'IkWsFHtOY9.Stremio': 'stremio',
  'AprZAARz4r.Jellyfin': 'jellyfin',
  'rJeHak5zRg.Spotify': 'spotify',
  'org.tizen.netflix-app': 'netflix',
  '9Ur5IzDKqV.TizenYouTube': 'youtube',
  'org.tizen.primevideo': 'primevideo',
  'MCmYXNxgcu.DisneyPlus': 'disneyplus',
  'com.samsung.tv.aria-video': 'appletv',
  'mWK87Xghap.ABCiview': 'abciview',
  'OyE7OuxlUi.SBSOnDemand': 'sbs',
  'org.tizen.apple.apple-music': 'applemusic',
};

/** Services and frameworks that must never appear on a home screen. */
const INTERNAL = new Set([
  'adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', 'com.samsung.tv.csfs',
  'com.samsung.tv.coba.setting', 'org.tizen.browser', 'com.samsung.tv.cobalt-yt',
]);

const SERVICE_NAME = /service|worker|preview|promotion|plugin|launcher|test|sdk|daemon|factory|dummy/i;
const CONSUMER_ID = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/;

interface TizenAppInfo {
  id: string;
  name?: string;
  show?: boolean;
}

interface TizenApplication {
  getAppsInfo(ok: (apps: TizenAppInfo[]) => void, fail: (err: unknown) => void): void;
  launch(id: string, ok: () => void, fail: (err: unknown) => void): void;
}

declare global {
  interface Window {
    tizen?: { application?: TizenApplication };
  }
}

function application(): TizenApplication | undefined {
  return window.tizen?.application;
}

/** Installed, launchable apps, filtered and mapped to bundled brands. */
export function listApps(): Promise<TvApp[]> {
  const api = application();
  if (!api) return Promise.resolve([]);

  return new Promise((resolve, reject) => {
    api.getAppsInfo(
      (list) => {
        const seen = new Set<string>();
        const apps: TvApp[] = [];
        for (const item of list) {
          const id = item.id;
          if (!id || !item.name || seen.has(id)) continue;
          if (INTERNAL.has(id) || SERVICE_NAME.test(`${item.name} ${id}`)) continue;
          const brand = KNOWN[id];
          if (!brand && !CONSUMER_ID.test(id)) continue;
          seen.add(id);
          apps.push({ appId: id, name: item.name.slice(0, 60), brand: brand ?? '' });
        }
        apps.sort((a, b) => a.name.localeCompare(b.name));
        resolve(apps);
      },
      reject,
    );
  });
}

export function launchApp(appId: string): Promise<void> {
  const api = application();
  if (!api) return Promise.reject(new Error('Not running on a TV.'));
  return new Promise((resolve, reject) => {
    api.launch(appId, resolve, reject);
  });
}

export function openAmbient(): Promise<void> {
  return launchApp('org.tizen.ambientapp');
}
