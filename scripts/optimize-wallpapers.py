"""Re-encode CleanFrame's full-size wallpapers to a smaller JPEG.

Keeps the pixel dimensions and picks the lowest JPEG quality that still meets a
PSNR target against the original, so the saving is measurable rather than a guess.

    python scripts/optimize-wallpapers.py --source <originals> --target app/assets/wallpapers

The thumbnail (512px) and panel (320px) files are already small and are left alone.
"""
import argparse
import io
from pathlib import Path

import numpy as np
from PIL import Image

QUALITIES = (80, 84, 88, 90, 92, 95)


def psnr(a: Image.Image, b: Image.Image) -> float:
    x = np.asarray(a.convert("RGB"), dtype=np.float64)
    y = np.asarray(b.convert("RGB"), dtype=np.float64)
    mse = np.mean((x - y) ** 2)
    return 99.0 if mse <= 1e-12 else 10.0 * np.log10(255.0 * 255.0 / mse)


def encode(image: Image.Image, quality: int) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=quality, optimize=True, progressive=False)
    return buffer.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="directory holding the original wallpapers")
    parser.add_argument("--target", required=True, help="directory to write optimised wallpapers into")
    parser.add_argument("--target-psnr", type=float, default=40.0)
    args = parser.parse_args()

    source = Path(args.source)
    target = Path(args.target)
    target.mkdir(parents=True, exist_ok=True)

    total_before = total_after = 0
    rows = []

    for path in sorted(source.glob("*.jpg")):
        if path.stem.endswith(("-thumb", "-panel")):
            continue
        original = Image.open(path)
        original.load()
        before = path.stat().st_size

        chosen = None
        for quality in QUALITIES:
            data = encode(original, quality)
            candidate = Image.open(io.BytesIO(data))
            candidate.load()
            score = psnr(original, candidate)
            if score >= args.target_psnr:
                chosen = (data, quality, score)
                break
            chosen = (data, quality, score)  # keep the best attempt so far

        data, quality, score = chosen
        # Never ship a file that grew: some originals are already near their
        # compression limit, and re-encoding them adds bytes without adding detail.
        if len(data) >= before:
            data = path.read_bytes()
            quality = 0
            score = 99.0
        (target / path.name).write_bytes(data)

        total_before += before
        total_after += len(data)
        rows.append((path.name, before, len(data), quality, score))

    width = max(len(r[0]) for r in rows)
    print(f"{'file'.ljust(width)}  {'before':>8}  {'after':>8}  q    PSNR")
    for name, before, after, quality, score in rows:
        print(f"{name.ljust(width)}  {before/1024:7.0f}K  {after/1024:7.0f}K  {quality:<4} {score:5.2f} dB")
    saved = total_before - total_after
    print(f"\ntotal: {total_before/1048576:.2f} MB -> {total_after/1048576:.2f} MB "
          f"(saved {saved/1048576:.2f} MB, {100*saved/total_before:.0f}%)")


if __name__ == "__main__":
    main()
