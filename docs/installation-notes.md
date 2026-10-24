# Installation notes

Notes from the session that produced this repository. Useful when something behaves differently on
another TV.

## Environment

| Tool | Version / location |
| --- | --- |
| `tz` (Tizen CLI) | 10.3.9 — `%LOCALAPPDATA%\tizen-studio\tools\tizen-core\tz.exe` |
| `sdb` | 4.2.36 — `%LOCALAPPDATA%\tizen-studio\tools\sdb\sdb.exe` |
| Signing profiles | `%USERPROFILE%\tizen-studio-data\profile\profiles.xml` |
| Author certificate | `%USERPROFILE%\tizen-studio-data\keystore\author\author.p12` |
| Signing profile used | `san`, distributor = Tizen public `tizen-distributor-signer.p12` |

`tz` prints its version only through its interactive prompt; `tz version` and `tz package` are not valid
subcommands. Use `tz --help`.

## Discovering the TV

The TV's HTTP API reports identity without any developer setup:

```powershell
Invoke-RestMethod http://<tv-ip>:8001/api/v2/
```

That returned the model (`UA43AU8100KXXT`), `FrameTVSupport: false`, `developerMode: 1` and the DUID.

`sdb` reports the OS details once Developer Mode is working:

```powershell
& $sdb -s <tv-ip>:26101 capability
```

```
profile_name:tv
can_launch:tv-samsung
cpu_arch:armv7
platform_version:6.0
product_version:4.0
sdbd_rootperm:disabled
```

`platform_version: 6.0` is the number that matters — it is why `required_version="6.5"` fails.

## Order of operations that worked

1. `sdb connect <tv-ip>:26101` — this fails until the TV's `Host PC IP` matches the computer's LAN
   address. A full power cycle from the wall was the reliable way to apply it.
2. `tz pack -w app -t wgt -s san` — signs with author + distributor, no Samsung login involved.
3. `sdb push <wgt> /home/owner/share/tmp/sdk_tools/<name>.wgt`
4. `sdb shell 0 vd_appinstall <app-id> <remote-path>` — plain `sdb install` only uploads on these TVs;
   `vd_appinstall` is what actually installs.
5. `sdb shell 0 execute <app-id>` — reports `successfully launched pid = ...`.

`sdb shell 0 <command>` takes an integer argument before the command; that form works where
`sdb shell "<command>"` returns `closed`.

## The two failures worth remembering

**`install failed[118, -19], reason: Parsing error`.** Caused by a 7-character package ID
(`Cftest1`). The same widget with a 10-character package ID (`Cftest1234`) installed immediately.
Samsung package IDs are exactly 10 alphanumeric characters, starting with a letter.

**Certificate tooling is not needed.** Significant effort went into rebuilding Tizen Studio's
Certificate Manager to obtain a Samsung-issued distributor certificate, including a 2017-era Eclipse
RCP that could not launch a browser for the Samsung login. All of it was unnecessary: this TV accepted
a widget signed with the Tizen *public* distributor certificate. If your TV rejects the public
certificate, the Samsung account path in the
[upstream guide](https://github.com/nthnclrk/CleanFrame/blob/main/docs/agent-tv-setup-guide.md)
is the fallback.

## Rendering check

Upstream CSS uses 37 `gap:` declarations inside flex containers. Flex `gap` needs Chromium 84+, so it
was a compatibility risk on Tizen 6.0. On the test TV the layout rendered correctly with no changes,
so no CSS fallback is included. If rows look cramped on other hardware, that is the first thing to
look at.
