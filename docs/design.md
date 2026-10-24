# Design and architecture

How the interface is put together, so it can be extended without reading all of `ui.js`.

## Files

| File | Responsibility |
| --- | --- |
| `app/index.html` | Static skeleton: photo, scrim, clock, rail, controls, one overlay container |
| `app/ui.css` | Design tokens, layout, overlay styles. No framework, no preprocessor |
| `app/ui.js` | State, rendering, remote navigation. ES5, one IIFE |
| `app/device.js` | Tizen bridge: launch, app list, Ambient, Samsung Home/settings |
| `app/assets/wallpapers/catalog.js` | `window.CleanFrameWallpapers`: id, name, tone per photograph |
| `app/assets/icons/*.svg` | Brand marks, used as CSS masks |

## State

One object, `S`:

```js
{
  wall, clock24, home,   // persisted to localStorage under cleanframe.next.v1
  apps,                  // catalogue from FrameDevice.apps()
  view,                  // 'home' | 'apps' | 'walls' | 'settings'
  sel,                   // home focus index: apps first, then controls
  oi, firstRow,          // overlay focus index and scroll offset
  edit                   // All apps opened as "Apps on Home"
}
```

`sel` is a single index across `home.length + CONTROLS.length`. App marks occupy `0..home.length-1`,
the three controls follow. That is why moving right off the last app lands on Ambient — one axis, no
separate vertical zone.

## Rendering

There is no virtual DOM and no per-frame work. `renderRail()` and `renderControls()` rebuild their
innerHTML from `S`; they run only on focus changes, app-list arrival and overlay open/close. Overlays
are built once when opened, then `paintOverlayFocus()` only toggles the `is-focus` class, so moving in
a 60-app grid never rebuilds an element or re-decodes an image.

The photograph fades in once per change: `paintWall()` sets `img.src` on a detached `Image`, and only
assigns it to the `<img>` on `onload`, so there is no flash of the old frame.

`applyTone()` sets `tone-light` on the stage when the catalogue marks a photograph as bright; the
scrim has a stronger variant for those. This is a per-photo decision made offline, not runtime pixel
analysis.

## Adding things

**A photograph.** Drop `<id>.jpg` (1920×1080), `<id>-thumb.jpg` (512px) and `<id>-panel.jpg` into
`app/assets/wallpapers/`, then add `{ id, name, tone }` to `catalog.js`. `tone: 'light'` selects the
stronger scrim. Nothing else is needed — the picker reads the catalogue.

**A brand mark.** Add `app/assets/icons/<brand>.svg` and map the app ID to that brand in `device.js`'s
`IDS`. The mark is painted as a CSS mask in `currentColor`, so the SVG's own fill is ignored and only
its alpha matters. Without a brand or a TV icon the rail falls back to a letter monogram.

**An overlay.** Add a branch to `openOverlay(view, title, hint)`, build the DOM once into
`overlayBody`, set `S.cards`, then call `paintOverlayFocus()`. Navigation is generic: `columns()`
returns the grid width, and `moveOverlay()` steps by one or by a whole row. Add the view to
`activateOverlay()` and, if it should return somewhere specific, to `back()`.

**A Home control.** Add an entry to `CONTROLS` with a `name`, an SVG path in `SVG`, and a `run`
handler. It appears automatically and joins the focus order after the app rail.

## Tokens

```
--ink     #fff                    text at full strength
--dim     rgba(255,255,255,.62)   supporting text
--faint   rgba(255,255,255,.38)   hints and values
--t       220ms                   all movement
--ease    cubic-bezier(.22,.61,.36,1)
```

Type: clock `136px / 200 / -.045em`, overlay title `56px / 300 / -.025em`, row label `34px`,
app name `25px / 500`, card name `22px`, hint `22px` in `--faint`. Margins are multiples of 4, with a
96px safe area at the top and 88px at the sides.

## Constraints worth respecting

- **ES5 only** in `ui.js`: no `const`/`let`, arrow functions, template literals or `class`. The TV's
  engine is older than desktop Chromium.
- **No `inset` shorthand** in CSS, and do not rely on `:has()`, `clamp()` or flex `gap` for anything
  load-bearing. Use `top/right/bottom/left`.
- **Transform and opacity only** for motion. `backdrop-filter` and animated `box-shadow` are what make
  these TVs drop frames.
- **Never rebuild an overlay on focus move.** Toggle classes.

## Preview

```powershell
node tools/shot.mjs dist/shots
```

Serves `app/` on loopback, opens Chromium at 1920×1080 and writes PNGs for the home screen and each
overlay. It injects a `window.tizen` stub with a representative app list, because `device.js` expects a
TV. The same stub is the place to fake new app IDs when testing catalogue changes.
