# Performance notes

What was measured before changing anything, and what the code already does well. Kept so that future
"it feels slow" reports start from evidence instead of guesses.

## The app's render path is already incremental

`press()` in `app/main.js` runs `render()` on every remote keypress, which sounds expensive. It is not:

- `setHTML(el, html)` compares against `el._html` and skips the DOM write when the markup is identical.
- The dock uses `keyed(track, items, …)`, a keyed reconciliation that reuses tile elements instead of
  recreating them, and `setContent(el, key, html)` only rewrites a tile's content when its key changes —
  and that key deliberately excludes focus.
- Focus changes therefore only toggle `className` on the two affected tiles plus a transform. No HTML
  is parsed, no `<img>` is recreated and images stay decoded.

## The CSS avoids the expensive primitives

| Feature | Count | Why it matters |
| --- | --- | --- |
| `backdrop-filter` | 0 | Live backdrop blur is the single most expensive effect on weak TV GPUs |
| `filter: blur()` | 0 | Same; glass is pre-rendered into `assets/materials/*.jpg` instead |
| `mix-blend-mode` | 0 | Forces expensive stacking contexts |
| Animated `box-shadow` | 0 | Shadow animation is a notorious jank source |
| `transition` | 47 | All on `transform` and `opacity`, which the compositor handles |
| Transition duration | 180 ms (`--t`) | Short enough to hide latency, long enough to read |

`adaptive-ink.js` is precomputed palette data, not runtime pixel analysis, so nothing samples a canvas
at startup.

## Wallpaper size does not make it faster

Compressing the 15 full-size wallpapers from 9.84 MB to 8.15 MB cut the widget from 15.1 MB to
13.5 MB. That helps install time and flash usage. It does **not** help frame rate: the TV decodes one
1080p image regardless of whether its file is 300 KB or 1.1 MB, and decode time scales with pixels,
not bytes.

A first attempt at quality 82 produced 33–34 dB PSNR on two images — visible degradation — for an 8 MB
saving. Rejected. The shipped version keeps the lowest quality that reaches 40 dB and refuses to write
a file that grew, because several originals are already near their compression limit.

## What is actually slow

The remaining cost is outside the app:

1. **Tizen web app cold start.** Launching any web app on 2021 hardware costs a few seconds before the
   first frame. Nothing in `app/` changes that.
2. **App switching.** `tizen.application.launch` hands off to the TV's app framework; the delay is the
   framework's, not CleanFrame's.
3. **Compositing the photo background.** With `Background = Photo`, the TV composites a full-screen
   image, a material plate, a scrim and the dock. This is the one appearance choice with a real,
   user-visible cost on this class of hardware.

## Levers that genuinely help

In order of effect, all available from Settings without touching code:

| Change | Effect |
| --- | --- |
| `Background = Dark` or `Light` instead of `Photo` | Removes the full-screen image and material plates from every frame — the biggest single win |
| `Focus = Type` instead of `Glass` | Drops a composited plate per focus move |
| `Material = Soft` | Cheaper than Frost or Tint |
| Fewer apps on Home | Fewer tiles to composite and lay out |

If a "performance" appearance preset is worth adding, it is exactly that combination.
