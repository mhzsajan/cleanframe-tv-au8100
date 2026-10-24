import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { listApps, launchApp, openAmbient, type TvApp } from './tizen';
import { colorFor, markSize, markSrc, wallSrc, wallThumb, wallpaper, wallpaperList, type Wallpaper } from './data';
import { loadPrefs, savePrefs, MAX_HOME, type Prefs } from './prefs';

type View = 'home' | 'apps' | 'walls' | 'settings' | 'diagnostics';

const CONTROL_COUNT = 3;
const APP_COLUMNS = 7;
const WALL_COLUMNS = 5;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const KEY: Record<number, string> = {
  37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'ok', 27: 'back', 8: 'back', 10009: 'back', 461: 'back',
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function seedHome(apps: TvApp[]): string[] {
  const preferred = ['stremio', 'jellyfin', 'spotify', 'netflix', 'youtube', 'primevideo', 'disneyplus', 'appletv'];
  const used = new Set<string>();
  const home: string[] = [];
  for (const brand of preferred) {
    const hit = apps.find((a) => a.brand === brand && !used.has(a.appId));
    if (hit) { home.push(hit.appId); used.add(hit.appId); }
    if (home.length >= MAX_HOME) break;
  }
  for (const app of apps) {
    if (home.length >= Math.max(6, home.length)) break;
    if (!used.has(app.appId) && home.length < 6) { home.push(app.appId); used.add(app.appId); }
  }
  return home;
}

function Mark({ brand, name, scale = 1 }: { brand: string; name: string; scale?: number }) {
  const px = markSize(brand, scale);
  if (!brand) {
    return <span class="mono" style={{ width: `${px}px`, height: `${px}px` }}>{initials(name)}</span>;
  }
  const url = `url(${markSrc(brand)})`;
  return (
    <span
      class="mark"
      style={{ width: `${px}px`, height: `${px}px`, maskImage: url, WebkitMaskImage: url }}
    />
  );
}

function Clock({ clock24, now }: { clock24: boolean; now: Date }) {
  const hours = clock24 ? now.getHours() : now.getHours() % 12 || 12;
  return (
    <header class="head">
      <div class="time">{`${clock24 ? pad(hours) : hours}:${pad(now.getMinutes())}`}</div>
      <div class="date">{`${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`}</div>
    </header>
  );
}

export function App() {
  const [walls] = useState<Wallpaper[]>(wallpaperList);
  const [apps, setApps] = useState<TvApp[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [view, setView] = useState<View>('home');
  const [sel, setSel] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState('');
  const [editHome, setEditHome] = useState(false);
  const [loadedWall, setLoadedWall] = useState('');
  const railRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);

  const activeWall = wallpaper(prefs.wall, walls);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  useEffect(() => {
    listApps()
      .then((found) => {
        setApps(found);
        setPrefs((current) => {
          if (current.home.length) return current;
          const home = seedHome(found);
          const next = { ...current, home };
          savePrefs(next);
          return next;
        });
      })
      .catch(() => setStatus('Could not read the installed app list.'));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(''), 3200);
    return () => window.clearTimeout(id);
  }, [status]);

  const byId = useMemo(() => {
    const map = new Map<string, TvApp>();
    for (const app of apps) map.set(app.appId, app);
    return map;
  }, [apps]);

  const rail = useMemo(
    () => prefs.home.map((id) => byId.get(id)).filter((a): a is TvApp => Boolean(a)),
    [prefs.home, byId],
  );

  const total = rail.length + CONTROL_COUNT;

  const fire = useCallback((run: () => Promise<unknown>, failure: string) => {
    run().catch((error: unknown) => {
      const message = error instanceof Error && error.message ? error.message : failure;
      setStatus(message === 'Not running on a TV.' ? failure : message);
    });
  }, []);

  const activateControls = useCallback((index: number) => {
    if (index === 0) fire(openAmbient, 'Ambient is not available on this TV.');
    else if (index === 1) { setView('apps'); setCursor(0); setEditHome(false); }
    else { setView('settings'); setCursor(0); }
  }, [fire]);

  const activate = useCallback(() => {
    if (view === 'home') {
      if (sel < rail.length) {
        const app = rail[sel];
        setStatus(`Opening ${app.name}...`);
        fire(() => launchApp(app.appId), `${app.name} could not be opened.`);
      } else {
        activateControls(sel - rail.length);
      }
      return;
    }
    if (view === 'apps') {
      const app = apps[cursor];
      if (!app) return;
      if (!editHome) {
        setView('home');
        setStatus(`Opening ${app.name}...`);
        fire(() => launchApp(app.appId), `${app.name} could not be opened.`);
        return;
      }
      const at = prefs.home.indexOf(app.appId);
      if (at >= 0) update({ home: prefs.home.filter((id) => id !== app.appId) });
      else if (prefs.home.length >= MAX_HOME) setStatus(`Home holds ${MAX_HOME} apps. Remove one first.`);
      else update({ home: [...prefs.home, app.appId] });
      return;
    }
    if (view === 'walls') {
      const next = walls[cursor];
      if (next) { update({ wall: next.id }); setView('home'); }
      return;
    }
    if (view === 'settings') {
      if (cursor === 0) { setView('walls'); setCursor(Math.max(0, walls.findIndex((w) => w.id === prefs.wall))); }
      else if (cursor === 1) update({ clock24: !prefs.clock24 });
      else if (cursor === 2) { setView('apps'); setCursor(0); setEditHome(true); }
      else { setView('diagnostics'); setCursor(0); }
    }
  }, [view, sel, rail, cursor, apps, walls, prefs, editHome, update, activateControls, fire]);

  const back = useCallback(() => {
    if (view === 'home') return;
    if (view === 'apps' && editHome) { setView('settings'); setCursor(0); setEditHome(false); return; }
    if (view === 'walls') { setView('settings'); setCursor(0); return; }
    setView('home');
  }, [view, editHome]);

  const columns = view === 'apps' ? APP_COLUMNS : view === 'walls' ? WALL_COLUMNS : 1;
  const overlayLength = view === 'apps' ? apps.length : view === 'walls' ? walls.length : view === 'settings' ? 4 : 6;

  const move = useCallback((dir: string) => {
    if (view === 'home') {
      if (dir === 'left') setSel((i) => Math.max(0, i - 1));
      if (dir === 'right') setSel((i) => Math.min(total - 1, i + 1));
      return;
    }
    setCursor((i) => {
      if (dir === 'left') return Math.max(0, i - 1);
      if (dir === 'right') return Math.min(overlayLength - 1, i + 1);
      if (dir === 'up') return Math.max(0, i - columns);
      if (dir === 'down') return Math.min(overlayLength - 1, i + columns);
      return i;
    });
  }, [view, total, overlayLength, columns]);

  /* Dispatch through a ref: remote key events can arrive faster than a render,
     and a listener bound to the previous render would act on stale state (OK
     after a move would fire the *old* focus target). */
  const actionRef = useRef<(action: string) => void>(() => {});
  actionRef.current = (action: string) => {
    if (action === 'ok') activate();
    else if (action === 'back') back();
    else move(action);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = KEY[event.keyCode];
      if (!action) return;
      event.preventDefault();
      actionRef.current(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* The focus name tracks the centre of the focused tile. */
  useEffect(() => {
    if (view !== 'home') return;
    const railEl = railRef.current;
    const nameEl = nameRef.current;
    if (!railEl || !nameEl) return;
    const tile = railEl.children[sel] as HTMLElement | undefined;
    if (!tile) return;
    const width = nameEl.offsetWidth;
    const x = railEl.offsetLeft + tile.offsetLeft + tile.offsetWidth / 2 - width / 2;
    nameEl.style.left = `${Math.max(40, Math.min(1880 - width, Math.round(x)))}px`;
  }, [sel, view, rail.length]);

  /* Keep the focused card inside the scrolling overlay body. */
  useEffect(() => {
    if (view === 'home') return;
    const el = document.querySelector<HTMLElement>('.overlay-body .is-focus');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [cursor, view]);

  const overlayOpen = view !== 'home';
  const tone = activeWall.tone === 'light' ? 'tone-light' : '';

  return (
    <div class={`stage ${overlayOpen ? 'is-overlay' : ''} ${tone}`}>
      <img
        class={`photo ${loadedWall === activeWall.id ? 'is-on' : ''}`}
        src={wallSrc(activeWall.id)}
        alt=""
        onLoad={() => setLoadedWall(activeWall.id)}
      />
      <div class="scrim" />

      <Clock clock24={prefs.clock24} now={now} />

      <nav class="rail" ref={railRef}>
        {rail.map((app, index) => (
          <button
            key={app.appId}
            type="button"
            class={`tile ${sel === index ? 'is-focus' : ''}`}
            style={{ color: colorFor(app.brand) }}
            onClick={() => { setSel(index); activate(); }}
          >
            <Mark brand={app.brand} name={app.name} scale={0.78} />
          </button>
        ))}
      </nav>

      <div class={`focus-name ${sel < rail.length ? 'is-on' : ''}`} ref={nameRef}>
        {sel < rail.length ? rail[sel]?.name ?? '' : ''}
      </div>

      <nav class="controls">
        {['ambient', 'apps', 'settings'].map((id, index) => (
          <button
            key={id}
            type="button"
            class={`control ${sel === rail.length + index ? 'is-focus' : ''}`}
            aria-label={id}
            onClick={() => { setSel(rail.length + index); activateControls(index); }}
          >
            <ControlIcon id={id} />
          </button>
        ))}
      </nav>

      {view === 'apps' && (
        <Overlay
          title={editHome ? 'Apps on Home' : 'All apps'}
          hint={editHome ? 'OK adds or removes. Back when done.' : 'OK opens. Back returns.'}
        >
          <div class="grid">
            {apps.map((app, index) => {
              const on = prefs.home.includes(app.appId);
              return (
                <button
                  key={app.appId}
                  type="button"
                  class={`card ${cursor === index ? 'is-focus' : ''}`}
                  style={{ color: colorFor(app.brand) }}
                  onClick={() => { setCursor(index); activate(); }}
                >
                  <span class="chip">
                    <Mark brand={app.brand} name={app.name} />
                  </span>
                  <span class="name">
                    {app.name}
                    {editHome && <span class={`dot ${on ? 'is-on' : ''}`}>{on ? '\u25CF' : '\u25CB'}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </Overlay>
      )}

      {view === 'walls' && (
        <Overlay title="Background" hint="OK applies. Back returns.">
          <div class="walls">
            {walls.map((wall, index) => (
              <button
                key={wall.id}
                type="button"
                class={`wall ${cursor === index ? 'is-focus' : ''}`}
                onClick={() => { setCursor(index); activate(); }}
              >
                <img src={wallThumb(wall.id)} alt="" />
                <span class="cap">{wall.name}</span>
              </button>
            ))}
          </div>
        </Overlay>
      )}

      {view === 'settings' && (
        <Overlay title="Settings" hint="OK changes. Back returns.">
          <div class="rows">
            {[
              ['Background', activeWall.name],
              ['Clock', prefs.clock24 ? '24-hour' : '12-hour'],
              ['Apps on Home', `${prefs.home.length} of ${MAX_HOME}`],
              ['Diagnostics', `${apps.length} apps`],
            ].map(([label, value], index) => (
              <button
                key={label}
                type="button"
                class={`row ${cursor === index ? 'is-focus' : ''}`}
                onClick={() => { setCursor(index); activate(); }}
              >
                <span class="label">{label}</span>
                <span class="value">{value}</span>
              </button>
            ))}
          </div>
        </Overlay>
      )}

      {view === 'diagnostics' && <Diagnostics now={now} count={apps.length} />}

      <div class={`status ${status ? 'is-on' : ''}`}>{status}</div>
    </div>
  );
}

function Overlay({ title, hint, children }: { title: string; hint: string; children: ComponentChildren }) {
  return (
    <section class="overlay">
      <div class="overlay-head">
        <h1 class="overlay-title">{title}</h1>
        <p class="overlay-hint">{hint}</p>
      </div>
      <div class="overlay-body">{children}</div>
    </section>
  );
}

function ControlIcon({ id }: { id: string }) {
  const paths: Record<string, string> = {
    ambient: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><circle cx="9" cy="9.8" r="1.5"/><path d="m4.6 17.6 4.4-4.4 3 3 2.6-2.6 5 5"/>',
    apps: '<rect x="4" y="4" width="6.6" height="6.6" rx="1.8"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.8"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8"/>',
    settings: '<circle cx="12" cy="12" r="3.1"/><path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6"/>',
  };
  return <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: paths[id] ?? '' }} />;
}

function Diagnostics({ now, count }: { now: Date; count: number }) {
  const engine = navigator.userAgent.replace(/^.*?\(/, '').split(')')[0];
  const manrope = typeof document.fonts?.check === 'function' && document.fonts.check('16px Manrope');
  const facts: Array<[string, string]> = [
    ['Viewport', `${window.innerWidth} x ${window.innerHeight}`],
    ['Screen', `${screen.width} x ${screen.height} @${window.devicePixelRatio}x`],
    ['Manrope loaded', manrope ? 'yes' : 'NO - falling back'],
    ['Installed apps', String(count)],
    ['Clock', now.toLocaleTimeString()],
    ['Engine', engine],
  ];
  return (
    <Overlay title="Diagnostics" hint="Back returns.">
      <div class="rows">
        {facts.map(([label, value]) => (
          <div class="row" key={label}>
            <span class="label">{label}</span>
            <span class="value">{value}</span>
          </div>
        ))}
      </div>
    </Overlay>
  );
}
