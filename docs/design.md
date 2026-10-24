# Design and architecture

How the app is put together, and where to extend it.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript, `strict` | Types on the Tizen bridge and state |
| UI | Preact 10 + hooks | ~4 kB runtime; React-sized APIs without React's weight |
| Build | Vite 8 (rolldown), `target: chrome76` | The TV's engine is Chromium-76 class |
| Output | Single IIFE bundle, classic `<script defer>` | ES modules can fail on a `wgt-package://` origin |
| Packaging | `tz pack` after the build | Samsung's packager and signer |

`npm run build` runs `tsc --noEmit` first, so a type error fails the build before bundling.

## Source map

| File | Responsibility |
| --- | --- |
| `src/tizen.ts` | The only module that touches `window.tizen`: `listApps`, `launchApp`, `openAmbient` |
| `src/data.ts` | Wallpaper catalogue, brand colours, optical mark sizes (`MARK_BOX`) |
| `src/prefs.ts` | `localStorage` persistence under `cleanframe.v2` |
| `src/App.tsx` | State, keyboard handling and all components |
| `src/styles.css` | Design tokens and layout |
| `public/` | `config.xml`, photographs, brand SVGs, fonts — copied verbatim into the build |

## State

One `App` component holds everything:

```ts
view     'home' | 'apps' | 'walls' | 'settings' | 'diagnostics'
sel      focus index on Home: app rail first, then the three controls
cursor   focus index inside an overlay
prefs    { wall, clock24, home[] }   persisted
apps     catalogue from the TV
editHome whether All apps is in "apps on Home" mode
```

`sel` spans `rail.length + 3`, so Home is a single horizontal axis: arrows move from apps straight onto
Ambient / All apps / Settings. There is no vertical zone to get lost in.

## Input

Key codes map to `left/right/up/down/ok/back`. The listener is attached **once** and dispatches through
`actionRef.current`, which always holds the latest handler:

```ts
const actionRef = useRef<(action: string) => void>(() => {});
actionRef.current = (action) => { /* uses current state */ };
useEffect(() => { window.addEventListener('keydown', onKey); }, []);
```

This matters: binding the listener per render means a fast Right-then-OK acts on the previous focus and
opens the wrong thing. That bug cost a whole install cycle.

Back is deliberately a no-op on Home, so you cannot fall out of the screen by accident.

## Overlays

One overlay component renders a title, a hint and a body. Grid navigation is generic: each view declares
its column count (apps 7, walls 5, settings and diagnostics 1) and the cursor steps by one or by a whole
row. Focus is applied by class, never by rebuilding the grid, so moving across 60 apps does not
re-create any element.

The focused element is scrolled into view with `scrollIntoView({ block: 'nearest' })`.

## Design tokens

```
--ink    #ffffff          primary text
--dim    rgba(255,255,255,.74)
--faint  rgba(255,255,255,.52)
--t      220ms            all movement
--ease   cubic-bezier(.22,.61,.36,1)
```

Type: clock `136px/400` with `-.045em` tracking and tabular numerals; overlay title `56px/400`; app name
`20–25px/500`; row label `34px`. Margins are multiples of 4, with a 96px top and 88px side safe area.

## Marks and colour

Brand SVGs are single-colour, so each is used as a CSS mask and coloured by `color` on its container:

```css
.mark { background-color: currentColor; -webkit-mask-image: url(...); }
```

`src/data.ts` holds the colour map and `MARK_BOX`, the per-brand render size derived from measured ink
bounds so every logo carries equal visual weight. `color: <brand>` on the tile or card also colours the
focus ring, which is why Netflix focuses red and Spotify green.

Apps with no bundled mark fall back to a monogram chip. **The TV's own icon files are never used** —
they vary in size and resolution and made the grid look inconsistent.

## To extend

**A wallpaper.** Add `<id>.jpg` (1920×1080) and `<id>-thumb.jpg` to `public/assets/wallpapers/`, then add
`{ id, name, tone }` to that folder's `catalog.js`. `tone: 'light'` selects the stronger scrim.

**A brand mark.** Add `public/assets/icons/<brand>.svg`, map the app ID to the brand in
`src/tizen.ts`'s `KNOWN`, and add its colour and `MARK_BOX` size in `src/data.ts`.

**A Home control.** Add an entry to the control array in `App.tsx` with a name, an SVG path and a
handler; it joins the focus axis automatically.

## Constraints to keep

- No flex `gap`, no `inset`, no `:has()`, no `aspect-ratio` — see [findings](findings.md#web-engine-limits).
- Motion is `transform` and `opacity` only; no `backdrop-filter`, no animated `box-shadow`.
- Write source files as UTF-8. A PowerShell `Set-Content` round-trip once turned `styles.css` into ANSI
  and the bundler rejected it with a misleading error.
