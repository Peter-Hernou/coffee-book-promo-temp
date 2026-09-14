# Coffee Book flipbook

Standalone page-turning Coffee Book, **outside** phmenu.studio, built from the same recipe library.

Peter Hernou’s home recipes — ingredients, method, serve notes and drink photographs — as a digital book: cover, chapters, photo plates, recipe pages, and A–Z index. Online reader plus a Draft2Digital EPUB. No print edition from this file.

## Open it

```bash
npm start
```

Then open [http://127.0.0.1:4177](http://127.0.0.1:4177).

Click the cover, use the arrows, or the keyboard (`←` `→`). Contents searches every drink.

## Refresh from the studio

When recipes or photos change in `/Users/ph/Desktop/phmenu.studio`:

```bash
npm run extract
```

Override the studio path with `STUDIO_ROOT=/path/to/phmenu.studio npm run extract`.

The extract copies only the reading copy of each recipe (no costing, no venue standards) plus the drink photos that actually map to a recipe.

## What’s in the book

- Cover and title pages
- 12 coffee chapters from the studio catalogue
- One plate + one method page per drink
- Allergen chips and alcohol marks as kitchen guidance, not a safety guarantee
- Draft2Digital package: `python3 tools/build-d2d-epub.py` writes the EPUB, cover JPEG and sales description to the Desktop
