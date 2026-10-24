/** Persisted preferences. */

export interface Prefs {
  wall: string;
  clock24: boolean;
  home: string[];
}

const KEY = 'cleanframe.v2';
const MAX_HOME = 9;

export { MAX_HOME };

const DEFAULTS: Prefs = { wall: 'misty', clock24: false, home: [] };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      wall: typeof parsed.wall === 'string' ? parsed.wall : DEFAULTS.wall,
      clock24: parsed.clock24 === true,
      home: Array.isArray(parsed.home) ? parsed.home.filter((id) => typeof id === 'string').slice(0, MAX_HOME) : [],
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* Private mode or quota; the session still works. */
  }
}
