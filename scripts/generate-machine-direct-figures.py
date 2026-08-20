#!/usr/bin/env python3
import importlib.util
import json
import os
import re

import fitz
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGACY_SCRIPT = os.path.join(ROOT, "scripts", "generate-machine-figures.py")
FIG_DIR = os.path.join(ROOT, "assets", "machine", "figures")
MANIFEST_PATH = os.path.join(FIG_DIR, "manifest.json")
os.makedirs(FIG_DIR, exist_ok=True)

spec = importlib.util.spec_from_file_location("legacy_machine_figures", LEGACY_SCRIPT)
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)

CAPTION_RE = re.compile(r"^(図|表|式)(?:\s*[0-9０-９]+)?(?:\s|$|[：:])")


def expanded(rect, page, xpad=14, ypad=14):
    return fitz.Rect(
        max(0, rect.x0 - xpad),
        max(0, rect.y0 - ypad),
        min(page.rect.width, rect.x1 + xpad),
        min(page.rect.height, rect.y1 + ypad),
    )


def overlap_ratio(a, b):
    inter = a & b
    if inter.is_empty:
        return 0
    return inter.get_area() / max(1, min(a.get_area(), b.get_area()))


def add_unique(items, rect, label):
    if rect.width < 50 or rect.height < 18:
        return
    for old_rect, _ in items:
        if overlap_ratio(rect, old_rect) > 0.68:
            return
    items.append((rect, label))


def supplemental_regions(page):
    blocks = []
    for b in page.get_text("blocks"):
        rect = fitz.Rect(b[:4])
        text = " ".join(str(b[4]).strip().split())
        if text:
            blocks.append((rect, text))

    clusters = legacy.drawing_clusters(page)
    items = []

    for rect, label in legacy.select_regions(page):
        add_unique(items, rect, label)

    for caption_rect, text in blocks:
        if not CAPTION_RE.match(text):
            continue
        near = [
            c for c in clusters
            if legacy.rect_distance(caption_rect, c) <= 125
            and abs((caption_rect.x0 + caption_rect.x1 - c.x0 - c.x1) / 2) <= max(220, c.width)
        ]
        region = fitz.Rect(caption_rect)
        if near:
            for c in near:
                region |= c
        else:
            band = fitz.Rect(
                max(0, caption_rect.x0 - 240),
                max(0, caption_rect.y0 - 150),
                min(page.rect.width, caption_rect.x1 + 240),
                min(page.rect.height, caption_rect.y1 + 55),
            )
            for r, tx in blocks:
                if r.intersects(band) and len(tx) <= 180:
                    region |= r
        add_unique(items, expanded(region, page), text)

    for cluster in sorted(clusters, key=lambda r: (r.y0, r.x0)):
        if cluster.width >= 70 and cluster.height >= 28 and cluster.get_area() >= 1800:
            add_unique(items, expanded(cluster, page), "drawing")

    return sorted(items, key=lambda item: (item[0].y0, item[0].x0))


def question_candidates(year, q, doc):
    candidates = []
    pages = [p for p, qq in legacy.PAGE_TO_Q[year].items() if qq == q]
    for page_no in pages:
        page = doc[page_no - 1]
        for rect, label in supplemental_regions(page):
            candidates.append((page_no, rect, label, page))
    return candidates


def choose_candidates(candidates, count):
    if not candidates:
        return []
    if len(candidates) <= count:
        return candidates

    explicit = [c for c in candidates if c[2] != "drawing"]
    generic = [c for c in candidates if c[2] == "drawing"]
    chosen = explicit[:count]
    if len(chosen) < count:
        for c in generic:
            if len(chosen) >= count:
                break
            if all(overlap_ratio(c[1], x[1]) < 0.55 or c[0] != x[0] for x in chosen):
                chosen.append(c)
    return sorted(chosen[:count], key=lambda c: (c[0], c[1].y0, c[1].x0))


def save_png(image, path):
    if image.width > 1400:
        nh = round(image.height * 1400 / image.width)
        image = image.resize((1400, nh), Image.Resampling.LANCZOS)
    image.save(path, "PNG", optimize=True, dpi=(150, 150))
    return image.size


def main():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    docs = {}
    for year, url in legacy.SOURCES.items():
        print(f"Downloading {year}: {url}")
        docs[year] = fitz.open(stream=legacy.download(url), filetype="pdf")

    report = {
        "source": "official-pdfs",
        "generated": [],
        "preserved": [],
        "missingCandidates": [],
    }

    for question_id, filenames in manifest.get("questions", {}).items():
        if not filenames:
            continue
        m = re.match(r"r0?([4-7])-machine-(\d+)$", question_id)
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

        candidates = choose_candidates(question_candidates(year, q, docs[year]), len(filenames))
        print(f"{question_id}: {len(candidates)} candidates for {len(filenames)} files")
        if not candidates:
            report["missingCandidates"].append(question_id)
            print(f"WARNING: no figure candidates for {question_id}; viewer fallback remains available")
            continue

        while len(candidates) < len(filenames):
            candidates.append(candidates[-1])

        for filename, candidate in zip(filenames, candidates):
            path = os.path.join(FIG_DIR, filename)
            if os.path.exists(path):
                continue
            page_no, rect, label, page = candidate
            image = legacy.render_crop(page, rect, zoom=2.35)
            size = save_png(image, path)
            report["generated"].append({
                "question": question_id,
                "file": filename,
                "page": page_no,
                "label": label,
                "width": size[0],
                "height": size[1],
            })
            print(f"Generated {filename}: p.{page_no} {label} {size[0]}x{size[1]}")

    report_path = os.path.join(FIG_DIR, "generation-report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")

    expected = [name for files in manifest.get("questions", {}).values() for name in files]
    existing = [name for name in expected if os.path.exists(os.path.join(FIG_DIR, name))]
    print(f"Direct figures: {len(existing)}/{len(expected)} present")
    if report["missingCandidates"]:
        print("Missing figure candidates:", ", ".join(report["missingCandidates"]))


if __name__ == "__main__":
    main()
