#!/usr/bin/env python3
import base64
import io
import json
import os
import re

from PIL import Image, ImageChops, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MACHINE_DIR = os.path.join(ROOT, "assets", "machine")
FIG_DIR = os.path.join(MACHINE_DIR, "figures")
MANIFEST_PATH = os.path.join(FIG_DIR, "manifest.json")
os.makedirs(FIG_DIR, exist_ok=True)


def legacy_files(year, q):
    if year == "r7" and q == 1:
        return [os.path.join(MACHINE_DIR, f"r7-q1-{i}.b64") for i in range(1, 5)]
    return [os.path.join(MACHINE_DIR, f"{year}-q{q}.b64")]


def load_legacy_png(year, q):
    paths = legacy_files(year, q)
    if not all(os.path.exists(p) for p in paths):
        return None

    text = "".join(open(p, "r", encoding="utf-8").read() for p in paths)
    text = "".join(text.split())
    if not text.startswith("iVBOR"):
        print(f"WARNING: legacy image for {year}-q{q} does not look like PNG data")
        return None

    try:
        data = base64.b64decode(text, validate=True)
        image = Image.open(io.BytesIO(data))
        image.load()
        return image.convert("RGB")
    except Exception as exc:
        print(
            f"WARNING: invalid legacy PNG for {year}-q{q}: "
            f"{type(exc).__name__}: {exc}"
        )
        return None


def trim_white(im, pad=8):
    gray = im.convert("L")
    mask = ImageOps.invert(gray).point(lambda p: 255 if p > 12 else 0)
    box = mask.getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    return im.crop((max(0, x0-pad), max(0, y0-pad), min(im.width, x1+pad), min(im.height, y1+pad)))


def blank_runs(im):
    gray = im.convert("L")
    w, h = gray.size
    pix = gray.load()
    threshold = max(2, int(w * 0.0015))
    blank = []
    for y in range(h):
        dark = 0
        for x in range(w):
            if pix[x, y] < 242:
                dark += 1
                if dark > threshold:
                    break
        blank.append(dark <= threshold)

    runs = []
    start = None
    for y, is_blank in enumerate(blank + [False]):
        if is_blank and start is None:
            start = y
        elif not is_blank and start is not None:
            if y - start >= max(8, h // 150):
                mid = (start + y - 1) // 2
                if h * 0.05 < mid < h * 0.95:
                    runs.append((start, y, mid))
            start = None
    return runs


def split_image(im, count):
    im = trim_white(im)
    if count <= 1:
        return [im]

    runs = blank_runs(im)
    cuts = []
    available = runs[:]
    for i in range(1, count):
        target = im.height * i / count
        if available:
            best = min(available, key=lambda r: (abs(r[2]-target), -(r[1]-r[0])))
            cuts.append(best[2])
            available.remove(best)
        else:
            cuts.append(round(target))
    cuts = sorted(cuts)

    # Guard against very small accidental slices. If whitespace candidates do
    # not form sensible partitions, use proportional cuts instead.
    bounds = [0] + cuts + [im.height]
    if any(bounds[i+1] - bounds[i] < max(24, im.height // (count * 5)) for i in range(count)):
        bounds = [round(im.height * i / count) for i in range(count + 1)]

    parts = []
    for y0, y1 in zip(bounds, bounds[1:]):
        part = trim_white(im.crop((0, y0, im.width, y1)))
        parts.append(part)
    return parts


def save_png(im, path):
    if im.width > 1400:
        nh = round(im.height * 1400 / im.width)
        im = im.resize((1400, nh), Image.Resampling.LANCZOS)
    im.save(path, "PNG", optimize=True, dpi=(150, 150))
    return im.size


def main():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    report = {"generated": [], "preserved": [], "missingLegacy": []}

    for question_id, filenames in manifest.get("questions", {}).items():
        if not filenames:
            continue
        m = re.fullmatch(r"r0?([4-7])-machine-(\d+)", question_id)
        if not m:
            continue
        year = f"r{int(m.group(1))}"
        q = int(m.group(2))

        missing = [name for name in filenames if not os.path.exists(os.path.join(FIG_DIR, name))]
        for name in filenames:
            if name not in missing:
                report["preserved"].append(name)
        if not missing:
            continue

        source = load_legacy_png(year, q)
        if source is None:
            report["missingLegacy"].append(question_id)
            print(f"WARNING: no usable legacy PNG source for {question_id}; viewer fallback remains available")
            continue

        parts = split_image(source, len(filenames))
        for filename, part in zip(filenames, parts):
            path = os.path.join(FIG_DIR, filename)
            if os.path.exists(path):
                continue
            size = save_png(part, path)
            report["generated"].append({"question": question_id, "file": filename, "width": size[0], "height": size[1]})
            print(f"Generated {filename}: {size[0]}x{size[1]}")

    report_path = os.path.join(FIG_DIR, "generation-report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")

    expected = [name for files in manifest.get("questions", {}).values() for name in files]
    existing = [name for name in expected if os.path.exists(os.path.join(FIG_DIR, name))]
    print(f"Direct figures: {len(existing)}/{len(expected)} present")
    if report["missingLegacy"]:
        print("Missing legacy sources:", ", ".join(report["missingLegacy"]))


if __name__ == "__main__":
    main()
