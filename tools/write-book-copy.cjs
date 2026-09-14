#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const book = JSON.parse(fs.readFileSync(path.join(root, "data/book.json"), "utf8"));
const existing = JSON.parse(fs.readFileSync(path.join(root, "data/page-copy.json"), "utf8"));

const PUCK = "Grind on demand. Distribute, level the puck and tamp straight.";
const NO_WAND =
  "No steam wand: warm the milk to 60–65°C, froth 10–20 seconds, tap, swirl and pour while glossy.";
const STEAM_LATTE = "While the shot runs, steam milk to 60–65°C into glossy, pourable microfoam — not a dry cap.";
const STEAM_CAP =
  "While the shot runs, steam milk to 60–65°C into dense, glossy cappuccino foam. Keep a cap, not peaks.";
const STEAM_CORTADO = "While the shot runs, steam milk to 60–65°C with only light microfoam.";
const STEAM_FLAT =
  "While the shot runs, steam milk to 60–65°C with very little air: glossy, pourable microfoam, not cappuccino foam.";
const STEAM_MOCHA = "While the shot runs, steam milk to 60–65°C until glossy and creamy, not dry foam.";

function firstSentence(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  const match = value.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1] : value;
}

function bookDesc(text) {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  t = t.replace(/\s*—\s*/g, " — ");
  const parts = t.split(" — ");
  if (parts[0] && parts[0].length >= 24 && parts[0].length <= 130) {
    return parts[0].replace(/[,;:]$/, "") + ".";
  }
  return firstSentence(t).replace(/\.{2,}$/, ".");
}

function tidyIng(line) {
  return String(line || "")
    .replace(/\s*\([^)]*(verify|supplier|gluten|soy lecithin|trace status)[^)]*\)/gi, "")
    .replace(/Coffee beans — dose varies by basket; not a universal gram value/gi, "Coffee, espresso dose")
    .replace(/Coffee beans — (\d+[–\d]* g)[^,]*/gi, "Coffee, $1")
    .replace(/Water \(filtered or bottled\) — /gi, "Water, ")
    .replace(/Filtered water — /gi, "Water, ")
    .replace(/Hard ice cubes — (\d+[–\d]* ml)/gi, "Hard ice, $1")
    .replace(/; enough to chill and serve; use fresh hard ice, not soft or wet ice/gi, "")
    .replace(/Whole milk — /gi, "Whole milk, ")
    .replace(/Tonic water \(chilled carbonated quinine mixer\) — /gi, "Tonic, ")
    .replace(/Soda water \(chilled carbonated water\) — /gi, "Soda water, ")
    .replace(/Sugar syrup \(1:1 simple syrup\) — /gi, "Sugar syrup, ")
    .replace(/Coffee liqueur \(sweet coffee-flavoured liqueur\) — /gi, "Coffee liqueur, ")
    .replace(/Sweet vermouth \(red fortified wine aperitif\) — /gi, "Sweet vermouth, ")
    .replace(/Coffee bitters \(aromatic cocktail bitters\) — /gi, "Coffee bitters, ")
    .replace(/Orange bitters \(cocktail bitters\) — /gi, "Orange bitters, ")
    .replace(/Cream \(whipping cream, used softly whipped or floated as stated\) — /gi, "Cream, ")
    .replace(/Dark chocolate pieces\/callets \(60–70% real chocolate;? ?\) — /gi, "Dark chocolate, ")
    .replace(/Dark chocolate pieces\/callets — /gi, "Dark chocolate, ")
    .replace(/White chocolate pieces\/callets \(real white chocolate;? ?\) — /gi, "White chocolate, ")
    .replace(/White chocolate pieces\/callets — /gi, "White chocolate, ")
    .replace(/Milk chocolate pieces\/callets \(real chocolate;? ?\) — /gi, "Milk chocolate, ")
    .replace(/Unsweetened cocoa powder for dusting — /gi, "Cocoa, for dusting, ")
    .replace(/Milk or tested plant-based milk/gi, "Milk")
    .replace(/ or plant-based whipping cream/gi, "")
    .replace(/callets or ground white chocolate/gi, "")
    .replace(/ or oat-based ice cream/gi, "")
    .replace(/ — /g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+—\s*$/g, "")
    .replace(/,\s*$/g, "")
    .trim();
}

function pullMl(recipe) {
  const e = String(recipe.espresso || "");
  const m = e.match(/(\d+–\d+\s*ml)/);
  if (m) return m[1];
  const joined = (recipe.method || []).join(" ");
  const m2 = joined.match(/(\d+–\d+)\s*ml/);
  return m2 ? m2[1] + " ml" : "30–35 ml";
}

function isDouble(recipe) {
  return /double espresso|60–70 ml/i.test(String(recipe.espresso || "") + (recipe.method || []).join(" "));
}

function pullStep(recipe) {
  if (isDouble(recipe) && !/ristretto/i.test(recipe.id + recipe.title)) {
    return `Pull ${pullMl(recipe)} — a double.`;
  }
  if (/ristretto/i.test(recipe.id) || /18–22/.test(recipe.espresso || "")) {
    return `Pull ${pullMl(recipe)}. Stop while the stream is still syrupy.`;
  }
  return `Pull ${pullMl(recipe)}.`;
}

function yieldFrom(recipe, extra) {
  if (extra) return extra;
  const e = String(recipe.espresso || "")
    .replace(/^Espresso standard:\s*/i, "")
    .replace(/\.$/, "");
  if (e) return e;
  return ings(recipe).slice(0, 3).join(" · ");
}

function tipOf(recipe, fallback) {
  let t = firstSentence(recipe.proTip || fallback || "");
  t = t
    .replace(/Brew espresso fresh, then cool it immediately before[^.]+/gi, "")
    .replace(/Train front-of-house:\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (t.length > 180) t = t.slice(0, 177).replace(/\s+\S*$/, "") + ".";
  return t;
}

function serveOf(recipe, fallback) {
  let t = String(recipe.serve || fallback || "")
    .replace(/Serve cold, kept cold and served immediately\.?/i, "Serve cold, at once.")
    .replace(/Serve cold, not after waiting too long\.?/i, "Serve cold, at once.")
    .replace(/never held or reheated/gi, "at once")
    .replace(/;\s*Serve /g, "; serve ")
    .trim();
  t = firstSentence(t);
  if (t.length > 140) t = t.slice(0, 137).replace(/\s+\S*$/, "") + ".";
  return t;
}

function ings(recipe) {
  return (recipe.ingredients || []).map(tidyIng).filter(Boolean);
}

function overlay(recipe, fields) {
  return {
    description: fields.description || bookDesc(recipe.description),
    yield: fields.yield || yieldFrom(recipe),
    ingredients: fields.ingredients || ings(recipe),
    method: fields.method,
    proTip: fields.proTip || tipOf(recipe),
    serve: fields.serve || serveOf(recipe),
  };
}

function milkSteam(recipe) {
  const id = recipe.id;
  if (/cappuccino/.test(id) && !/freddo|cold-foam/.test(id)) return STEAM_CAP;
  if (/flat-white|flat white/.test(id)) return STEAM_FLAT;
  if (/cortado|piccolo|gibraltar|galao/.test(id)) return STEAM_CORTADO;
  if (/mocha|chocolate-cappuccino/.test(id)) return STEAM_MOCHA;
  return STEAM_LATTE;
}

function espressoMilkMethod(recipe, extras = []) {
  const steps = [PUCK, pullStep(recipe), ...extras, milkSteam(recipe), NO_WAND, "Pour the milk into the coffee. Serve at once."];
  return steps.filter(Boolean);
}

function flavouredLatte(recipe, flavourStep) {
  return overlay(recipe, {
    method: espressoMilkMethod(recipe, [flavourStep]),
  });
}

function mochaDesc(recipe) {
  const t = String(recipe.description || "");
  if (/white chocolate/i.test(t) || /white-chocolate|raspberry-white/i.test(recipe.id)) {
    return "White chocolate and espresso, folded through steamed milk.";
  }
  if (/gianduja/i.test(t) || /gianduja/i.test(recipe.id)) {
    return "Gianduja and espresso, folded through steamed milk.";
  }
  return "Espresso and dark chocolate, folded through steamed milk.";
}

function mochaMethod(recipe, extra) {
  const choc = extra || "Dark chocolate in the cup. Pour the shot over. Stir until glossy. No chocolate left on the bottom.";
  return overlay(recipe, {
    description: mochaDesc(recipe),
    method: [PUCK, pullStep(recipe), choc, milkSteam(recipe), NO_WAND, "Pour the milk into the chocolate base. Serve at once."],
  });
}

function icedEspressoLast(recipe, beforeShot) {
  return overlay(recipe, {
    method: [
      "Hard ice in a chilled glass.",
      beforeShot,
      PUCK,
      pullStep(recipe),
      "Pour the shot last, directly over the ice.",
      "Serve at once.",
    ].filter(Boolean),
    proTip: tipOf(recipe, "Espresso last, over the ice. Warm coffee on weak ice is not the drink."),
    serve: serveOf(recipe, "Chilled glass over full ice. Serve at once."),
  });
}

function shakenEspresso(recipe, prep) {
  return overlay(recipe, {
    yield: "Fresh espresso, shaken cold",
    method: [
      "Chill the glass. Hard ice in the shaker.",
      prep,
      PUCK,
      pullStep(recipe) + " Add it last, while it is still aromatic.",
      "Shake hard 10–15 seconds. Fine-strain.",
      "Serve at once.",
    ].filter(Boolean),
  });
}

function irishStyle(recipe, spiritLine) {
  return overlay(recipe, {
    yield: "Hot coffee, spirit, floated cream",
    method: [
      "Warm the glass, then empty it.",
      spiritLine,
      "Sugar in. A splash of hot coffee. Stir until smooth.",
      PUCK,
      "Pull 30–35 ml, or a fresh hot brew. Pour into the glass.",
      "Softly whipped cream, floated. Do not stir it in. Serve at once.",
    ],
    proTip: tipOf(recipe, "The guest drinks through the cream, not through a stirred cup."),
  });
}

function brewBed(grind) {
  return `Grind on demand to ${grind}. Rinse, preheat, dose even, level the bed.`;
}

const byId = {};

function brewed() {
  const recipes = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
  const b = (id) => recipes[id];

  byId["drip-coffee"] = overlay(b("drip-coffee"), {
    description: "Automatic drip. Bright acidity, clear sweetness, a smooth body.",
    yield: "17 g coffee, 250 ml water",
    method: [
      brewBed("drip"),
      "Start the brewer. The bed should wet evenly, not tunnel down one side.",
      "Target 4:00–6:00. Too fast is thin; too slow is dry.",
      "Time is a check. Taste, then change grind or dose.",
      "Serve fresh. Do not hold past the house window.",
    ],
  });
  byId["filter-coffee"] = overlay(b("filter-coffee"), {
    description: "Paper filter. A clean cup, bright acidity, a tea-like finish when grind and drawdown line up.",
    yield: "17 g coffee, 250 ml water",
    method: [
      brewBed("filter"),
      "Bloom 30–45 seconds until the bed is wet.",
      "Pour in pulses. Keep the bed level.",
      "Target 2:45–4:00 for a 250–320 ml cup.",
      "Serve at once, while the aroma is clean.",
    ],
  });
  byId["batch-brew"] = overlay(b("batch-brew"), {
    description: "Batch filter for volume. Same ratio, even extraction, a bright filter cup at café scale.",
    yield: "16 g coffee, 250 ml water",
    method: [
      brewBed("batch-filter"),
      "Start the batch. The spray should wet the bed evenly in the first minute.",
      "Target 4:00–6:00. Change grind before you change the ratio.",
      "Serve within the house window. Discard coffee that tastes hollow or baked.",
    ],
  });
  byId["pour-over-coffee"] = overlay(b("pour-over-coffee"), {
    description: "Manual filter. Clear aromatics, bright acidity, a light body when the pour is controlled.",
    yield: "22 g coffee, 220 ml water",
    method: [
      brewBed("pour-over"),
      "Bloom 30–45 seconds.",
      "Pour in calm pulses or a steady spiral. Keep the bed level.",
      "Target 2:45–3:45 for a 250–320 ml cup.",
      "Serve at once. Do not hold the brew.",
    ],
  });
  byId["chemex"] = overlay(b("chemex"), {
    description: "Chemex — exceptional clarity, floral highs, a clean sweet finish. Thicker paper, slower drawdown.",
    yield: "18 g coffee, 300 ml water",
    method: [
      "Grind on demand to a medium-coarse Chemex grind. Preheat, dose even, level the bed.",
      "Rinse the thick paper thoroughly.",
      "Bloom 35–45 seconds. Pour in wide, calm spirals.",
      "Target 4:00–5:30. Swirl the carafe.",
      "Serve while the clarity is still high.",
    ],
  });
  byId["aeropress"] = overlay(b("aeropress"), {
    description: "Immersion and a short press. Full body, low bitterness, a bright cup.",
    yield: "16 g coffee, 220 ml water",
    method: [
      brewBed("AeroPress"),
      "Add water. Stir only to wet the grounds. Steep 1:30–2:30.",
      "Press steadily 20–30 seconds. Do not force the plunger.",
      "Serve at once. Bypass with water only if the house recipe is a longer cup.",
    ],
  });
  byId["french-press"] = overlay(b("french-press"), {
    description: "Full immersion. Heavy body, rustic texture, oils in the cup — not trapped in paper.",
    yield: "18 g coffee, 280 ml water",
    method: [
      brewBed("a coarse press grind"),
      "Water on. Saturate the grounds. Steep 4:00.",
      "Break the crust. Press slowly.",
      "Decant at once. The pot is not a holding vessel.",
    ],
  });
  byId["moka-pot"] = overlay(b("moka-pot"), {
    description: "Stovetop pressure. Dense, espresso-like intensity without the machine. A small Italian cup.",
    yield: "17 g coffee, 170 ml water",
    method: [
      "Grind on demand to moka. Hot water in the base, to the valve. Dose the basket even. Do not tamp.",
      "Medium heat. The coffee should flow steadily, not spurt.",
      "About 3:00–5:00 from heat-on. Off the heat before the bitter sputter.",
      "Serve at once. Moka is pressure-assisted coffee, not espresso.",
    ],
  });
  byId["flash-chilled-coffee"] = overlay(b("flash-chilled-coffee"), {
    description: "Hot filter, flash-chilled over ice. Japanese-style clarity, cold in the glass.",
    yield: "17 g coffee, 250 ml water, over ice",
    method: [
      brewBed("filter"),
      "A planned hot-water-to-ice split. Brew the stronger hot filter directly over measured hard ice.",
      "Target 2:45–3:45 hot drawdown. Swirl once so the ice melts and chills the brew.",
      "Pour over fresh hard ice if needed. Serve at once.",
    ],
  });
  byId["iced-filter-coffee"] = overlay(b("iced-filter-coffee"), {
    description: "Filter over ice. Bright, clean, refreshing — brew strong so dilution stays in control.",
    yield: "17 g coffee, 250 ml water, over ice",
    method: [
      brewBed("filter"),
      "Brew a stronger hot filter directly over measured hard ice. Target 2:45–3:45.",
      "Do not pour warm coffee over weak service ice.",
      "Serve cold, over hard ice.",
    ],
  });
  byId["cold-brew-coffee"] = overlay(b("cold-brew-coffee"), {
    description: "A 12–18 hour cold steep. Low acid, round sweetness, cocoa and nut in the cup.",
    yield: "72 g coffee, 240 ml water",
    method: [
      "Grind on demand, coarse. Coffee and cold water, fully wet. Cover. Steep cold 12–18 hours.",
      "Filter clean. No grit in the glass.",
      "A house rapid extraction is fine if it tastes against the long steep.",
      "Dilute to drinking strength. Hard ice, or neat if they want it stronger.",
    ],
  });
  byId["nitro-cold-brew"] = overlay(b("nitro-cold-brew"), {
    description: "Cold brew with nitrogen. Cascading crema, a creamy mouthfeel, extra sweetness without milk.",
    yield: "72 g coffee, 240 ml water, nitro",
    method: [
      "Grind on demand, coarse. Cold brew base: 12–18 hours, or a house rapid extraction tasted against the long steep.",
      "Filter carefully. No fines in the keg.",
      "Chill fully. Charge or pour through nitro until the cascade and head appear.",
      "Serve cold. Ice only if the tap is not cold enough.",
    ],
  });
  byId["cold-brew-tonic"] = overlay(b("cold-brew-tonic"), {
    description: "Cold brew over tonic and ice. Bitter sparkle, low acid, a tall cup without espresso heat.",
    yield: "Cold brew + 150 ml tonic",
    method: [
      "A clean cold-brew base: 12–18 hours, or a house rapid extraction tasted against the long steep.",
      "Hard ice. Chilled tonic first.",
      "Cold brew slowly over the tonic.",
      "Serve before the bubbles fade.",
    ],
  });
  byId["barrel-aged-cold-brew"] = overlay(b("barrel-aged-cold-brew"), {
    description: "Cold brew from a named barrel-aged lot. Oak and spirit-barrel aroma — not woody bitterness.",
    yield: "72 g coffee, 240 ml water",
    method: [
      "Verified barrel-aged beans. Grind on demand, coarse. Cold water, fully wet. Steep 12–18 hours.",
      "Filter clean. Dilute to drinking strength.",
      "A house rapid extraction is fine if it tastes against the long steep.",
      "Hard ice, or neat. The value is aroma, not wood.",
    ],
  });
  byId["reserve-pour-over"] = overlay(b("reserve-pour-over"), {
    description: "Reserve single-origin pour-over. The lot, the time, and one tasting cue.",
    yield: "18 g coffee, 300 ml water",
    method: [
      "Name the lot first: origin, process where you know it, roast rest, one tasting note.",
      brewBed("the dialled reserve grind"),
      "Bloom 30–45 seconds. Calm, repeatable pulses. Keep the bed level.",
      "Target 2:45–3:45 for a 300–320 ml cup.",
      "Small carafe, warm cup, one cue. Do not hold it.",
    ],
  });
}

function milk() {
  const recipes = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
  const b = (id) => recipes[id];

  byId["espresso-macchiato"] = overlay(b("espresso-macchiato"), {
    description: "Espresso marked with a small spoon of foam. Coffee first. Not a mini cappuccino.",
    yield: "30–35 ml espresso, marked",
    method: [
      PUCK,
      "Pull 30–35 ml into a small warm cup.",
      "While the shot runs, steam a little milk. You need the foam, not a pour.",
      "1–2 spoons of glossy foam through the crema.",
      "Do not fill it with liquid milk. Serve at once.",
    ],
  });
  byId["cortado"] = overlay(b("cortado"), {
    description: "Espresso cut with near-equal warm milk. Coffee-forward, short, smooth.",
    yield: "30–35 ml espresso + 50–70 ml milk",
    method: espressoMilkMethod(b("cortado")),
  });
  byId["piccolo-latte"] = overlay(b("piccolo-latte"), {
    description: "A mini latte. A short espresso base, 70–90 ml silky milk, in a small glass.",
    yield: "20–25 ml espresso + 70–90 ml milk",
    method: [
      PUCK,
      "Pull a short espresso, about 20–25 ml.",
      STEAM_LATTE,
      NO_WAND,
      "Pour like a small latte. Serve at once, in a 90–110 ml glass.",
    ],
  });
  byId["gibraltar"] = overlay(b("gibraltar"), {
    description: "Cortado balance in a Gibraltar glass. Tight ratio, San Francisco bar classic.",
    yield: "30–35 ml espresso + 50–70 ml milk",
    method: espressoMilkMethod(b("gibraltar")),
    proTip: "The glass is the service. In a larger cup, it is a cortado — call it that.",
  });
  byId["flat-white"] = overlay(b("flat-white"), {
    description: "Tighter than a latte. A double espresso, 90–110 ml velvet microfoam, a 150–180 ml cup.",
    yield: "60–70 ml double espresso + 90–110 ml milk",
    method: espressoMilkMethod(b("flat-white")),
  });
  byId["cappuccino"] = overlay(b("cappuccino"), {
    description: "Espresso, warm milk, dense microfoam. Aroma through the foam, sweetness in the milk.",
    yield: "30–35 ml espresso + milk and foam",
    method: [
      PUCK,
      pullStep(b("cappuccino")),
      STEAM_CAP,
      NO_WAND,
      "Pour through the espresso. Finish with a clear foam cap. Do not stir. Serve at once.",
    ],
  });
  byId["latte"] = overlay(b("latte"), {
    description: "Espresso on steamed milk, a thin microfoam lid. Comfort in the cup.",
    yield: "30–35 ml espresso + 165 ml milk",
    method: espressoMilkMethod(b("latte")),
  });
  byId["latte-macchiato"] = overlay(b("latte-macchiato"), {
    description: "Steamed milk marked with espresso. Milk first. A stain on top.",
    yield: "30–35 ml espresso + 180 ml milk",
    method: [
      PUCK,
      STEAM_LATTE,
      NO_WAND,
      "Milk in a tall glass first, a soft foam layer on top.",
      "Pull 30–35 ml. Pour slowly through the milk so the mark stays.",
      "Serve at once.",
    ],
    proTip: "Latte macchiato is milk marked with coffee, not the small foam-dolloped espresso macchiato.",
  });
  byId["mocha"] = mochaMethod(b("mocha"));
  byId["espresso-con-panna"] = overlay(b("espresso-con-panna"), {
    description: "Espresso crowned with softly whipped cream. Coffee-forward, barely sweet.",
    yield: "30–35 ml espresso, cream on top",
    method: [
      PUCK,
      "Pull 30–35 ml.",
      "Lightly whip cold cream until it is soft and pourable, not stiff.",
      "Float the cream over the back of a spoon.",
      "Serve at once — hot coffee, cool cream.",
    ],
  });
  byId["breve-latte"] = overlay(b("breve-latte"), {
    description: "Espresso with steamed half-and-half. Richer than a whole-milk latte.",
    yield: "30–35 ml espresso + 165 ml half-and-half",
    method: [
      PUCK,
      pullStep(b("breve-latte")),
      "Half-and-half to 60–65°C. Stretch less than milk — the cream thickens quickly.",
      "Pour into the espresso. Serve at once.",
    ],
    proTip: "Half-and-half thickens quickly. Stretch less than milk, and keep 60–65°C.",
  });
  byId["cafe-au-lait"] = overlay(b("cafe-au-lait"), {
    description: "Filter coffee and scalded milk, about equal parts. A French breakfast cup — not espresso.",
    yield: "220 ml brew + 220 ml milk",
    method: [
      brewBed("filter"),
      "Brew 220 ml fresh filter or batch coffee.",
      "Milk to 60–65°C, light texture. Not cappuccino foam.",
      NO_WAND,
      "Coffee and milk in roughly equal parts, into a large warm cup. Serve hot.",
    ],
  });
  byId["galao"] = overlay(b("galao"), {
    description: "Portuguese tall glass. Espresso lengthened with foamed milk — more than a cortado, less than a latte.",
    yield: "30–35 ml espresso + 120 ml milk",
    method: espressoMilkMethod(b("galao")),
  });
  byId["cafe-con-leche"] = overlay(b("cafe-con-leche"), {
    description: "Espresso folded through steamed milk. A Spanish morning cup, without latte volume.",
    yield: "30–35 ml espresso + 150 ml milk",
    method: espressoMilkMethod(b("cafe-con-leche")),
  });
  byId["dirty-coffee"] = icedEspressoLast(b("dirty-coffee"), "Cold whole milk on the ice.");
  byId["dry-cappuccino"] = overlay(b("dry-cappuccino"), {
    description: "A cappuccino with a lighter body and a more pronounced dry foam cap.",
    yield: "30–35 ml espresso + milk and dry foam",
    method: [
      PUCK,
      pullStep(b("dry-cappuccino")),
      "While the shot runs, steam milk to 60–65°C into fine, dry foam — structured, not coarse.",
      NO_WAND,
      "Pour through the espresso. Finish with the cap. Do not stir. Serve at once.",
    ],
  });
  byId["oat-latte"] = overlay(b("oat-latte"), {
    description: "A latte on barista oat milk. Creamy, lightly cereal-sweet, dairy-free.",
    yield: "30–35 ml espresso + 210 ml oat milk",
    method: [
      PUCK,
      pullStep(b("oat-latte")),
      "Barista oat milk to 60–65°C, smooth and glossy. Less air than dairy.",
      NO_WAND,
      "Pour into the espresso. Serve at once.",
    ],
  });
  byId["spanish-latte"] = overlay(b("spanish-latte"), {
    description: "Espresso, condensed milk, steamed milk. Caramel-edged, still coffee-forward.",
    yield: "30–35 ml espresso + condensed milk + steamed milk",
    method: [
      PUCK,
      pullStep(b("spanish-latte")),
      "Condensed milk into the hot shot. Stir until even.",
      STEAM_LATTE,
      NO_WAND,
      "Pour. Serve at once.",
    ],
  });
}

function chocolate() {
  const recipes = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
  const b = (id) => recipes[id];
  byId["affogato"] = overlay(b("affogato"), {
    description: "Espresso poured over cold gelato. Instant cooling, bitter-sweet cream.",
    yield: "30–35 ml espresso over gelato",
    method: [
      "Cold gelato in a chilled bowl or glass — one large scoop, or two smaller.",
      PUCK,
      "Pull 30–35 ml. A strong moka will stand in.",
      "Pour at once, from the spouts if you can, onto the gelato.",
      "Spoon. Serve while the surface is just beginning to melt.",
    ],
  });
  byId["bicerin"] = overlay(b("bicerin"), {
    description: "Hot chocolate, espresso, softly whipped cream. Three layers. No steamed milk.",
    yield: "Chocolate, 30–35 ml espresso, cream",
    method: [
      "Melt the dark chocolate until smooth and pourable. Into the heatproof glass.",
      PUCK,
      "Pull 30–35 ml. Pour over the back of a spoon, or down the glass, to keep a layer.",
      "Soft, glossy cream — not stiff. Spoon on top.",
      "Do not stir. Serve at once.",
    ],
  });
  byId["white-chocolate-mocha"] = mochaMethod(
    b("white-chocolate-mocha"),
    "White chocolate in the cup. A splash of hot milk if it needs loosening. Pour the shot over. Stir until glossy."
  );
  byId["caramel-mocha"] = mochaMethod(
    b("caramel-mocha"),
    "Dark chocolate in the cup. Pour the shot over. Stir until glossy. Caramel syrup in. Stir before the milk."
  );
  byId["salted-caramel-mocha"] = mochaMethod(
    b("salted-caramel-mocha"),
    "Dark chocolate in the cup. Pour the shot over. Stir until glossy. Salted caramel syrup in. Taste before you add salt."
  );
  byId["dark-chocolate-mocha"] = mochaMethod(
    b("dark-chocolate-mocha"),
    "Extra dark chocolate in the cup. Pour the shot over. Stir until glossy. Nothing left on the bottom."
  );
  byId["gianduja-latte"] = mochaMethod(
    b("gianduja-latte"),
    "Gianduja paste in a warm cup. Pour the shot over. Stir until smooth and glossy."
  );
  byId["chocolate-cappuccino"] = overlay(b("chocolate-cappuccino"), {
    method: [
      PUCK,
      pullStep(b("chocolate-cappuccino")),
      "Dark chocolate in the cup. Pour the shot over. Stir until glossy.",
      STEAM_CAP,
      NO_WAND,
      "Pour through the chocolate base. Cap with foam. Do not stir. Serve at once.",
    ],
  });
  byId["hot-chocolate"] = overlay(b("hot-chocolate"), {
    description: "Milk chocolate, whole milk, enough cocoa depth to feel crafted — not thin, not powdered.",
    yield: "28 g chocolate, 240 ml milk",
    method: [
      "Chocolate in a pan. A small splash of milk. Warm, whisk, until a glossy paste.",
      "The rest of the milk. Heat to 60–70°C. Whisk until smooth. Do not boil.",
      "Taste before you add sugar.",
      "Warm cup. Serve before a skin forms.",
    ],
  });
  byId["marzipan-mocha"] = mochaMethod(
    b("marzipan-mocha"),
    "Dark chocolate in the cup. Pour the shot over. Stir until glossy. Almond syrup in."
  );
  byId["tiramisu-coffee"] = overlay(b("tiramisu-coffee"), {
    description: "Espresso, mascarpone-style cream, cocoa dust. Dessert cues — not a tiramisu slab.",
    method: [
      PUCK,
      "Pull 30–35 ml.",
      "Lightly whip cold cream until soft and pourable.",
      "Float the cream over the back of a spoon.",
      "A light cocoa dust. Serve at once.",
    ],
  });
  byId["viennese-coffee"] = overlay(b("viennese-coffee"), {
    description: "Hot coffee or espresso, softly whipped cream, a light cocoa finish.",
    method: [
      PUCK,
      "Pull 30–35 ml, or a fresh hot brew.",
      "Lightly whip cold cream until soft and pourable.",
      "Float the cream over the back of a spoon.",
      "A light cocoa dust. Serve at once.",
    ],
  });
  byId["orange-chocolate-mocha"] = mochaMethod(
    b("orange-chocolate-mocha"),
    "Dark chocolate in the cup. Pour the shot over. Stir until glossy. A restrained orange syrup. Chocolate leads."
  );
}

function cold() {
  const recipes = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
  const b = (id) => recipes[id];
  byId["iced-americano"] = icedEspressoLast(b("iced-americano"), "Cold filtered water on the ice, room for the shot.");
  byId["iced-red-eye"] = overlay(b("iced-red-eye"), {
    method: [
      "Chill the brew first.",
      "Hard ice. Cold filter or batch coffee in the glass.",
      PUCK,
      "Pull 30–35 ml. Pour last, over the cold brew.",
      "Serve at once.",
    ],
  });
  byId["quad-on-ice"] = overlay(b("quad-on-ice"), {
    method: [
      "Hard ice in a small chilled glass.",
      PUCK,
      "Four shots, about 120–140 ml in total. Each puck even.",
      "Pour last, directly over the ice. Do not shake.",
      "Serve at once.",
    ],
  });
  byId["iced-cortado"] = icedEspressoLast(b("iced-cortado"), "Cold whole milk on the ice — keep the ratio short.");
  byId["iced-latte"] = icedEspressoLast(b("iced-latte"), "Cold whole milk on the ice.");
  byId["iced-flat-white"] = overlay(b("iced-flat-white"), {
    method: [
      "Hard ice in a chilled glass. Cold whole milk on the ice.",
      PUCK,
      "Two shots, 30–35 ml each.",
      "Pour last, directly over the ice.",
      "Serve at once.",
    ],
  });
  byId["iced-mocha"] = overlay(b("iced-mocha"), {
    method: [
      PUCK,
      pullStep(b("iced-mocha")),
      "Dark chocolate in the cup. Pour the shot over. Stir until glossy. Cool briefly.",
      "Hard ice. Cold milk. Stir until even.",
      "Serve cold.",
    ],
  });
  byId["shakerato"] = overlay(b("shakerato"), {
    method: [
      "Chill a small glass. Sugar in the shaker.",
      PUCK,
      "Pull 30–35 ml. Into the shaker while it is fresh.",
      "Hard ice. Shake hard 10–15 seconds.",
      "Strain, no ice in the glass. Serve at once.",
    ],
  });
  byId["freddo-espresso"] = overlay(b("freddo-espresso"), {
    method: [
      PUCK,
      "Pull 30–35 ml.",
      "Hard ice in a shaker. Shake hard 10–15 seconds until cold and lightly foamy.",
      "Strain into a chilled glass with fresh ice.",
      "Serve while the foam still sits.",
    ],
  });
  byId["freddo-cappuccino"] = overlay(b("freddo-cappuccino"), {
    method: [
      PUCK,
      "Pull 30–35 ml. Shake or stir with hard ice until cold. Into a chilled glass with fresh ice.",
      "Cold milk, frothed separately, until light glossy cold foam.",
      "Spoon the foam on top. The coffee stays visible.",
      "Do not stir unless they want it mixed. Serve at once.",
    ],
  });
  byId["cold-foam-cappuccino"] = overlay(b("cold-foam-cappuccino"), {
    method: byId["freddo-cappuccino"].method,
    proTip: byId["freddo-cappuccino"].proTip,
  });
  byId["blended-coffee-frappe"] = overlay(b("blended-coffee-frappe"), {
    method: [
      PUCK,
      "Pull 30–35 ml. Cool briefly.",
      "Espresso, cold milk, sugar, hard ice in the blender.",
      "Blend until cold, foamy and pourable. Stop before it turns watery.",
      "Chilled glass. Serve at once.",
    ],
  });
  byId["frappe-coffee"] = overlay(b("frappe-coffee"), {
    method: [
      PUCK,
      "Pull 30–35 ml. Cool briefly.",
      "Espresso, a little cold milk, sugar, hard ice. Shake or blend until foamy.",
      "Tall glass. Serve before the foam collapses.",
    ],
  });
  byId["granita"] = overlay(b("granita"), {
    description: "Frozen coffee, scraped to crystals. Cold, sweet-edged, between dessert and iced coffee.",
    yield: "Strong brew, 40 g sugar, frozen and scraped",
    method: [
      brewBed("filter"),
      "A strong brew. Dissolve the sugar while it is hot.",
      "Shallow tray. Freeze. Scrape with a fork every 30–45 minutes.",
      "Serve when it is loose, icy, spoonable.",
    ],
  });
}

function spritz() {
  const recipes = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
  const b = (id) => recipes[id];
  const sparkle = (prep) =>
    overlay(b(id), {
      method: [
        "Chill the glass. Hard ice.",
        PUCK,
        "Pull 30–35 ml. Cool briefly over ice so it does not flatten the bubbles.",
        prep,
        "Sparkling mixer down the ice, slowly.",
        "Coffee last, gently over the top. Stir once only if you need to. Serve while it sparkles.",
      ].filter(Boolean),
    });
  function sparkleId(id, prep) {
    byId[id] = overlay(b(id), {
      method: [
        "Chill the glass. Hard ice.",
        PUCK,
        "Pull 30–35 ml. Cool briefly over ice so it does not flatten the bubbles.",
        prep,
        "Sparkling mixer down the ice, slowly.",
        "Coffee last, gently over the top. Stir once only if you need to. Serve while it sparkles.",
      ].filter(Boolean),
    });
  }
  sparkleId("espresso-tonic", "Tonic in the glass.");
  sparkleId("espresso-lemonade", "Lemonade in the glass.");
  sparkleId("espresso-cola", "Cola in the glass.");
  sparkleId("yuzu-espresso-tonic", "Yuzu syrup in first. Then tonic.");
  sparkleId("espresso-mojito", "Mint, lime and sugar syrup in first. Then soda.");
  byId["brown-sugar-shaken-espresso"] = overlay(b("brown-sugar-shaken-espresso"), {
    method: [
      "Brown sugar syrup in the shaker.",
      PUCK,
      "Pull 30–35 ml onto the syrup while it is hot, so the sugar dissolves.",
      "Hard ice. Shake hard 10–15 seconds.",
      "Chilled glass, fresh ice. Serve while the foam holds a line.",
    ],
  });
  byId["orange-coffee-spritz"] = overlay(b("orange-coffee-spritz"), {
    method: [
      "Chill the glass. Hard ice.",
      "Prepared cold brew, fully chilled.",
      "Orange syrup in first.",
      "Soda down the ice, slowly.",
      "Cold brew last, gently. Serve while it sparkles.",
    ],
  });
  byId["coconut-cold-brew"] = overlay(b("coconut-cold-brew"), {
    method: [
      "Cold brew base: coarse grind, 12–18 hours, or a house rapid extraction tasted against the long steep.",
      "Filter, chill, dilute to drinking strength.",
      "Hard ice. Chilled coconut milk. Coffee still leads.",
      "Serve before the ice softens or the coconut separates.",
    ],
  });
  byId["sparkling-cascara"] = overlay(b("sparkling-cascara"), {
    method: [
      "Steep cascara in hot water. Chill the infusion fully.",
      "Hard ice in a chilled glass.",
      "Soda down the ice, slowly.",
      "Serve while it sparkles.",
    ],
  });
  byId["cascara-spritz"] = overlay(b("cascara-spritz"), {
    method: [
      "Steep cascara in hot water. Chill the infusion fully.",
      "Hard ice. Orange syrup in first.",
      "Soda down the ice, slowly.",
      "Serve while it sparkles.",
    ],
  });
  byId["blackberry-coffee-soda"] = overlay(b("blackberry-coffee-soda"), {
    method: [
      "Prepared cold brew, fully chilled.",
      "Hard ice. Blackberry syrup in first.",
      "Soda down the ice, slowly.",
      "Cold brew last, gently. Serve while it sparkles.",
    ],
  });
}

function classics() {
  const recipes = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
  const b = (id) => recipes[id];
  byId["caffe-corretto"] = overlay(b("caffe-corretto"), {
    description: "Espresso corrected with grappa. Italian after-dinner. Hot coffee, spirit in the cup.",
    yield: "30–35 ml espresso + 30 ml grappa",
    method: [
      "Warm the demitasse, then empty it.",
      PUCK,
      "Grappa in the warm cup.",
      "Pull 30–35 ml into the spirit.",
      "Serve at once.",
    ],
  });
  byId["carajillo"] = overlay(b("carajillo"), {
    method: [
      "Warm a heatproof glass, then empty it.",
      "Brandy in.",
      PUCK,
      "Pull 30–35 ml into the spirit.",
      "Serve at once.",
    ],
  });
  byId["irish-coffee"] = irishStyle(b("irish-coffee"), "Irish whiskey in.");
  byId["gaelic-coffee"] = irishStyle(b("gaelic-coffee"), "Scotch whisky in.");
  byId["kentucky-coffee"] = irishStyle(b("kentucky-coffee"), "Bourbon in. Brown sugar, not white.");
  byId["jamaican-coffee"] = irishStyle(b("jamaican-coffee"), "Dark rum in.");
  byId["calypso-coffee"] = irishStyle(b("calypso-coffee"), "White rum and coconut liqueur in.");
  byId["mexican-coffee"] = irishStyle(b("mexican-coffee"), "Tequila and coffee liqueur in.");
  byId["spanish-coffee"] = irishStyle(b("spanish-coffee"), "Dark rum, coffee liqueur and triple sec in.");
  byId["pharisaer"] = irishStyle(b("pharisaer"), "Dark rum in.");
}

function cocktails() {
  const recipes = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
  const b = (id) => recipes[id];
  byId["espresso-martini"] = shakenEspresso(b("espresso-martini"), "Vodka and coffee liqueur in the shaker.");
  byId["creme-brulee-espresso-martini"] = shakenEspresso(
    b("creme-brulee-espresso-martini"),
    "Vodka, coffee liqueur and vanilla syrup in the shaker."
  );
  byId["flat-white-martini"] = shakenEspresso(
    b("flat-white-martini"),
    "Vodka, coffee liqueur and a little milk in the shaker."
  );
  byId["coffee-old-fashioned"] = overlay(b("coffee-old-fashioned"), {
    method: [
      "One large hard cube in a rocks glass.",
      "Bourbon, sugar syrup and coffee bitters in a mixing glass, on ice.",
      PUCK,
      "Pull 30–35 ml. Cool briefly. Add to the mixing glass.",
      "Stir until cold. Strain over the cube. Serve at once.",
    ],
  });
  byId["cold-brew-negroni"] = overlay(b("cold-brew-negroni"), {
    method: [
      "Hard ice in a mixing glass.",
      "Gin, Campari, sweet vermouth.",
      "Cold brew last.",
      "Stir until cold. Strain. Serve at once.",
    ],
  });
  byId["coffee-manhattan"] = overlay(b("coffee-manhattan"), {
    method: [
      "Hard ice in a mixing glass.",
      "Rye or bourbon, sweet vermouth, coffee bitters.",
      PUCK,
      "Pull 30–35 ml. Cool briefly. Add. Stir until cold.",
      "Strain. Serve at once.",
    ],
  });
  byId["coffee-boulevardier"] = overlay(b("coffee-boulevardier"), {
    method: [
      "Hard ice in a mixing glass.",
      "Bourbon, Campari, sweet vermouth.",
      PUCK,
      "Pull 30–35 ml last. Stir until cold. Strain over a large cube.",
      "Serve at once.",
    ],
  });
  byId["revolver"] = overlay(b("revolver"), {
    method: [
      "Hard ice in a mixing glass.",
      "Bourbon, coffee liqueur, orange bitters.",
      PUCK,
      "Pull 30–35 ml. Cool briefly. Stir until cold. Strain.",
      "Serve at once.",
    ],
  });
  byId["white-russian"] = overlay(b("white-russian"), {
    method: [
      "Hard ice in a chilled rocks glass.",
      "Vodka and coffee liqueur over the ice.",
      PUCK,
      "Pull 30–35 ml. Cool briefly. Add.",
      "Cream slowly over the ice. A short stir until marbled. Serve cold.",
    ],
  });
  byId["black-russian"] = overlay(b("black-russian"), {
    description: "Vodka and coffee liqueur over ice. No cream. Spirit-forward and cold.",
    yield: "50 ml vodka + 25 ml coffee liqueur",
    method: [
      "Hard ice in a rocks glass.",
      "Vodka and coffee liqueur over the ice.",
      "Stir briefly until cold. Do not shake.",
      "Serve at once.",
    ],
  });
  byId["rum-espresso-sour"] = shakenEspresso(
    b("rum-espresso-sour"),
    "Dark rum, lemon juice and sugar syrup in the shaker."
  );
  byId["coffee-margarita"] = shakenEspresso(b("coffee-margarita"), "Tequila, coffee liqueur and lime in the shaker.");
  byId["affogato-martini"] = shakenEspresso(
    b("affogato-martini"),
    "Vodka, coffee liqueur and vanilla liqueur in the shaker."
  );
  byId["cold-brew-white-negroni"] = overlay(b("cold-brew-white-negroni"), {
    method: [
      "Hard ice in a mixing glass.",
      "Gin, Suze, white vermouth.",
      "Cold brew last.",
      "Stir until cold. Strain. Serve at once.",
    ],
  });
  byId["spiced-rum-cold-brew"] = overlay(b("spiced-rum-cold-brew"), {
    method: [
      "Hard ice. Spiced rum in the shaker.",
      "Cold brew last.",
      "Shake hard 12–15 seconds. Fine-strain.",
      "Serve at once.",
    ],
  });
  byId["molasses-old-fashioned-coffee"] = overlay(b("molasses-old-fashioned-coffee"), {
    method: [
      "One large hard cube in a rocks glass.",
      "Bourbon, molasses syrup and coffee bitters in a mixing glass, on ice.",
      PUCK,
      "Pull 30–35 ml. Cool briefly. Add. Stir until cold.",
      "Strain over the cube. Serve at once.",
    ],
  });
}

function syrupLatte(recipe, syrupLine) {
  return overlay(recipe, {
    method: [PUCK, pullStep(recipe), syrupLine, milkSteam(recipe), NO_WAND, "Pour. Serve at once."],
  });
}

function signatures() {
  const recipes = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
  const b = (id) => recipes[id];
  const syrups = {
    "honey-latte": "Honey syrup into the hot shot. Stir until even.",
    "vanilla-latte": "Vanilla syrup into the hot shot. Stir until even.",
    "maple-latte": "Maple syrup into the hot shot. Stir until even.",
    "salted-caramel-latte": "Salted caramel syrup into the hot shot. Stir until even. Taste before you add more salt.",
    "hazelnut-cappuccino": "Hazelnut syrup into the hot shot. Stir until even.",
    "cinnamon-latte": "Cinnamon syrup into the hot shot. Stir until even.",
    "cardamom-latte": "Cardamom syrup into the hot shot. Stir until even.",
    "lavender-latte": "Lavender syrup into the hot shot. Stir until even. Perfume, not volume.",
    "rose-latte": "Rose syrup into the hot shot. Stir until even. A light hand.",
    "pistachio-latte": "Pistachio syrup into the hot shot. Stir until even.",
    "black-sesame-latte": "Black sesame syrup into the hot shot. Stir until even — sesame clumps in cold milk.",
    "speculoos-latte": "Speculoos syrup into the hot shot. Stir until even.",
    "chai-spiced-latte": "Chai syrup into the hot shot. Stir until even.",
    "butterscotch-latte": "Butterscotch syrup into the hot shot. Stir until even.",
  };
  Object.keys(syrups).forEach((id) => {
    byId[id] = syrupLatte(b(id), syrups[id]);
  });
  byId["salted-caramel-latte"].proTip =
    "Salted caramel drifts sweet between bottles. Taste before you line it up.";
  byId["irish-cream-latte"] = overlay(b("irish-cream-latte"), {
    method: [
      "Warm the cup. Irish cream liqueur in.",
      PUCK,
      "Pull 30–35 ml. Stir into the liqueur.",
      STEAM_LATTE,
      NO_WAND,
      "Pour. Serve at once. Stop the milk before it cooks.",
    ],
  });
  byId["honeycomb-flat-white"] = overlay(b("honeycomb-flat-white"), {
    method: [
      PUCK,
      "Pull 60–70 ml — a double.",
      "Honeycomb syrup into the hot shot. Stir until even.",
      STEAM_FLAT,
      NO_WAND,
      "90–110 ml milk into a 150–180 ml cup. Serve at once.",
    ],
  });
  byId["orange-mocha"] = mochaMethod(
    b("orange-mocha"),
    "Dark chocolate in the cup. Pour the shot over. Stir until glossy. Orange syrup in."
  );
  byId["raspberry-white-mocha"] = mochaMethod(
    b("raspberry-white-mocha"),
    "White chocolate in the cup. Loosen with a splash of hot milk if needed. Pour the shot over. Raspberry syrup in."
  );
}

function seasonal() {
  const recipes = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
  const b = (id) => recipes[id];
  byId["fig-cortado"] = overlay(b("fig-cortado"), {
    method: [
      PUCK,
      pullStep(b("fig-cortado")),
      "Fig syrup into the hot shot. Stir until even.",
      STEAM_CORTADO,
      NO_WAND,
      "Keep it short. Serve at once.",
    ],
  });
  byId["winter-spice-americano"] = overlay(b("winter-spice-americano"), {
    method: [
      "Winter spice syrup in a warm cup.",
      PUCK,
      "Pull 30–35 ml onto the syrup. Stir once.",
      "Hot water on top, 120 ml.",
      "Serve hot. The spice should lift the americano, not sweeten it into something else.",
    ],
  });
  byId["apple-crisp-latte"] = syrupLatte(
    b("apple-crisp-latte"),
    "Apple syrup and cinnamon syrup into the hot shot. Stir until even."
  );
  byId["pumpkin-spice-latte"] = syrupLatte(
    b("pumpkin-spice-latte"),
    "Pumpkin spice syrup into the hot shot first — not after the milk."
  );
  byId["gingerbread-latte"] = syrupLatte(b("gingerbread-latte"), "Gingerbread syrup into the hot shot. Stir until even.");
  byId["cherry-blossom-latte"] = syrupLatte(
    b("cherry-blossom-latte"),
    "Cherry blossom syrup into the hot shot. Stir until even. A light hand."
  );
  byId["peppermint-mocha"] = mochaMethod(
    b("peppermint-mocha"),
    "Dark chocolate in the cup. Pour the shot over. Stir until glossy. Peppermint syrup in."
  );
  byId["eggnog-latte"] = overlay(b("eggnog-latte"), {
    method: [
      PUCK,
      pullStep(b("eggnog-latte")),
      "Eggnog into the hot shot. Stir.",
      STEAM_LATTE,
      NO_WAND,
      "Pour. Serve at once.",
    ],
  });
  byId["salted-maple-latte"] = syrupLatte(
    b("salted-maple-latte"),
    "Salted maple syrup into the hot shot. Stir until even."
  );
  byId["toasted-marshmallow-mocha"] = mochaMethod(
    b("toasted-marshmallow-mocha"),
    "Dark chocolate in the cup. Pour the shot over. Stir until glossy. Marshmallow syrup in."
  );
  byId["cranberry-white-mocha"] = mochaMethod(
    b("cranberry-white-mocha"),
    "White chocolate in the cup. Loosen with a splash of hot milk if needed. Pour the shot over. Cranberry syrup in."
  );
  byId["spring-honey-flat-white"] = overlay(b("spring-honey-flat-white"), {
    method: [
      PUCK,
      "Pull 60–70 ml — a double.",
      "Honey syrup into the hot shot. Stir until even.",
      STEAM_FLAT,
      NO_WAND,
      "90–110 ml milk into a 150–180 ml cup. Serve at once.",
    ],
  });
}

function peters() {
  const recipes = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
  const b = (id) => recipes[id];
  byId["peter-s-velvet-ristretto"] = overlay(b("peter-s-velvet-ristretto"), {
    description: "A short, dense espresso. Sweet, syrupy, Peter’s window for clarity and body.",
    yield: "18–22 ml ristretto",
    method: [
      PUCK,
      "Pull 18–22 ml. Stop while sweetness is still leading.",
      "Serve at once.",
    ],
    proTip: "Do not chase volume. If it is sour or harsh, change grind — not water, not milk.",
  });
  byId["peter-s-oat-cortado"] = overlay(b("peter-s-oat-cortado"), {
    method: [
      PUCK,
      pullStep(b("peter-s-oat-cortado")),
      "Oat milk to 60–65°C, smooth and glossy. Stop before it cooks.",
      NO_WAND,
      "Short pour. Cortado height, not latte height. Serve at once.",
    ],
  });
  byId["hernou-reserve-mocha"] = mochaMethod(
    b("hernou-reserve-mocha"),
    "Dark chocolate in the cup. Pour the shot over. Stir until glossy. Coffee leads — not candy."
  );
  byId["peter-s-espresso-tonic"] = overlay(b("peter-s-espresso-tonic"), {
    method: byId["espresso-tonic"].method,
    proTip: "Never shake tonic and espresso together.",
  });
  byId["peter-s-affogato-classico"] = overlay(b("peter-s-affogato-classico"), {
    method: [
      "Vanilla gelato in a chilled dessert glass.",
      PUCK,
      "Pull 30–35 ml.",
      "Pour at once onto the gelato — from the spouts if you can.",
      "Spoon and napkin. Serve while the first melt is still creamy.",
    ],
  });
  byId["peter-s-irish-coffee"] = irishStyle(b("peter-s-irish-coffee"), "Irish whiskey in.");
  byId["peter-s-chocolate-orange-espresso"] = overlay(b("peter-s-chocolate-orange-espresso"), {
    method: [
      PUCK,
      pullStep(b("peter-s-chocolate-orange-espresso")),
      "Dark chocolate in the cup. Pour the shot over. Stir until glossy.",
      "Orange syrup in. No milk.",
      "Serve at once, while it is warm and glossy.",
    ],
  });
  byId["peter-s-maple-flat-white"] = overlay(b("peter-s-maple-flat-white"), {
    method: [
      PUCK,
      "Pull 60–70 ml — a double.",
      "Maple syrup into the hot shot. Stir until even.",
      STEAM_FLAT,
      NO_WAND,
      "90–110 ml milk into a 150–180 ml cup. Serve at once.",
    ],
  });
  byId["peter-s-black-sesame-latte"] = syrupLatte(
    b("peter-s-black-sesame-latte"),
    "Black sesame syrup into the hot shot. Stir until even."
  );
  byId["peter-s-reserve-pour-over"] = overlay(b("peter-s-reserve-pour-over"), {
    description: "Peter’s reserve pour-over. The lot, a calm brew, one tasting cue.",
    yield: "18 g coffee, 300 ml water",
    method: [
      "Name the lot: origin, process where you know it, roast rest, one note.",
      brewBed("the dialled reserve grind"),
      "Bloom 30–45 seconds. Calm pulses. Keep the bed level.",
      "Target 2:45–3:45 for a 300–320 ml cup.",
      "Small carafe. One cue. Not a lecture.",
    ],
  });
  byId["peter-s-coffee-negroni"] = overlay(b("peter-s-coffee-negroni"), {
    method: [
      "Hard ice in a mixing glass.",
      "Gin, Campari, sweet vermouth.",
      PUCK,
      "Pull 30–35 ml last. Stir until cold. Strain.",
      "Serve at once.",
    ],
  });
  byId["peter-s-tiramisu-espresso"] = overlay(b("peter-s-tiramisu-espresso"), {
    method: byId["tiramisu-coffee"].method,
  });
  byId["house-flat-white"] = overlay(b("house-flat-white"), {
    description: "The house flat white. Same double, same milk, same cup, every time.",
    yield: "60–70 ml double espresso + 90–110 ml milk",
    method: espressoMilkMethod(b("house-flat-white")),
    proTip: "A spec, not a suggestion. If it drifts into latte volume, it is not the house flat white.",
  });
  byId["cold-brew-spritz"] = overlay(b("cold-brew-spritz"), {
    method: byId["orange-coffee-spritz"].method,
  });
  byId["signature-iced-latte"] = icedEspressoLast(b("signature-iced-latte"), "Cold whole milk on the ice.");
  byId["peter-s-chilly-choffy"] = overlay(b("peter-s-chilly-choffy"), {
    method: [
      "Chill the glass. Milk and ice cream stay cold.",
      "Dark ganache with a splash of cold milk, until smooth.",
      "Cold brew or chilled espresso, and coffee ice. Blend just to chill.",
      "Ice cream last. Blend only until thick and pourable.",
      "Serve at once.",
    ],
  });
  byId["creamy-dream"] = overlay(b("creamy-dream"), {
    method: [
      PUCK,
      "Pull 30–35 ml.",
      "White chocolate in the cup. Pour the shot over. Stir until glossy. Caramel, sugar, a pinch of salt.",
      STEAM_LATTE,
      NO_WAND,
      "Pour. Pecans on top so they stay crunchy. Serve at once.",
    ],
  });
  byId["grand-pom-pom"] = overlay(b("grand-pom-pom"), {
    method: [
      "Warm the apple-pomegranate juice. Do not boil.",
      "Dark chocolate with a splash of the warm juice, until glossy. Rest of the juice in.",
      "Grand Marnier off the heat.",
      "Soft cream, floated. Pomegranate and chocolate curls.",
      "Serve at once.",
    ],
  });
  byId["peter-s-cuban-kiss"] = overlay(b("peter-s-cuban-kiss"), {
    method: [
      "Warm the glass, then empty it.",
      "Dark rum in. Chocolate ganache, a splash of hot coffee, stir until smooth.",
      PUCK,
      "Pull 30–35 ml into the glass.",
      "Soft cream, floated. Serve hot. Do not boil after the rum is in.",
    ],
  });
  byId["pretty-in-pink"] = overlay(b("pretty-in-pink"), {
    yield: "White chocolate, milk, beetroot",
    method: [
      "White chocolate. A splash of milk. Whisk to a paste.",
      "Beetroot juice and the rest of the milk. Heat to 60–70°C until smooth and pink.",
      "Warm cup. Soft cream. White chocolate pearls.",
      "Serve before a skin forms.",
    ],
  });
  byId["peter-s-float-away"] = overlay(b("peter-s-float-away"), {
    method: [
      "Chill the glass. Oat drink and ice cream stay cold.",
      "Dark ganache with a splash of oat drink, until smooth.",
      "Cold brew or chilled espresso, and mint. Blend or shake briefly.",
      "Rest of the oat drink. Ice cream last, only until thick.",
      "Mint. Serve cold.",
    ],
  });
  byId["chai-chocolatte"] = overlay(b("chai-chocolatte"), {
    method: [
      "Dark chocolate. A splash of chai-infused milk. Whisk to a paste.",
      "Rest of the chai milk. Heat to 60–70°C until glossy. Do not boil.",
      "Taste before you add sugar.",
      "Warm cup. Serve before a skin forms.",
    ],
  });
  byId["sailing-off"] = overlay(b("sailing-off"), {
    method: [
      "Warm the glass, then empty it. Port in.",
      "Dark chocolate with a splash of fresh filter coffee, until glossy.",
      "Rest of the brew. Stir gently.",
      "Soft cream, floated. Cocoa nibs.",
      "Serve hot. Add the port late — boiled port is harsh.",
    ],
  });
  byId["bed-of-roses"] = overlay(b("bed-of-roses"), {
    method: [
      "Dark chocolate, rose syrup, rose water. A splash of milk. Whisk to a paste.",
      "Rest of the milk. Heat to 60–70°C until glossy.",
      "Soft cream cap. Dark chocolate on top.",
      "Serve before a skin forms. Rose is perfume, not volume.",
    ],
  });
  byId["orange-is-the-new-pink"] = overlay(b("orange-is-the-new-pink"), {
    method: [
      "Chill the glass. Orange-blossom ice in.",
      "Orange-blossom water into the dark ganache until it loosens and looks glossy.",
      "Ganache in the glass, below the sparkle.",
      "Sparkling rosé down the side, slowly.",
      "Edible flowers. Serve cold while it sparkles.",
    ],
  });
  byId["straws-stripes"] = overlay(b("straws-stripes"), {
    method: [
      "Dark ganache with a splash of milk, until smooth.",
      "Strawberries and sugar into the base.",
      "Rest of the milk, until glossy. Heat gently to 60–70°C if this is the hot serve.",
      "Soft strawberry cream on top.",
      "Serve at once, in a clear glass so the layers show.",
    ],
  });
  byId["i-put-a-spelt-on-you"] = overlay(b("i-put-a-spelt-on-you"), {
    method: [
      "Dark chocolate. A splash of spelt milk. Whisk to a paste.",
      "Spirulina as a slurry with cold spelt milk, then in — a restrained note.",
      "Rest of the spelt milk. Heat to 60–70°C until glossy.",
      "Serve before a skin forms. Chocolate leads; green is a hint.",
    ],
  });
  byId["what-s-up-brew"] = overlay(b("what-s-up-brew"), {
    method: [
      "Chill the glass. Hard ice in a shaker.",
      "Dark ganache with ginger syrup, until smooth.",
      "Filtered cold brew in. Shake until cold.",
      "Fine-strain. Chocolate pearls. Serve cold.",
    ],
  });
  byId["berry-me-up"] = overlay(b("berry-me-up"), {
    method: [
      "Chill the glass. Yoghurt stays cold.",
      "Dark ganache with a little yoghurt, until smooth.",
      "Elderberry juice and cardamom. Rest of the yoghurt, until glossy.",
      "Cocoa nibs. Serve cold.",
    ],
  });
  byId["have-no-fear-beetroot-s-here"] = overlay(b("have-no-fear-beetroot-s-here"), {
    method: [
      "Warm the beetroot juice. Do not boil.",
      "Dark chocolate with a splash of the juice, until glossy. Rest of the juice in.",
      "Whisky in a warm glass.",
      "Hot beetroot-chocolate over the whisky. Stir once.",
      "Serve hot. Chocolate leads; beetroot is colour and depth.",
    ],
  });
  byId["mango-django"] = overlay(b("mango-django"), {
    method: [
      "Chill the glass. Mango juice stays cold.",
      "Dark ganache with a splash of mango, until smooth.",
      "Rest of the mango. A hint of spice — lift, not heat.",
      "Over a large ice ball. Serve cold. They may stir.",
    ],
  });
  byId["blueberry-thrills"] = overlay(b("blueberry-thrills"), {
    method: [
      "Chill the glass. Dairy stays cold.",
      "Dark ganache in first.",
      "Blueberries and flaxseed, blended into the texture.",
      "Buttermilk gradually, until glossy.",
      "Blueberries on top. Serve cold.",
    ],
  });
}

brewed();
milk();
chocolate();
cold();
spritz();
classics();
cocktails();
signatures();
seasonal();
peters();

const recipeMap = Object.fromEntries(book.chapters.flatMap((c) => c.recipes.map((r) => [r.id, r])));
const ids = book.chapters.flatMap((c) => c.recipes.map((r) => r.id));
ids.forEach((id) => {
  if (byId[id] || existing[id]) return;
  byId[id] = overlay(recipeMap[id], { method: recipeMap[id].method || [] });
});

const out = { ...existing, ...byId };
const missing = ids.filter((id) => !out[id]);
if (missing.length) {
  console.error("Missing overlays:", missing.join(", "));
  process.exit(1);
}

fs.writeFileSync(path.join(root, "data/page-copy.json"), JSON.stringify(out, null, 2) + "\n");
console.log("Wrote", Object.keys(out).length, "overlays for", ids.length, "recipes");
