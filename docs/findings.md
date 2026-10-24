# Findings

Everything worth keeping from building and installing this on a 2021 Samsung TV. Written for future
me, or anyone repeating the exercise.

## Reference device

| Item | Value |
| --- | --- |
| Model | Samsung **UA43AU8100KXXT** (AU8100 Crystal UHD, 2021, "NIKEL" platform) |
| OS | Tizen **6.0** — `platform_version: 6.0` from `sdb capability` |
| Capability | `profile_name: tv`, `can_launch: tv-samsung`, `cpu_arch: armv7`, `product_version: 4.0` |
| Frame support | `FrameTVSupport: false` — not a The Frame, no Art Mode |
| Panel | 3840×2160, but the web viewport is **unconfirmed** (see below) |

Identity is readable without any developer setup:

```powershell
Invoke-RestMethod http://<tv-ip>:8001/api/v2/
```

Returns model, `FrameTVSupport`, `developerMode`, DUID and firmware.

## Signing and packaging

**No Samsung account is required.** This TV accepted a widget signed with the **Tizen public
distributor** certificate (`tizen-distributor-signer.p12`, shipped with Tizen Studio). The upstream
guide's Samsung certificate flow — author certificate plus a distributor certificate bound to the TV's
DUID — was not needed.

The working chain:

```powershell
$tz  = "$env:LOCALAPPDATA\tizen-studio\tools\tizen-core\tz.exe"
$sdb = "$env:LOCALAPPDATA\tizen-studio\tools\sdb\sdb.exe"

& $tz pack -w .\app -t wgt -s san                    # sign -> app\Debug\app.wgt
& $sdb connect <tv-ip>:26101
& $sdb -s <tv-ip>:26101 push .\app\Debug\app.wgt /home/owner/share/tmp/sdk_tools/cf.wgt
& $sdb -s <tv-ip>:26101 shell 0 vd_appinstall CfrHome001.Home /home/owner/share/tmp/sdk_tools/cf.wgt
& $sdb -s <tv-ip>:26101 shell 0 execute CfrHome001.Home
```

Rules that bite:

| Rule | Failure if broken |
| --- | --- |
| Package ID must be **exactly 10 alphanumeric characters**, starting with a letter | `install failed[118, -19], reason: Parsing error` |
| `required_version` must not exceed the TV's Tizen version | Package rejected |
| `vd_appuninstall` takes the **application ID**, not the package ID | `was get app info failed` |
| Plain `sdb install` only uploads on this TV | Use `vd_appinstall` |

## SDB

- **`Host PC IP` must be this computer's LAN address**, set on the TV under Developer Mode
  (Home → Apps → App Settings → `12345` on the number pad). Wrong or `127.0.0.1` means the socket is
  accepted and then the handshake fails, which looks like a network problem.
- A **full power cycle from the wall** was the only reliable way to make Developer Mode settings take
  effect; the prompted restart was not enough.
- **The `sdb` server dies with the process that started it.** Run `connect` and the command in the same
  invocation, or `sdb -s <serial>` fails with `error: target not found` / `serial number ... wrong`.
- **Shell access is effectively app-only.** `applist`, `execute`, `vd_appinstall`, `vd_appuninstall`
  work. `ls`, `ps`, `screenshot`, `screencap`, `dlog` and `cat` return nothing — no filesystem or
  screen capture over sdb. This is why the layout could never be captured remotely.
- `sdb shell 0 <command>` is the form that works; `sdb shell "<command>"` returns `closed`.

## Tizen Studio and the `tz` CLI

- Only the **CLI** was needed: `%LOCALAPPDATA%\tizen-studio` with `tools/tizen-core/tz.exe` (10.3.9),
  `tools/sdb/sdb.exe` (4.2.36), and a profile at `%USERPROFILE%\tizen-studio-data\profile\profiles.xml`.
- `tz version` and `tz package` are **not** valid subcommands; use `tz --help`, `tz pack`, `tz install`.
  Running bare `tz` opens an interactive prompt that hangs a script.
- The full IDE is not required. A hand-assembled tree from `download.tizen.org` works for packaging, but
  the Certificate Manager GUI is a 2017-era Eclipse that needs Java 8 (Java 11/17 fail with
  `javax.annotation.PostConstruct`), ships as an NSIS self-extractor that cannot unpack inside the
  sandbox, and its Samsung sign-in hands off to the browser. None of it was necessary — skip it.

## Web engine limits

Chromium-76 class on 32-bit ARM. Verified constraints:

| Do not use | Use instead |
| --- | --- |
| flex `gap` | CSS grid `column-gap` / `row-gap` |
| `inset: 0` | `top/right/bottom/left` |
| `:has()`, `aspect-ratio`, `clamp()` | Desktop-only; assume absent |
| ES module entry | Classic script **with `defer`** |
| `font-weight: 200/300` with the bundled Manrope | 400–600 (the file declares 400–700) |

Also:

- `-webkit-text-size-adjust: 100%` is needed, or the engine applies its own text autosizing.
- `font-synthesis: none` stops fake weights being invented for missing ones.
- Unprefixed `mask-image` is unsupported; `-webkit-mask-image` is what applies. Ship both.
- A `wgt-package://` origin can refuse ES modules on CORS grounds. Emit an IIFE bundle and strip
  `type="module"` / `crossorigin`.

## Bugs that cost the most time

| Symptom | Cause | Fix |
| --- | --- | --- |
| Black screen, no error | `type="module"` removed to dodge CORS also removed the implicit defer, so the classic script ran in `<head>` before `<body>` and `#root` was `null` | Emit `<script defer>`; guard and paint startup failures on screen |
| Black screen | Rewriting `index.html` dropped `<script type="module" src="/src/main.tsx">`, so Vite built a **0 kB** bundle with no warning | Keep the entry; check the emitted size after every build |
| Vite: "failed to build" / invalid UTF-8 | PowerShell `Set-Content` rewrote `styles.css` as ANSI | Always write source files as UTF-8 without BOM |
| OK on a control did nothing | Key listener re-bound per render; a fast Right-then-OK acted on the *previous* focus, so OK opened the wrong thing | Dispatch through a ref holding the current handler |
| Vite build: `spawn EPERM` | Vite spawns a helper to resolve Windows real paths | Run builds with wider sandbox permissions |
| `Cannot find package 'esbuild'` | Vite 8 dropped bundled esbuild; `minify: 'esbuild'` fails | Use the default minifier; Preact JSX via `tsconfig` `jsx: react-jsx` + `jsxImportSource: preact` |

## Optical icon sizing

Logo shapes differ enough that "fit each SVG in the same box" produces a ragged grid: a wide wordmark
renders tiny next to a square glyph. `public/assets/icons/metrics.js` already contains measured ink
bounds per icon (`x`, `y`, `w`, `h` at a 240px viewport).

`src/data.ts` uses them to compute a per-brand render size so each mark carries roughly equal **ink
area**, clamped inside the chip. Results at a 112px chip: Spotify and Stremio 72px, Netflix 96px tall,
Prime Video 100px wide but only 23px high.

If you add a mark, regenerate the metrics (`node scripts/build-icon-metrics.mjs` in the upstream repo)
and add its size to `MARK_BOX`.

## Unresolved: All apps layout

The All apps grid renders correctly in desktop Chromium and **incorrectly on the TV**. It was never
diagnosed, because:

- the TV's `sdb` cannot screenshot, and
- the app's own diagnostics screen (Settings → Diagnostics: viewport, screen size, DPR, engine string)
  was built but never photographed.

**Prime suspect:** the web viewport is not 1920×1080. The layout is a fixed 1920px stage; the home
screen anchors to the edges and would still look plausible, while a fixed 7×200px grid would visibly
overflow. If the viewport turns out smaller, the fix is to scale the stage to the reported size
(a `transform: scale()` wrapper or a CSS `zoom`) rather than to redesign the grid.

**First step on resuming:** open Settings → Diagnostics and record `Viewport` and `Engine`.

## Resume checklist

1. `npm ci && npm run build` — confirm the bundle is ~30 kB, not 0 kB.
2. `.\scripts\install.ps1 -TvAddress <tv-ip>` — needs Developer Mode on and the PC's IP in Host PC IP.
3. On the TV: **Settings → Diagnostics**, note viewport and engine.
4. Fix the grid for that viewport, then re-check All apps and Background.
5. Only then consider the Home-button question — and expect the restricted shell to block the
   upstream UID-901 helper.

## Not attempted

- Native Home/startup reassignment (undocumented; likely blocked, see above).
- Any research into the Tizen store, partner certificates, or firmware downgrade.
- Art Mode: `org.tizen.art-app` does not exist on this model; the control opens Ambient Mode instead.
