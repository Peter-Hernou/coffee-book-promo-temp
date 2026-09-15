#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const STUDIO = process.env.STUDIO_ROOT
  ? path.resolve(process.env.STUDIO_ROOT)
  : path.resolve(ROOT, '../phmenu.studio');

const FAMILY_CHAPTER = {
  espresso: 'Espresso Based',
  long_espresso: 'Espresso Based',
  milk_coffee: 'Milk Coffees',
  mocha: 'Coffee & Chocolate',
  'dessert coffee': 'Coffee & Chocolate',
  brewed: 'Brewed Coffee',
  cold: 'Cold & Blended',
  carbonated: 'Modern specialty & spritz',
  cocktail: 'Coffee cocktails',
  hot_alcohol: 'Alcohol coffee classics',
};

function read(rel) {
  return fs.readFileSync(path.join(STUDIO, rel), 'utf8');
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractBlock(src, startNeedle, endNeedle) {
  const start = src.indexOf(startNeedle);
  const end = src.indexOf(endNeedle, start);
  if (start < 0 || end < 0) {
    throw new Error(`Block not found: ${startNeedle} … ${endNeedle}`);
  }
  return src.slice(start, end);
}

function loadSectionSpecs(src) {
  const block = extractBlock(src, '  var RECIPE_SECTION_SPECS = [', '  var SECTION_FORMAT_BASE_ORDER = {');
  return new Function(`${block}; return RECIPE_SECTION_SPECS;`)();
}

function loadSectionOrder(src) {
  const block = extractBlock(src, '  var SECTION_FORMAT_BASE_ORDER = {', '  var FORMAT_BASE_ORDER_MAPS = new Map(');
  return new Function(`${block}; return SECTION_FORMAT_BASE_ORDER;`)();
}

function loadPhotos() {
  const src = read('b2c-drink-photos.js');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'b2c-drink-photos.js' });
  const api = sandbox.window.B2C_DRINK_PHOTOS;
  if (!api) throw new Error('B2C_DRINK_PHOTOS missing');
  return api;
}

function espressoLine(recipe) {
  const hints = recipe && recipe.calcHints && typeof recipe.calcHints === 'object' ? recipe.calcHints : {};
  const shots = Number(hints.espresso_shots) || 0;
  if (shots <= 0) return '';
  const family = String(recipe.recipeFamily || '').toLowerCase();
  const name = String(recipe.soberName || recipe.richName || '').toLowerCase();
  const tags = new Set((Array.isArray(recipe.tags) ? recipe.tags : []).map((t) => String(t || '').toLowerCase()));
  if (family === 'cocktail' || family === 'hot_alcohol') return '';
  if (recipe.containsAlcohol && tags.has('alcohol') && !tags.has('milk')) return '';
  if (name.includes('doppio ristretto') || name.includes('ristretto doppio')) {
    return 'Espresso standard: 36–44 ml fresh double ristretto.';
  }
  if (name.includes('ristretto')) return 'Espresso standard: 18–22 ml fresh ristretto.';
  if (shots >= 2) return 'Espresso standard: 60–70 ml fresh double espresso.';
  return 'Espresso standard: 30–35 ml fresh espresso.';
}

function ingredientLines(recipe) {
  const b2c = Array.isArray(recipe.b2cIngredients)
    ? recipe.b2cIngredients.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  if (b2c.length) return b2c;
  const home = Array.isArray(recipe.homeIngredients)
    ? recipe.homeIngredients.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  if (home.length) return home;
  return (Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .map((line) => {
      if (typeof line === 'string') return line.trim();
      const name = String((line && (line.name || line.ingredientName)) || '').trim();
      if (!name) return '';
      if (line.yield_ref && line.range) return `${name} — ${line.range}`;
      const qty = line.qty != null && String(line.qty).trim() !== '' ? String(line.qty).trim() : '';
      const unit = String((line && line.unit) || '').trim();
      if (qty && unit) return `${name} — ${qty} ${unit}`;
      if (qty) return `${name} — ${qty}`;
      if (line.range) return `${name} — ${line.range}`;
      return name;
    })
    .filter(Boolean);
}

function methodSteps(recipe) {
  const home = Array.isArray(recipe.homeMethod) ? recipe.homeMethod.map((s) => String(s || '').trim()).filter(Boolean) : [];
  if (home.length) return { title: 'How to make it at home', steps: home };
  const method = Array.isArray(recipe.method) ? recipe.method.map((s) => String(s || '').trim()).filter(Boolean) : [];
  return { title: 'How to make it', steps: method };
}

function slug(value) {
  return norm(value).replace(/\s+/g, '-') || 'drink';
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function localPhoto(api, recipeLike, destDir, used) {
  const photo = api.resolveB2cDrinkPhoto(recipeLike);
  if (!photo || !photo.src) return null;
  const rel = String(photo.src).replace(/^\.\//, '').split('?')[0];
  const from = path.join(STUDIO, rel);
  if (!fs.existsSync(from)) return null;
  const key = path.basename(rel);
  const destRel = `photos/${key}`;
  if (!used.has(destRel)) {
    copyFile(from, path.join(destDir, key));
    used.add(destRel);
  }
  return {
    src: destRel,
    alt: photo.alt || recipeLike.soberName || '',
    position: photo.position || '50% 52%',
    aspect: photo.aspect || null,
    exact: photo.matchTier === 'exact',
  };
}

function localCategoryHero(api, category, destDir, used) {
  const photo = api.resolveB2cCategoryHero(category);
  if (!photo || !photo.src) return null;
  const rel = String(photo.src).replace(/^\.\//, '').split('?')[0];
  const from = path.join(STUDIO, rel);
  if (!fs.existsSync(from)) return null;
  const key = path.basename(rel);
  const destRel = `photos/${key}`;
  if (!used.has(destRel)) {
    copyFile(from, path.join(destDir, key));
    used.add(destRel);
  }
  return { src: destRel, alt: photo.alt || category, position: photo.position || '50% 50%' };
}

function assignCategory(name, recipe, baseToCategory) {
  const keys = [name, recipe.soberName, recipe.richName].map(norm).filter(Boolean);
  for (const key of keys) {
    if (baseToCategory.has(key)) return baseToCategory.get(key);
  }
  if (/^peter/.test(norm(name))) return "Peter's Specials";
  if (/hot chocolate|drinking chocolate|cacao/.test(norm(`${name} ${recipe.soberName || ''} ${recipe.richName || ''}`))) {
    return 'Coffee & Chocolate';
  }
  return FAMILY_CHAPTER[String(recipe.recipeFamily || '').toLowerCase()] || 'Other';
}

function sortKey(orderList, name) {
  const n = norm(name);
  const idx = orderList.findIndex((item) => norm(item) === n);
  return idx < 0 ? 1000 + n : idx;
}

function main() {
  if (!fs.existsSync(path.join(STUDIO, 'recipes.json'))) {
    throw new Error(`Studio recipes not found at ${STUDIO}`);
  }

  const recipes = JSON.parse(read('recipes.json'));
  const scriptSrc = read('script.src.js');
  const specs = loadSectionSpecs(scriptSrc);
  const orderMap = loadSectionOrder(scriptSrc);
  const photos = loadPhotos();
  const chapterOrder = specs.map((s) => s.category);

  const baseToCategory = new Map();
  for (const spec of specs) {
    for (const base of spec.bases || []) {
      const key = norm(base);
      if (key && !baseToCategory.has(key)) baseToCategory.set(key, spec.category);
    }
  }

  const photoDir = path.join(ROOT, 'photos');
  fs.rmSync(photoDir, { recursive: true, force: true });
  fs.mkdirSync(photoDir, { recursive: true });
  const usedPhotos = new Set();

  const grouped = new Map(chapterOrder.concat(['Other']).map((cat) => [cat, []]));

  for (const [name, recipe] of Object.entries(recipes)) {
    if (String(recipe.recipeFamily || '').toLowerCase() === 'food') continue;
    const category = assignCategory(name, recipe, baseToCategory);
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push({ name, recipe });
  }

  const chapters = [];
  let recipeCount = 0;
  let photoCount = 0;

  for (const title of [...chapterOrder, 'Other']) {
    const items = grouped.get(title) || [];
    if (!items.length) continue;
    const orderList = orderMap[title] || items.map((x) => x.name);
    items.sort((a, b) => {
      const d = sortKey(orderList, a.name) - sortKey(orderList, b.name);
      if (d) return d;
      return String(a.recipe.richName || a.name).localeCompare(String(b.recipe.richName || b.name), 'en', {
        sensitivity: 'base',
      });
    });

    const hero = localCategoryHero(photos, title, photoDir, usedPhotos);
    const chapterRecipes = items.map(({ name, recipe }) => {
      const method = methodSteps(recipe);
      const photo = localPhoto(
        photos,
        {
          stem: recipe.soberName || name,
          soberName: recipe.soberName || name,
          name,
          base: recipe.soberName || name,
          richName: recipe.richName,
        },
        photoDir,
        usedPhotos
      );
      if (photo) photoCount += 1;
      recipeCount += 1;
      return {
        id: slug(recipe.soberName || name),
        stem: recipe.soberName || name,
        title: String(recipe.richName || recipe.soberName || name).trim(),
        description: String(recipe.b2cDescription || recipe.shortDescription || '').trim(),
        espresso: espressoLine(recipe),
        setup: String(recipe.homeSetup || '').trim(),
        ingredients: ingredientLines(recipe),
        methodTitle: method.title,
        method: method.steps,
        proTip: String(recipe.proTip || '').trim(),
        serve: String(recipe.serving || recipe.b2cServeCue || '').trim(),
        allergens: Array.isArray(recipe.allergens) ? recipe.allergens.map((x) => String(x || '').trim()).filter(Boolean) : [],
        containsAlcohol: !!recipe.containsAlcohol,
        containsCaffeine: recipe.containsCaffeine !== false,
        photo,
      };
    });

    chapters.push({
      id: slug(title),
      title,
      hero,
      recipes: chapterRecipes,
    });
  }

  const fontDir = path.join(ROOT, 'fonts');
  fs.mkdirSync(fontDir, { recursive: true });
  for (const font of [
    'instrument-serif-400.woff2',
    'instrument-serif-400-italic.woff2',
    'inter-latin.woff2',
    'syne-600.woff2',
    'syne-700.woff2',
  ]) {
    const from = path.join(STUDIO, 'assets/fonts', font);
    if (fs.existsSync(from)) copyFile(from, path.join(fontDir, font));
  }

  const book = {
    title: 'Coffee Book',
    subtitle: 'Fully worked drinks for home',
    author: 'Peter Hernou',
    studio: 'phmenu.studio',
    extractedAt: new Date().toISOString().slice(0, 10),
    recipeCount,
    photoCount,
    chapterCount: chapters.length,
    chapters,
  };

  const dataDir = path.join(ROOT, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'book.json'), JSON.stringify(book, null, 2));

  console.log(`Extracted ${recipeCount} recipes in ${chapters.length} chapters (${photoCount} photos) from ${STUDIO}`);
}

main();
