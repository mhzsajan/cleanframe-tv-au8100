# CleanFrame for Samsung AU8100 (Tizen 6.0)

A working, signed build of [CleanFrame](https://github.com/nthnclrk/CleanFrame) — a quieter home screen
with your apps, a photograph and a clock — adapted to run on a **2021 Samsung AU8100** Crystal UHD TV.

Upstream CleanFrame targets a 2024 "The Frame" (LS03D, Tizen 9.0) and makes no compatibility claim for
anything else. This repository holds the two changes needed to get it running on older Tizen hardware,
plus scripts that build, sign, install and launch it.

> Independent project. Not affiliated with Samsung, and not maintained by the CleanFrame author.
> Use at your own risk.

## Tested on

| Item | Value |
| --- | --- |
| TV | Samsung **UA43AU8100KXXT** (AU8100 Crystal UHD, 2021) |
| Platform | Tizen **6.0**, `tv` profile, `cpu_arch: armv7` |
| Result | Installed and launched; layout renders correctly; apps launch from the home screen |

Other Samsung TVs from roughly 2019–2022 should behave similarly, since the fix is about the Tizen
version rather than the panel. Nothing here has been tested beyond the model above.

## What was changed

Two edits against upstream v0.6.1. Everything else — HTML, CSS, ES5 JavaScript, wallpapers, fonts — is
untouched.

**`app/config.xml`**

```diff
- <tizen:application id="nClrkHome1.FrameHome" package="nClrkHome1" required_version="6.5"/>
+ <tizen:application id="CfrHome001.Home" package="CfrHome001" required_version="6.0"/>
```

- `required_version` 6.5 → 6.0. Tizen 6.0 TVs refuse a package that demands 6.5.
- A new package and application identity, because the upstream IDs belong to the author's own
  installation.
- `CfrHome001` is exactly **10 characters** — see [Troubleshooting](#troubleshooting).

**`app/device.js`**

```diff
- var SELF = 'nClrkHome1.FrameHome';
+ var SELF = 'CfrHome001.Home';
```

Keeps the app from listing itself in its own app chooser.

## Further adaptation

On top of the two compatibility edits above, this build makes the app behave correctly on a non-Frame
TV and trims it slightly.

**Ambient instead of Art Mode.** `art()` in `app/device.js` now launches `org.tizen.ambientapp`. The
original `org.tizen.art-app` control only exists on The Frame, so it only ever produced an error here.
The Home control is labelled *Ambient*.

**Jellyfin and Spotify are first-class shortcuts.** Both are in `PRIMARY_APPS` (`app/main.js`) and in
the `IDS` map (`app/device.js`) so they get brand marks rather than generic tiles. `jellyfin.svg` is
from [Simple Icons](https://simpleicons.org) (CC0).

**Wallpapers recompressed.** `scripts/optimize-wallpapers.py` re-encodes the full-size wallpapers,
keeping the lowest JPEG quality that still reaches a 40 dB PSNR against the original, and refusing to
write a file that grew. Result: 9.84 MB → 8.15 MB, widget 15.1 MB → 13.5 MB, with no measurable
quality loss. Thumbnails and panels are untouched.

Worth knowing: this does **not** make the app noticeably faster. The TV decodes one 1080p wallpaper
regardless of its byte size, so the saving is install size and flash usage rather than frame rate.

## Requirements

- The TV with **Developer Mode** enabled, `Host PC IP` set to this computer's LAN address.
- [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) command-line tools
  (`tz` and `sdb`), usually at `%LOCALAPPDATA%\tizen-studio`.
- A signing profile. Any profile works, including one signed with the **Tizen public distributor
  certificate** — a Samsung account and a Samsung-issued certificate are *not* required, contrary to
  the upstream setup guide.

Enable Developer Mode on the TV: **Home → Apps → App Settings**, then press **1 2 3 4 5** on the
remote's number pad. Set Developer Mode to On and enter this PC's IP as **Host PC IP**. Restart the TV.

## Install

```powershell
git clone https://github.com/mhzsajan/cleanframe-tv-au8100.git
cd cleanframe-tv-au8100

# build + sign + install + launch
.\scripts\install.ps1 -TvAddress 192.168.0.7
```

If PowerShell blocks the scripts, run them for this session only:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Check your signing profile first, and pass a different one with `-Profile` if needed:

```powershell
& "$env:LOCALAPPDATA\tizen-studio\tools\tizen-core\tz.exe" security-profiles list
```

Other commands:

```powershell
.\scripts\build.ps1                       # package + sign only -> app\Debug\*.wgt
.\scripts\install.ps1 -TvAddress <ip> -SkipBuild
.\scripts\uninstall.ps1 -TvAddress <ip>
```

## Using it

**Home → Apps → CleanFrame.** It behaves like any other installed app; your stock home screen and the
Home button are untouched.

Inside CleanFrame, the remote's arrows move focus, Enter launches, and Settings changes layout,
background, clock and which apps appear.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `install failed[118, -19], reason: Parsing error` | The package ID is not exactly 10 characters. Rename it in `app/config.xml`, and update `SELF` in `app/device.js` to match. |
| `sdb connect` fails, socket opens then drops | TV Developer Mode `Host PC IP` is wrong — it must be this computer's LAN address, not `127.0.0.1`. Restart the TV after changing it. |
| `error: target not found` / `serial number ... wrong` | The sdb server exited with the shell that started it. Run `connect` and the command in the same script or terminal session. |
| `was get app info failed` on uninstall | `vd_appuninstall` wants the application ID (`CfrHome001.Home`), not the package ID (`CfrHome001`). |
| App installed but not in the Apps grid | Reboot the TV once so Smart Hub refreshes its app list. |
| Blank screen after launch | Confirm `required_version` matches or is below the TV's Tizen version. |

## Known limitations

- **Art Mode is mapped to Ambient Mode.** The original control called `org.tizen.art-app`, which only
  exists on real The Frame models. On this TV it now opens Samsung's Ambient Mode instead, which is the
  equivalent screen on a non-Frame set.
- **No Home-button replacement.** Deliberate. Taking over the Home key needs an undocumented helper
  that writes native startup/Home settings — firmware-specific and risky. Launch from Apps instead.
- **Developer Mode should stay on.** It was already enabled on the test TV. Turning it off may withdraw
  sideloaded apps.
- **Firmware updates** can change signing or launch behaviour. Re-run `install.ps1` after an update.
- **Shortcut IDs** in `app/device.js` were written for the author's TV. Common ones (Netflix, YouTube,
  Prime Video, Stremio, Spotify) match other Samsung TVs, and other installed apps are discovered at
  runtime, but a shortcut that does nothing means the ID differs on your TV.

## Layout

```
app/            CleanFrame v0.6.1 with the compatibility edits above
scripts/        build / install / uninstall (PowerShell), wallpaper optimiser (Python)
docs/           notes from the original installation session
LICENSE         MIT (upstream CleanFrame)
THIRD_PARTY_NOTICES.md
```

## Licence and credits

The interface, design and bundled wallpapers come from [CleanFrame](https://github.com/nthnclrk/CleanFrame)
by Nathan Clark, used under the MIT licence. Fonts, photographs and brand logos keep their own terms —
see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `app/assets/PHOTO-CREDIT.md`.

CleanFrame is an independent project with no Samsung or streaming-service affiliation. This adaptation
is likewise unofficial.
