#!/usr/bin/env python3
"""Build a reflowable EPUB 3 for Draft2Digital.

Online buyers stay on the flipbook. This file is for D2D / Apple / Kobo.
Cover JPEG (1600×2400) is written beside the EPUB for the D2D cover field.
"""
from __future__ import annotations

import io
import json
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BOOK_JSON = ROOT / "data" / "book.json"
COPY_JSON = ROOT / "data" / "page-copy.json"
PHOTOS = ROOT / "photos"
DESKTOP = Path.home() / "Desktop"
EPUB_NAME = "Coffee-Book-2026.epub"
COVER_NAME = "Coffee-Book-2026-cover.jpg"
DESC_NAME = "Coffee-Book-D2D-description.txt"

TITLE = "Coffee Book"
CREATOR = "Peter Hernou"
PUBLISHER = "Peter Hernou"
YEAR = "2026"
DRINKS = "170+"
LANG = "en"
BOOK_ID = f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, 'https://peterhernou.com/coffee-book/2026')}"
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
VOID = (5, 5, 5)
PAPER = (235, 228, 218)
GOLD = (184, 149, 106)
CREAM = (247, 242, 234)

DESCRIPTION = (
    "The book you pour from. Coffee Book is World Champion Peter Hernou’s "
    f"{DRINKS} fully worked drinks — espresso, milk, chocolate, cold, classics, "
    "cocktails and Peter’s signatures — written as the bar makes them. "
    "Ingredients, method, serve. House espresso is 30–35 ml. Milk at 60–65°C. "
    "Ice last. The line that began with Latte Arte, Best Coffee Book in the World, "
    "now in the cup."
)
LENGTH_LINE = "Approximately 170 drinks across 11 chapters."

CONTAINER = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""

CSS = """@page { margin: 6%; }
body {
  margin: 0;
  padding: 0;
  font-family: Palatino, "Palatino Linotype", Georgia, serif;
  font-size: 1em;
  line-height: 1.45;
  color: #1c1714;
}
h1, h2, h3 {
  font-family: "Avenir Next", "Helvetica Neue", sans-serif;
  font-weight: 700;
  line-height: 1.15;
  color: #1c1714;
  page-break-after: avoid;
}
h1 { font-size: 1.7em; margin: 0 0 0.6em; letter-spacing: -0.03em; }
h2 { font-size: 1.28em; margin: 1.4em 0 0.35em; }
h3 { font-size: 0.78em; margin: 1.1em 0 0.3em; letter-spacing: 0.14em; text-transform: uppercase; color: #b8956a; }
p { margin: 0 0 0.75em; }
.kicker { font-family: "Avenir Next", "Helvetica Neue", sans-serif; font-size: 0.72em; letter-spacing: 0.18em; text-transform: uppercase; color: #b8956a; margin: 0 0 0.4em; }
.yield { font-family: "Avenir Next", "Helvetica Neue", sans-serif; font-size: 0.82em; letter-spacing: 0.06em; text-transform: uppercase; color: #8a6a45; }
ul, ol { margin: 0 0 0.85em; padding-left: 1.2em; }
li { margin: 0 0 0.28em; }
.note { font-size: 0.92em; }
.alcohol { font-size: 0.78em; letter-spacing: 0.08em; text-transform: uppercase; color: #8a6a45; }
img { max-width: 100%; height: auto; }
.cover-page, .cover-page img { margin: 0; padding: 0; text-align: center; }
.cover-page img { width: 100%; }
.recipe { page-break-inside: avoid; margin: 0 0 1.6em; padding-bottom: 0.4em; border-bottom: 1px solid #e0d6c8; }
.recipe:last-child { border-bottom: 0; }
.plate { margin: 0 0 0.7em; }
a { color: #1c1714; }
"""


def font(size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(AVENIR, size, index=index)


def jpeg_bytes(im: Image.Image, quality: int = 82) -> bytes:
    buf = io.BytesIO()
    im.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True, progressive=False)
    return buf.getvalue()


def cover_crop(im: Image.Image, w: int, h: int, focus: tuple[float, float] = (0.5, 0.48)) -> Image.Image:
    im = im.convert("RGB")
    src_w, src_h = im.size
    scale = max(w / src_w, h / src_h)
    nw, nh = int(src_w * scale + 0.5), int(src_h * scale + 0.5)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = int((nw - w) * focus[0])
    top = int((nh - h) * focus[1])
    left = max(0, min(left, nw - w))
    top = max(0, min(top, nh - h))
    return im.crop((left, top, left + w, top + h))


def build_cover(photo: Path) -> bytes:
    w, h = 1600, 2400
    photo_h = 1580
    plate = cover_crop(Image.open(photo), w, photo_h, focus=(0.52, 0.22))
    canvas = Image.new("RGB", (w, h), VOID)
    canvas.paste(plate, (0, 0))
    fade = Image.new("L", (w, 360), 0)
    fade_draw = ImageDraw.Draw(fade)
    for y in range(360):
        fade_draw.line((0, y, w, y), fill=int(255 * (y / 359) ** 1.35))
    band = Image.new("RGB", (w, 360), VOID)
    canvas.paste(band, (0, photo_h - 360), fade.filter(ImageFilter.GaussianBlur(0.4)))
    draw = ImageDraw.Draw(canvas)
    cx = w // 2
    y = photo_h + 72
    draw.text((cx, y), CREATOR.upper(), font=font(28, 0), fill=GOLD, anchor="mt")
    y += 92
    draw.text((cx, y), TITLE.upper(), font=font(92, 8), fill=CREAM, anchor="mt")
    y += 126
    draw.line((cx - 72, y, cx + 72, y), fill=GOLD, width=2)
    y += 36
    draw.text((cx, y), "Every drink, worked through.", font=font(34, 7), fill=PAPER, anchor="mt")
    y += 58
    draw.text(
        (cx, y),
        f"{DRINKS} recipes  ·  method  ·  serve",
        font=font(22, 0),
        fill=GOLD,
        anchor="mt",
    )
    y += 48
    draw.text((cx, y), "World Champion Latte Art", font=font(20, 0), fill=(160, 148, 132), anchor="mt")
    return jpeg_bytes(canvas, quality=88)


def xhtml(title: str, body: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<!DOCTYPE html>\n"
        '<html xmlns="http://www.w3.org/1999/xhtml" '
        'xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">\n'
        "<head>\n"
        '  <meta charset="utf-8"/>\n'
        f"  <title>{escape(title)}</title>\n"
        '  <link rel="stylesheet" type="text/css" href="css/book.css"/>\n'
        "</head>\n"
        f"<body>\n{body}\n</body>\n"
        "</html>\n"
    )


def recipe_view(recipe: dict, overlay: dict) -> dict:
    o = overlay or {}
    return {
        "id": recipe["id"],
        "title": o.get("title") or recipe["title"],
        "description": o.get("description") or "",
        "yield": o.get("yield") or "",
        "ingredients": o.get("ingredients") or recipe.get("ingredients") or [],
        "method": o.get("method") or recipe.get("method") or [],
        "proTip": o.get("proTip") or "",
        "serve": o.get("serve") or "",
        "alcohol": bool(recipe.get("containsAlcohol")),
        "photo": (recipe.get("photo") or {}).get("src") or "",
        "alt": (recipe.get("photo") or {}).get("alt") or recipe["title"],
    }


def list_html(tag: str, items: list[str]) -> str:
    if not items:
        return ""
    inner = "\n".join(f"    <li>{escape(str(item))}</li>" for item in items if str(item).strip())
    return f"  <{tag}>\n{inner}\n  </{tag}>\n"


def recipe_html(view: dict, image_name: str | None) -> str:
    parts = [f'<section class="recipe" id="{escape(view["id"])}">']
    parts.append(f'  <h2>{escape(view["title"])}</h2>')
    if image_name:
        parts.append(
            f'  <p class="plate"><img src="images/{escape(image_name)}" alt="{escape(view["alt"])}"/></p>'
        )
    if view["description"]:
        parts.append(f'  <p>{escape(view["description"])}</p>')
    if view["yield"]:
        parts.append(f'  <p class="yield">{escape(view["yield"])}</p>')
    if view["alcohol"]:
        parts.append('  <p class="alcohol">Contains alcohol</p>')
    if view["ingredients"]:
        parts.append("  <h3>Ingredients</h3>")
        parts.append(list_html("ul", view["ingredients"]))
    if view["method"]:
        parts.append("  <h3>Method</h3>")
        parts.append(list_html("ol", view["method"]))
    if view["proTip"]:
        parts.append("  <h3>Note</h3>")
        parts.append(f'  <p class="note">{escape(view["proTip"])}</p>')
    if view["serve"]:
        parts.append("  <h3>Serve</h3>")
        parts.append(f'  <p class="note">{escape(view["serve"])}</p>')
    parts.append("</section>")
    return "\n".join(parts)


def photo_jpeg(src: str) -> tuple[str, bytes] | None:
    path = ROOT / src
    if not path.is_file():
        return None
    im = Image.open(path).convert("RGB")
    im.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
    name = Path(src).stem.replace(" ", "-") + ".jpg"
    return name, jpeg_bytes(im, quality=78)


def main() -> None:
    book = json.loads(BOOK_JSON.read_text())
    overlays = json.loads(COPY_JSON.read_text())
    chapters = book["chapters"]
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    cover_bytes = build_cover(PHOTOS / "cappuccino.webp")
    images: dict[str, bytes] = {"cover.jpg": cover_bytes}

    chapter_files: list[tuple[str, str, str, list[tuple[str, str]]]] = []
    for chapter in chapters:
        views = [recipe_view(r, overlays.get(r["id"], {})) for r in chapter["recipes"]]
        blocks = []
        toc_items = []
        for view in views:
            image_name = None
            if view["photo"]:
                packed = photo_jpeg(view["photo"])
                if packed:
                    image_name, data = packed
                    images[image_name] = data
            blocks.append(recipe_html(view, image_name))
            toc_items.append((view["id"], view["title"]))
        href = f"ch-{chapter['id']}.xhtml"
        body = (
            f'<p class="kicker">{escape(chapter["title"])}</p>\n'
            f"<h1>{escape(chapter['title'])}</h1>\n"
            + "\n".join(blocks)
        )
        chapter_files.append((href, chapter["title"], xhtml(chapter["title"], body), toc_items))

    cover_xhtml = xhtml(
        TITLE,
        '  <div class="cover-page">\n'
        f'    <img src="images/cover.jpg" alt="{escape(TITLE)} — {escape(CREATOR)}"/>\n'
        "  </div>",
    )
    title_xhtml = xhtml(
        TITLE,
        "  <p class=\"kicker\">Peter Hernou</p>\n"
        f"  <h1>{escape(TITLE)}</h1>\n"
        "  <p>Every drink, worked through.</p>\n"
        f"  <p class=\"yield\">{DRINKS} recipes · method · serve</p>\n"
        "  <p>World Champion Latte Art.</p>\n"
        f"  <p>© {YEAR} {escape(CREATOR)}. All rights reserved.</p>\n"
        "  <p>Digital edition for reading on screens and in ebook stores. "
        "The page-turning edition lives at peterhernou.com.</p>",
    )
    about_xhtml = xhtml(
        "How to read this book",
        "  <p class=\"kicker\">Inside every drink</p>\n"
        "  <h1>Not just a recipe. A fully worked drink.</h1>\n"
        "  <p>Twenty years of bar knowledge, written so you can pour from it. "
        "Ingredients, method, a short note, and how to serve. "
        f"House rules, not laws. {DRINKS} drinks, one collection.</p>\n"
        "  <h2>Espresso</h2>\n"
        "  <p>The house shot is 30–35 ml. Ristretto is shorter, 18–22 ml. "
        "Grind on demand. Distribute, level the puck and tamp straight. "
        "Time is a check, not a pass or fail.</p>\n"
        "  <h2>Milk</h2>\n"
        "  <p>Steam to 60–65°C into glossy microfoam — not a dry cap. "
        "Without a wand: warm, froth briefly, tap, swirl, pour while glossy.</p>\n"
        "  <h2>Cold</h2>\n"
        "  <p>Hard ice. Espresso last, directly over the ice. "
        "An iced latte is cold milk and ice first, then the shot.</p>\n"
        "  <h2>Before this book</h2>\n"
        "  <p>Latte Arte was named Best Coffee Book in the World, Gourmand Award, 2012. "
        "This Coffee Book continues that line: the warmth of the cup, coffee with milk, "
        "and the vision behind every drink.</p>",
    )

    toc_lis = []
    ncx_points = []
    play = 1
    toc_lis.append("        <li><a href=\"cover.xhtml\">Cover</a></li>")
    toc_lis.append("        <li><a href=\"title.xhtml\">Title</a></li>")
    toc_lis.append("        <li><a href=\"about.xhtml\">How to read this book</a></li>")
    for href, title, _, recipes in chapter_files:
        kids = "\n".join(
            f'            <li><a href="{href}#{rid}">{escape(rtitle)}</a></li>'
            for rid, rtitle in recipes
        )
        toc_lis.append(
            f'        <li><a href="{href}">{escape(title)}</a>\n'
            f"          <ol>\n{kids}\n          </ol>\n        </li>"
        )
        ncx_points.append(
            f'    <navPoint id="navPoint-{play}" playOrder="{play}">\n'
            f"      <navLabel><text>{escape(title)}</text></navLabel>\n"
            f'      <content src="{href}"/>\n'
            "    </navPoint>"
        )
        play += 1

    nav_xhtml = xhtml(
        "Contents",
        "  <nav epub:type=\"toc\" id=\"toc\">\n"
        f"    <h1>{escape(TITLE)}</h1>\n"
        f"    <ol>\n{chr(10).join(toc_lis)}\n    </ol>\n"
        "  </nav>\n"
        "  <nav epub:type=\"landmarks\" hidden=\"hidden\">\n"
        "    <ol>\n"
        '      <li><a epub:type="cover" href="cover.xhtml">Cover</a></li>\n'
        '      <li><a epub:type="toc" href="nav.xhtml">Contents</a></li>\n'
        '      <li><a epub:type="bodymatter" href="about.xhtml">Start</a></li>\n'
        "    </ol>\n"
        "  </nav>",
    )

    ncx = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n'
        "  <head>\n"
        f'    <meta name="dtb:uid" content="{escape(BOOK_ID)}"/>\n'
        '    <meta name="dtb:depth" content="2"/>\n'
        '    <meta name="dtb:totalPageCount" content="0"/>\n'
        '    <meta name="dtb:maxPageNumber" content="0"/>\n'
        "  </head>\n"
        "  <docTitle>\n"
        f"    <text>{escape(TITLE)}</text>\n"
        "  </docTitle>\n"
        "  <navMap>\n"
        + "\n".join(ncx_points)
        + "\n  </navMap>\n"
        "</ncx>\n"
    )

    manifest = [
        '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        '    <item id="css" href="css/book.css" media-type="text/css"/>',
        '    <item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>',
        '    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
        '    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>',
        '    <item id="about" href="about.xhtml" media-type="application/xhtml+xml"/>',
    ]
    spine = [
        '    <itemref idref="cover"/>',
        '    <itemref idref="title"/>',
        '    <itemref idref="nav"/>',
        '    <itemref idref="about"/>',
    ]
    for href, title, _, _ in chapter_files:
        cid = Path(href).stem
        manifest.append(f'    <item id="{cid}" href="{href}" media-type="application/xhtml+xml"/>')
        spine.append(f'    <itemref idref="{cid}"/>')
    for name in sorted(n for n in images if n != "cover.jpg"):
        iid = "img-" + Path(name).stem
        manifest.append(f'    <item id="{iid}" href="images/{name}" media-type="image/jpeg"/>')

    opf = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" '
        'unique-identifier="bookid" xml:lang="en">\n'
        '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        f'    <dc:identifier id="bookid">{escape(BOOK_ID)}</dc:identifier>\n'
        f"    <dc:title>{escape(TITLE)}</dc:title>\n"
        f'    <dc:creator id="creator">{escape(CREATOR)}</dc:creator>\n'
        '    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>\n'
        f"    <dc:publisher>{escape(PUBLISHER)}</dc:publisher>\n"
        f"    <dc:language>{LANG}</dc:language>\n"
        f"    <dc:date>{YEAR}</dc:date>\n"
        f"    <dc:description>{escape(DESCRIPTION + ' ' + LENGTH_LINE)}</dc:description>\n"
        f"    <dc:rights>All rights reserved. {escape(CREATOR)}, {YEAR}.</dc:rights>\n"
        '    <dc:subject>Coffee</dc:subject>\n'
        '    <dc:subject>Cooking / Beverages / Coffee &amp; Tea</dc:subject>\n'
        f'    <meta property="dcterms:modified">{modified}</meta>\n'
        '    <meta name="cover" content="cover-image"/>\n'
        "  </metadata>\n"
        "  <manifest>\n"
        + "\n".join(manifest)
        + "\n  </manifest>\n"
        '  <spine toc="ncx">\n'
        + "\n".join(spine)
        + "\n  </spine>\n"
        "  <guide>\n"
        f'    <reference type="cover" title="Cover" href="cover.xhtml"/>\n'
        '    <reference type="toc" title="Contents" href="nav.xhtml"/>\n'
        "  </guide>\n"
        "</package>\n"
    )

    members: list[tuple[str, bytes, int]] = [
        ("mimetype", b"application/epub+zip", zipfile.ZIP_STORED),
        ("META-INF/container.xml", CONTAINER.encode("utf-8"), zipfile.ZIP_DEFLATED),
        ("OEBPS/css/book.css", CSS.encode("utf-8"), zipfile.ZIP_DEFLATED),
        ("OEBPS/content.opf", opf.encode("utf-8"), zipfile.ZIP_DEFLATED),
        ("OEBPS/toc.ncx", ncx.encode("utf-8"), zipfile.ZIP_DEFLATED),
        ("OEBPS/nav.xhtml", nav_xhtml.encode("utf-8"), zipfile.ZIP_DEFLATED),
        ("OEBPS/cover.xhtml", cover_xhtml.encode("utf-8"), zipfile.ZIP_DEFLATED),
        ("OEBPS/title.xhtml", title_xhtml.encode("utf-8"), zipfile.ZIP_DEFLATED),
        ("OEBPS/about.xhtml", about_xhtml.encode("utf-8"), zipfile.ZIP_DEFLATED),
    ]
    for href, _, doc, _ in chapter_files:
        members.append((f"OEBPS/{href}", doc.encode("utf-8"), zipfile.ZIP_DEFLATED))
    for name, data in images.items():
        members.append((f"OEBPS/images/{name}", data, zipfile.ZIP_DEFLATED))

    out = DESKTOP / EPUB_NAME
    tmp = out.with_suffix(".epub.partial")
    with zipfile.ZipFile(tmp, "w") as zf:
        for name, data, compress in members:
            info = zipfile.ZipInfo(name)
            info.compress_type = compress
            info.external_attr = 0o644 << 16
            zf.writestr(info, data)
    tmp.replace(out)
    (DESKTOP / COVER_NAME).write_bytes(cover_bytes)
    (DESKTOP / DESC_NAME).write_text(DESCRIPTION + "\n\n" + LENGTH_LINE + "\n", encoding="utf-8")
    mb = out.stat().st_size / (1024 * 1024)
    print(f"wrote {out} ({mb:.1f} MB, {len(chapter_files)} chapters, {len(images)} images)")
    print("wrote", DESKTOP / COVER_NAME)
    print("wrote", DESKTOP / DESC_NAME)
    if mb >= 90:
        raise SystemExit("EPUB is over D2D’s 90 MB limit")


if __name__ == "__main__":
    main()
