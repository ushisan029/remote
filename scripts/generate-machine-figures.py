#!/usr/bin/env python3
import base64
import io
import json
import math
import os
import re
import urllib.request
from collections import defaultdict

import fitz
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "machine")
os.makedirs(OUT, exist_ok=True)

SOURCES = {
    "r4": "https://www.exam.or.jp/CS_r041/CS20221903.pdf",
    "r5": "https://www.exam.or.jp/CS_r051/CS20231903.pdf",
    "r6": "https://www.exam.or.jp/wp-content/uploads/2024/12/CS20241903.pdf",
    "r7": "https://www.exam.or.jp/wp-content/uploads/2025/11/CS20251903.pdf",
}
PAGE_TO_Q = {
    "r4": {1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4},
    "r5": {1: 1, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4},
    "r6": {1: 1, 2: 1, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4},
    "r7": {1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 4},
}
YEAR_LABEL = {"r4": "令和4年度", "r5": "令和5年度", "r6": "令和6年度", "r7": "令和7年度"}


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def rect_distance(a, b):
    dx = max(a.x0 - b.x1, b.x0 - a.x1, 0)
    dy = max(a.y0 - b.y1, b.y0 - a.y1, 0)
    return math.hypot(dx, dy)


def drawing_clusters(page):
    W, H = page.rect.width, page.rect.height
    prim = []
    for d in page.get_drawings():
        r = fitz.Rect(d["rect"])
        if r.width < 0.4 or r.height < 0.4:
            continue
        if r.width > W * 0.97 and r.height > H * 0.97:
            continue
        prim.append(r)
    for img in page.get_images(full=True):
        try:
            for r in page.get_image_rects(img[0]):
                if r.width > 4 and r.height > 4:
                    prim.append(fitz.Rect(r))
        except Exception:
            pass

    n = len(prim)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        a, b = find(a), find(b)
        if a != b:
            parent[b] = a

    for i in range(n):
        for j in range(i + 1, n):
            if rect_distance(prim[i], prim[j]) <= 16:
                union(i, j)

    comps = defaultdict(list)
    for i, r in enumerate(prim):
        comps[find(i)].append(r)

    result = []
    for rs in comps.values():
        u = fitz.Rect(rs[0])
        for r in rs[1:]:
            u |= r
        if u.width >= 32 and u.height >= 20 and u.get_area() >= 1200 and u.y0 > 20 and u.y1 < H - 18:
            result.append(u)
    return result


def caption_blocks(page):
    out = []
    for b in page.get_text("blocks"):
        r = fitz.Rect(b[:4])
        text = " ".join(str(b[4]).strip().split())
        if not text or len(text) > 90:
            continue
        if re.match(r"^(図|表)(?:\s*[0-9０-９]+)?(?:\s|$|[：:])", text):
            out.append((r, text))
    return out


def select_regions(page):
    W, H = page.rect.width, page.rect.height
    clusters = drawing_clusters(page)
    blocks = page.get_text("blocks")
    selected = []
    used_sets = []

    for cr, text in caption_blocks(page):
        near = []
        for idx, c in enumerate(clusters):
            d = rect_distance(cr, c)
            if d <= 110 and abs((cr.x0 + cr.x1) / 2 - (c.x0 + c.x1) / 2) <= max(190, c.width * 0.75):
                near.append((d, idx, c))
        if not near:
            continue
        near.sort(key=lambda x: x[0])
        min_d = near[0][0]
        group = [x for x in near if x[0] <= max(38, min_d + 16)]
        ids = [idx for _, idx, _ in group]
        if any(set(ids) & old for old in used_sets):
            continue
        used_sets.append(set(ids))
        u = fitz.Rect(cr)
        for _, _, c in group:
            u |= c

        grow = fitz.Rect(max(0, u.x0 - 10), max(0, u.y0 - 12), min(W, u.x1 + 10), min(H, u.y1 + 12))
        for b in blocks:
            br = fitz.Rect(b[:4])
            tx = " ".join(str(b[4]).strip().split())
            if len(tx) <= 120 and br.intersects(grow):
                u |= br
        u = fitz.Rect(max(0, u.x0 - 10), max(0, u.y0 - 10), min(W, u.x1 + 10), min(H, u.y1 + 10))
        selected.append((u, text))

    page_text = page.get_text("text")
    if not selected and ("図" in page_text or "表" in page_text):
        substantive = [(c.get_area(), c) for c in clusters if c.width >= 80 and c.height >= 35]
        substantive.sort(reverse=True, key=lambda x: x[0])
        for _, c in substantive[:2]:
            u = fitz.Rect(max(0, c.x0 - 14), max(0, c.y0 - 14), min(W, c.x1 + 14), min(H, c.y1 + 14))
            selected.append((u, "図表"))

    dedup = []
    for r, label in selected:
        duplicate = False
        for rr, _ in dedup:
            inter = r & rr
            if inter.get_area() > 0.75 * min(r.get_area(), rr.get_area()):
                duplicate = True
                break
        if not duplicate:
            dedup.append((r, label))
    return dedup


def render_crop(page, rect, zoom=2.15):
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    full = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    box = (
        max(0, int(rect.x0 * zoom)),
        max(0, int(rect.y0 * zoom)),
        min(full.width, int(rect.x1 * zoom)),
        min(full.height, int(rect.y1 * zoom)),
    )
    im = full.crop(box)
    gray = im.convert("L")
    inv = ImageOps.invert(gray)
    bb = inv.point(lambda p: 255 if p > 12 else 0).getbbox()
    if bb:
        x0, y0, x1, y1 = bb
        pad = 14
        im = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
    return im


def main():
    crops = defaultdict(list)
    source_pages = defaultdict(set)

    for year, url in SOURCES.items():
        print(f"Downloading {year}: {url}")
        doc = fitz.open(stream=download(url), filetype="pdf")
        for page_no, page in enumerate(doc, 1):
            q = PAGE_TO_Q[year][page_no]
            for rect, label in select_regions(page):
                im = render_crop(page, rect)
                if im.width < 140 or im.height < 65:
                    continue
                crops[(year, q)].append((page_no, label, im))
                source_pages[(year, q)].add(page_no)

    manifest = {"version": 1, "generatedFrom": "安全衛生技術試験協会 公表問題", "questions": {}}

    for (year, q), items in sorted(crops.items()):
        normalized = []
        for page_no, label, im in items:
            if im.width > 1200:
                nh = round(im.height * 1200 / im.width)
                im = im.resize((1200, nh), Image.Resampling.LANCZOS)
            normalized.append((page_no, label, im))
        if not normalized:
            continue

        maxw = max(im.width for _, _, im in normalized)
        gap = 24
        totalh = sum(im.height for _, _, im in normalized) + gap * (len(normalized) - 1)
        canvas = Image.new("RGB", (maxw, totalh), "white")
        y = 0
        for _, _, im in normalized:
            x = (maxw - im.width) // 2
            canvas.paste(im, (x, y))
            y += im.height + gap

        name = f"{year}-q{q}.jpg"
        path = os.path.join(OUT, name)
        canvas.save(path, "JPEG", quality=82, optimize=True, progressive=True, dpi=(150, 150))
        key = f"{YEAR_LABEL[year]}|{q}"
        manifest["questions"][key] = {
            "src": f"./assets/machine/{name}",
            "pages": sorted(source_pages[(year, q)]),
            "parts": len(normalized),
            "width": canvas.width,
            "height": canvas.height,
        }
        print(f"Generated {key}: {name} ({len(normalized)} parts)")

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"Generated {len(manifest['questions'])} question image sets")


if __name__ == "__main__":
    main()
