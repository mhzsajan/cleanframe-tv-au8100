# CleanFrame for Samsung AU8100

A gallery-style home screen for a 2021 Samsung Crystal UHD — one photograph, the time, and a rail of
your apps. Built for a **UA43AU8100KXXT on Tizen 6.0**.

> **Status: experimental, shelved.** It installs, launches and runs on the TV. It is not a daily
> driver, and the reason is structural rather than cosmetic — see [Why this was shelved](#why-this-was-shelved).
> The repository is kept because the device and engine findings below are reusable.

![Home screen](docs/images/home.jpg)

## Why this was shelved

The whole value of a *home screen* is being the screen the TV lands on. Installing it as an ordinary
app gives the opposite: Home → All apps → CleanFrame → Netflix. It replaces nothing and adds a step.

Making it the real Home screen needs the system Home app reassigned, which is an undocumented,
firmware-specific helper. On this TV that is probably impossible anyway: `sdb` exposes only app
operations (`ls`, `ps`, `screencapture` and friends all return nothing), so the helper the upstream
method depends on cannot be staged or executed.

The alternative use — an always-on art frame with a clock — is the version of this idea the TV does not
already provide, but that is a different app (drop the rail, keep the photograph and clock).

## What actually works

| Area | Result |
| --- | --- |
| Packaging and signing | Signed `.wgt` installs via `vd_appinstall`; launches via `execute` |
| Home screen | Renders correctly on the TV: photograph, clock, coloured brand marks, focus ring |
| Input | Arrows move the rail, OK launches, Back closes overlays |
| Overlays | All apps, Background and Settings open |
| Build | TypeScript + Preact + Vite → 30 kB bundle (12 kB gzip) |

## Known issues

- **All apps layout is wrong on the TV.** It is correct in desktop Chromium. The suspected cause is
  the TV's web viewport not being the 1920×1080 the layout assumes, but this was never confirmed — see
  the diagnostics note in [findings](docs/findings.md#unresolved-all-apps-layout).
- **No Home-button takeover**, so it is an app, not a launcher.
- **Art Mode is mapped to Ambient Mode** (`org.tizen.ambientapp`), since `org.tizen.art-app` only
  exists on real The Frame models.
- **Developer Mode must stay on.** It was already enabled on the reference TV.

## Install

Requires Tizen Studio CLI (`tz`, `sdb`) and a signing profile. No Samsung account is needed — this TV
accepts a widget signed with the **Tizen public distributor** certificate.

```powershell
git clone https://github.com/mhzsajan/cleanframe-tv-au8100.git
cd cleanframe-tv-au8100

npm ci
npm run build                    # tsc --noEmit && vite build  -> app\
.\scripts\build.ps1 -SkipCompile # sign -> app\Debug\app.wgt
.\scripts\install.ps1 -TvAddress <tv-ip>
```

`.\scripts\uninstall.ps1 -TvAddress <tv-ip>` removes it. It takes the **app ID** (`CfrHome001.Home`),
not the package ID.

## Development

```powershell
npm run dev        # Vite dev server with HMR on port 4796 (no TV APIs; use it for layout)
npm run build      # type-check + bundle to app\
npm run typecheck
```

```
src/tizen.ts      typed bridge: app list, launch, Ambient
src/data.ts       wallpaper catalogue, brand colours, optical mark sizes
src/prefs.ts      persisted preferences (localStorage, cleanframe.v2)
src/App.tsx       component tree
src/styles.css    design system
public/           config.xml, photographs, brand marks, fonts
```

In a browser the TV APIs are absent, so the app list is empty. `tools/probe.mjs` (in the parent
workspace, not this repo) stubs `window.tizen` and screenshots the result at 1920×1080.

## Findings

Everything learned about this TV — signing, the Tizen CLI, SDB quirks, engine limits and the bugs that
cost the most time — is written up in **[docs/findings.md](docs/findings.md)**. Architecture notes are
in [docs/design.md](docs/design.md).

Short version:

- Package IDs must be **exactly 10 characters** or install fails with `[118, -19] Parsing error`.
- `required_version` above the TV's Tizen version is rejected outright.
- The engine is Chromium-76 class: no flex `gap`, no `inset`, and ES modules can fail on a
  `wgt-package://` origin — use a classic script **with `defer`**.
- Manrope is declared 400–700; asking for 200/300 makes the TV clamp or synthesise the weight.

## Credits and licence

Interface, photographs and fonts come from [CleanFrame](https://github.com/nthnclrk/CleanFrame) by
Nathan Clark. Original code is MIT (see [LICENSE](LICENSE)); fonts, photographs and brand marks keep
their own terms — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). `jellyfin.svg` added here, from
Simple Icons (CC0).

Independent project. Not affiliated with Samsung, and not maintained by the upstream author.
