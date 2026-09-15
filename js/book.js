(() => {
  const $ = (id) => document.getElementById(id);
  const bookEl = $("book");
  const posEl = $("pos");
  const barEl = $("bar");
  const overlay = $("contentsOverlay");
  const contentsBody = $("contentsBody");
  const searchInput = $("contentsSearch");
  const soundBtn = $("soundBtn");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const FLIP_MS = reduce ? 80 : 525;
  const FLIP_ANIM_MS = reduce ? 1 : 600;
  const DRINKS = "170+";

  let book = null;
  let pages = [];
  let pageFlip = null;
  let pageCount = 0;
  let lastFlip = 0;
  let soundOn = true;
  const turnSound = new Audio("./audio/page-turn.mp3");
  turnSound.preload = "auto";
  turnSound.volume = 0.55;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function photoSrc(src) {
    const value = String(src || "");
    if (!value) return value;
    return value + (value.includes("?") ? "&" : "?") + "v=79";
  }

  function playTurn() {
    if (reduce || !soundOn) return;
    try {
      turnSound.currentTime = 0;
      const playing = turnSound.play();
      if (playing && playing.catch) playing.catch(() => {});
    } catch (err) {}
  }

  function firstSentence(text) {
    const value = String(text || "").trim();
    if (!value) return "";
    const match = value.match(/^(.+?[.!?])(?:\s|$)/);
    return match ? match[1] : value;
  }

  function tidyIngredient(line) {
    return String(line || "")
      .replace(/\s*\([^)]*(verify|supplier|gluten|soy lecithin)[^)]*\)/gi, "")
      .replace(/dose varies by basket; not a universal gram value/gi, "espresso dose")
      .replace(/dose to your house brew ratio; not a universal gram value/gi, "brew dose")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+—\s*$/g, "")
      .trim();
  }

  function isBoilerplateStep(step) {
    const text = String(step || "").toLowerCase();
    if (/for dairy and plant-based/.test(text)) return true;
    if (/test the exact supplier/.test(text)) return true;
    return false;
  }

  function tidyStep(step) {
    let text = String(step || "")
      .replace(/\s*; for home use,[^.]+/gi, "")
      .replace(/\s*\(ideally 10–14 days after roasting and properly rested\)/gi, "")
      .replace(/\.{2,}/g, ".")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (/grind freshly roasted beans/i.test(text)) {
      return "Grind on demand. Distribute, level the puck and tamp straight.";
    }
    if (/home option without a steam wand/i.test(text) || /handheld frother, french press or tightly closed jar/i.test(text)) {
      return "No steam wand: warm the milk to 60–65°C, froth 10–20 seconds, tap, swirl and pour while glossy.";
    }
    if (text.length > 220) text = firstSentence(text);
    return text.replace(/\s+\.$/, ".");
  }

  function clipNote(text, max) {
    const value = String(text || "").trim();
    if (!value) return "";
    if (value.length <= max) return value;
    return firstSentence(value);
  }

  function uniqueSteps(steps) {
    const seen = new Set();
    const out = [];
    steps.forEach((step) => {
      const key = String(step || "").toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(step);
    });
    return out;
  }

  let pageCopy = {};

  function bookRecipe(recipe, chapter) {
    const overlay = pageCopy[recipe.id] || {};
    const method = uniqueSteps(
      (overlay.method || recipe.method || [])
        .filter((step) => !isBoilerplateStep(step))
        .map(tidyStep)
        .filter(Boolean)
    ).slice(0, 7);
    const serve = clipNote(overlay.serve || recipe.serve, 180);
    const tip = clipNote(overlay.proTip || recipe.proTip, 220);
    const ingredients = (overlay.ingredients || recipe.ingredients || [])
      .map(tidyIngredient)
      .filter(Boolean);
    return {
      type: "recipe",
      title: overlay.title || recipe.title,
      chapter: chapter.title,
      description: overlay.description
        ? clipNote(overlay.description, 220)
        : firstSentence(recipe.description),
      yield:
        overlay.yield ||
        String(recipe.espresso || "")
          .replace(/^Espresso standard:\s*/i, "")
          .replace(/\.$/, ""),
      ingredients,
      method,
      proTip: tip,
      serve,
      containsAlcohol: !!recipe.containsAlcohol,
      recipeId: recipe.id,
      running: chapter.title,
    };
  }

  function leafHtml(page) {
    if (!page) return `<div class="leaf__inner"></div>`;
    const folio = page.number ? `<p class="folio">${page.number}</p>` : "";
    const running = page.running ? `<p class="running">${escapeHtml(page.running)}</p>` : "";

    if (page.type === "ghost") {
      return `<div class="leaf__inner"></div>`;
    }
    if (page.type === "cover") {
      const mosaic = (page.mosaic || [])
        .map(
          (tile) =>
            `<div class="cover-tile${tile.mid ? " cover-tile--mid" : ""}"><img src="${escapeHtml(photoSrc(tile.src))}" alt="" fetchpriority="high"></div>`
        )
        .join("");
      return `<div class="cover">
        <div class="cover-mosaic">${mosaic}</div>
        <div class="cover-copy">
          <p class="cover__mark">${escapeHtml(page.author)}</p>
          <h2 class="cover__title">${escapeHtml(page.title)}</h2>
          <p class="cover__line">${escapeHtml(page.line)}</p>
          <p class="cover__gold">${escapeHtml(page.gold)}</p>
          <p class="cover__cred">${escapeHtml(page.cred)}</p>
        </div>
      </div>`;
    }
    if (page.type === "lineage-plate") {
      return `<div class="lineage-plate">
        <p class="kicker">${escapeHtml(page.kicker || "Latte Arte")}</p>
        <h2 class="display display--lg">${escapeHtml(page.headline || "Best in the World Coffee Book")}</h2>
        ${page.body ? `<p class="body">${escapeHtml(page.body)}</p>` : ""}
        <img src="${escapeHtml(photoSrc(page.src))}" alt="${escapeHtml(page.alt || "Latte Arte")}">
        <p class="lineage-plate__foot">${escapeHtml(page.foot || "")}</p>
      </div>${folio}`;
    }
    if (page.type === "lineage") {
      const creds = (page.creds || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
      const site = page.site
        ? `<p class="lineage-site"><a href="${escapeHtml(page.siteHref || `https://${page.site}`)}" target="_blank" rel="noopener">${escapeHtml(page.site)}</a></p>`
        : "";
      return `<div class="leaf__inner lineage-page">
        ${running}
        <p class="kicker">${escapeHtml(page.kicker)}</p>
        <h2 class="display display--xl">${escapeHtml(page.title)}</h2>
        ${page.lede ? `<p class="lede">${escapeHtml(page.lede)}</p>` : ""}
        <hr class="rule" />
        ${(page.paragraphs || []).map((p) => `<p class="body">${escapeHtml(p)}</p>`).join("")}
        ${creds ? `<ul class="cred-list">${creds}</ul>` : ""}
        ${site}
        ${folio}
      </div>`;
    }
    if (page.type === "endpaper") {
      return `<div class="leaf__inner"><p class="display display--md"><em>${escapeHtml(page.line || "")}</em></p>${folio}</div>`;
    }
    if (page.type === "title") {
      return `<div class="leaf__inner">
        ${running}
        <p class="kicker">${escapeHtml(page.kicker)}</p>
        <h2 class="display display--xl">${escapeHtml(page.title)}</h2>
        <p class="display display--md"><em>${escapeHtml(page.italic)}</em></p>
        <hr class="rule" />
        <p class="lede">${escapeHtml(page.lede)}</p>
        ${folio}
      </div>`;
    }
    if (page.type === "how") {
      return `<div class="leaf__inner how-page">
        ${running}
        <p class="kicker">${escapeHtml(page.kicker || "Inside every drink")}</p>
        <h2 class="display display--xl">${escapeHtml(page.title)}</h2>
        ${page.title2 ? `<h2 class="display display--xl how-page__line">${escapeHtml(page.title2)}</h2>` : ""}
        ${page.lede ? `<p class="lede">${escapeHtml(page.lede)}</p>` : ""}
        <hr class="rule" />
        ${(page.paragraphs || []).map((p) => `<p class="body">${escapeHtml(p)}</p>`).join("")}
        ${folio}
      </div>`;
    }
    if (page.type === "how-card") {
      return `<div class="leaf__inner how-card">
        ${running}
        <p class="kicker">${escapeHtml(page.kicker)}</p>
        <ul class="how-points">${(page.points || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        ${page.body ? `<p class="body">${escapeHtml(page.body)}</p>` : ""}
        ${page.cats ? `<p class="how-cats">${escapeHtml(page.cats)}</p>` : ""}
        ${folio}
      </div>`;
    }
    if (page.type === "collection") {
      return `<div class="leaf__inner collection-page">
        ${running}
        <p class="kicker">${escapeHtml(page.kicker)}</p>
        <h2 class="display display--xl">${escapeHtml(page.title)}</h2>
        ${page.lede ? `<p class="lede">${escapeHtml(page.lede)}</p>` : ""}
        <hr class="rule" />
        <div class="stat-row">${(page.stats || [])
          .map(
            (stat, i) =>
              `<div class="stat${i === 0 ? " stat--fill" : ""}"><b>${escapeHtml(stat.n)}</b><span>${escapeHtml(stat.l)}</span></div>`
          )
          .join("")}</div>
        ${page.cats ? `<p class="how-cats">${escapeHtml(page.cats)}</p>` : ""}
        ${page.foot ? `<p class="collection-foot">${escapeHtml(page.foot)}</p>` : ""}
        ${folio}
      </div>`;
    }
    if (page.type === "prep") {
      const n = (page.sections || []).length;
      const pack = n >= 5 ? " prep-page--packed" : n >= 4 ? " prep-page--dense" : "";
      return `<div class="leaf__inner prep-page${pack}">
        ${running}
        <p class="kicker">${escapeHtml(page.kicker || "At home")}</p>
        <h2 class="display display--lg">${escapeHtml(page.title)}</h2>
        <hr class="rule" />
        ${(page.sections || [])
          .map(
            (section) =>
              `<h3>${escapeHtml(section.heading)}</h3><p class="body">${escapeHtml(section.body)}</p>`
          )
          .join("")}
        ${folio}
      </div>`;
    }
    if (page.type === "yields") {
      return `<div class="leaf__inner prep-page">
        ${running}
        <p class="kicker">${escapeHtml(page.kicker || "Espresso")}</p>
        <h2 class="display display--lg">${escapeHtml(page.title)}</h2>
        <hr class="rule" />
        ${page.lede ? `<p class="lede">${escapeHtml(page.lede)}</p>` : ""}
        <ul class="yield-list">${(page.rows || [])
          .map((row) => `<li><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.value)}</span></li>`)
          .join("")}</ul>
        ${page.note ? `<p class="note recipe-tip"><em>${escapeHtml(page.note)}</em></p>` : ""}
        ${folio}
      </div>`;
    }
    if (page.type === "contents") {
      return `<div class="leaf__inner">
        ${running}
        <p class="kicker">Contents</p>
        <h2 class="display display--lg">${escapeHtml(page.title)}</h2>
        <ul class="contents-list">${page.entries
          .map(
            (entry) =>
              `<li><button type="button" data-jump="${entry.jump}"><strong>${escapeHtml(entry.label)}</strong><span>${entry.number}</span></button></li>`
          )
          .join("")}</ul>
        ${folio}
      </div>`;
    }
    if (page.type === "chapter-plate") {
      if (page.mosaic && page.mosaic.length >= 2) {
        const tiles = page.mosaic
          .map(
            (tile, i) =>
              `<div class="chapter-tile${i === 0 ? " chapter-tile--hero" : ""}"><img src="${escapeHtml(photoSrc(tile.src))}" alt="" style="object-position:${escapeHtml(tile.position || "50% 46%")}"></div>`
          )
          .join("");
        return `<div class="chapter-mosaic chapter-mosaic--${escapeHtml(page.layout || "four")}">${tiles}</div>${folio}`;
      }
      if (page.hero && page.hero.src) {
        return `<div class="chapter-gate">
          <img src="${escapeHtml(photoSrc(page.hero.src))}" alt="${escapeHtml(page.hero.alt || page.title)}" style="object-position:${escapeHtml(page.hero.position || "50% 52%")}">
          <div class="chapter-gate__copy">
            <p class="kicker">Chapter</p>
            <h2>${escapeHtml(page.title)}</h2>
          </div>
        </div>${folio}`;
      }
      return `<div class="typo-plate"><p class="kicker">Chapter</p><h2 class="display display--xl">${escapeHtml(page.title)}</h2>${folio}</div>`;
    }
    if (page.type === "chapter") {
      return `<div class="leaf__inner chapter-page">
        ${running}
        <p class="kicker">Chapter</p>
        <h2 class="display display--xl">${escapeHtml(page.title)}</h2>
        ${page.count ? `<p class="chapter-count">${escapeHtml(page.count)}</p>` : ""}
        <hr class="rule" />
        ${page.lede ? `<p class="lede">${escapeHtml(page.lede)}</p>` : ""}
        ${page.body ? `<p class="body">${escapeHtml(page.body)}</p>` : ""}
        ${folio}
      </div>`;
    }
    if (page.type === "plate") {
      if (page.photo) {
        return `<div class="plate">
          <img src="${escapeHtml(photoSrc(page.photo.src))}" alt="${escapeHtml(page.photo.alt || page.title)}" style="object-position:${escapeHtml(page.photo.position || "50% 52%")}">
        </div>${folio}`;
      }
      return `<div class="typo-plate">
        <p class="running">${escapeHtml(page.chapter || "")}</p>
        <h2 class="display display--xl">${escapeHtml(page.title)}</h2>
        ${folio}
      </div>`;
    }
    if (page.type === "recipe") {
      const packed = (page.method || []).length >= 6 ? " recipe-page--packed" : "";
      return `<div class="leaf__inner recipe-page${packed}">
        ${running}
        <h2 class="display display--md">${escapeHtml(page.title)}</h2>
        ${page.description ? `<p class="lede">${escapeHtml(page.description)}</p>` : ""}
        ${page.yield ? `<p class="recipe-yield">${escapeHtml(page.yield)}</p>` : ""}
        ${
          page.ingredients && page.ingredients.length
            ? `<h3>Ingredients</h3><ul>${page.ingredients.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
            : ""
        }
        ${
          page.method && page.method.length
            ? `<h3>Method</h3><ol>${page.method.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`
            : ""
        }
        <div class="recipe-foot">
          ${page.proTip ? `<p class="note recipe-tip"><em>${escapeHtml(page.proTip)}</em></p>` : ""}
          ${page.serve ? `<p class="note recipe-serve">${escapeHtml(page.serve)}</p>` : ""}
          ${page.containsAlcohol ? `<p class="note recipe-mark">Contains alcohol</p>` : ""}
        </div>
        ${folio}
      </div>`;
    }
    if (page.type === "index") {
      return `<div class="leaf__inner index-page">
        ${running}
        <p class="kicker">${page.continued ? "Index · continued" : "Index"}</p>
        <h2 class="display display--lg">A–Z</h2>
        <div class="index-cols">${splitIndexColumns(page.entries)
          .map((col) => `<ul class="index-list">${col.map(indexEntryHtml).join("")}</ul>`)
          .join("")}</div>
        ${folio}
      </div>`;
    }
    if (page.type === "closing-lead") {
      return `<div class="leaf__inner closing-page">
        ${running}
        <p class="kicker">${escapeHtml(page.kicker || "The book")}</p>
        <h2 class="display display--xl">${escapeHtml(page.title)}</h2>
        ${page.title2 ? `<h2 class="display display--xl how-page__line">${escapeHtml(page.title2)}</h2>` : ""}
        ${page.lede ? `<p class="lede">${escapeHtml(page.lede)}</p>` : ""}
        <hr class="rule" />
        ${(page.paragraphs || []).map((p) => `<p class="body">${escapeHtml(p)}</p>`).join("")}
        ${folio}
      </div>`;
    }
    if (page.type === "closing") {
      const creds = (page.creds || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
      const site = page.site
        ? `<p class="lineage-site"><a href="${escapeHtml(page.siteHref || `https://${page.site}`)}" target="_blank" rel="noopener">${escapeHtml(page.site)}</a></p>`
        : "";
      return `<div class="leaf__inner closing-page">
        ${running}
        <p class="kicker">${escapeHtml(page.kicker)}</p>
        <h2 class="display display--xl">${escapeHtml(page.title)}</h2>
        ${page.title2 ? `<h2 class="display display--xl how-page__line">${escapeHtml(page.title2)}</h2>` : ""}
        ${page.lede ? `<p class="lede">${escapeHtml(page.lede)}</p>` : ""}
        <hr class="rule" />
        ${(page.paragraphs || []).map((p) => `<p class="body">${escapeHtml(p)}</p>`).join("")}
        ${creds ? `<ul class="cred-list">${creds}</ul>` : ""}
        ${site}
        ${folio}
      </div>`;
    }
    return `<div class="leaf__inner">${folio}</div>`;
  }

  function leafSide(index) {
    return index % 2 ? "right" : "left";
  }

  function applyLeafClass(el, page, side) {
    el.className = `leaf leaf--${side}`;
    if (!page) {
      el.classList.add("leaf--endpaper");
      return;
    }
    if (page.type === "ghost") el.classList.add("leaf--ghost");
    if (page.type === "blank") el.classList.add("leaf--endpaper");
    if (page.type === "cover") el.classList.add("leaf--cover");
    if (page.type === "lineage-plate") el.classList.add("leaf--lineage-plate");
    if (page.type === "lineage") el.classList.add("leaf--lineage");
    if (page.type === "how-card") el.classList.add("leaf--how-card");
    if (page.type === "collection") el.classList.add("leaf--collection");
    if (page.type === "chapter") el.classList.add("leaf--chapter");
    if (page.type === "closing" || page.type === "closing-lead") el.classList.add("leaf--closing");
    if (page.type === "chapter-plate") {
      el.classList.add("leaf--chapter-plate");
      if (page.hero && !(page.mosaic && page.mosaic.length >= 2)) el.classList.add("leaf--photo");
    }
    if (page.type === "endpaper") el.classList.add("leaf--endpaper");
    if (page.type === "plate") {
      el.classList.add("leaf--plate");
      if (page.photo) el.classList.add("leaf--photo");
    }
  }

  function leafNode(page, index, total) {
    const el = document.createElement("div");
    applyLeafClass(el, page, leafSide(index));
    el.innerHTML = leafHtml(page);
    if (index >= 6) {
      el.querySelectorAll("img[src]").forEach((img) => {
        img.dataset.src = img.getAttribute("src");
        img.removeAttribute("src");
      });
    }
    return el;
  }

  const MOSAIC = {
    "espresso-based": [
      { src: "photos/ristretto.webp", position: "50% 48%" },
      { src: "photos/espresso-lungo.webp", position: "40% 55%" },
      { src: "photos/ristretto-doppio.webp", position: "46% 58%" },
      { src: "photos/americano.webp", position: "58% 62%" },
      { src: "photos/lungo.webp", position: "48% 58%" },
      { src: "photos/quad-espresso.webp", position: "42% 62%" },
    ],
    "brewed-coffee": [
      { src: "photos/drip-coffee.webp", position: "58% 48%" },
      { src: "photos/chemex.webp", position: "50% 42%" },
      { src: "photos/nitro-cold-brew.webp", position: "50% 42%" },
      { src: "photos/cold-brew-coffee.webp", position: "50% 46%" },
    ],
    "milk-coffees": [
      { src: "photos/cafe-con-leche.webp", position: "40% 46%" },
      { src: "photos/dirty-coffee.webp", position: "48% 52%" },
      { src: "photos/espresso-con-panna.webp", position: "52% 58%" },
      { src: "photos/cappuccino.webp", position: "44% 44%" },
      { src: "photos/latte.webp", position: "50% 40%" },
      { src: "photos/piccolo-latte.webp", position: "50% 46%" },
    ],
    "coffee-chocolate": [
      { src: "photos/openers/bicerin.webp?v=58", position: "50% 50%" },
      { src: "photos/openers/gianduja-latte.webp?v=58", position: "50% 50%" },
      { src: "photos/openers/viennese-coffee.webp?v=59", position: "50% 50%" },
      { src: "photos/openers/affogato.webp?v=59", position: "50% 50%" },
      { src: "photos/openers/white-chocolate-mocha.webp?v=58", position: "50% 50%" },
      { src: "photos/openers/salted-caramel-mocha.webp?v=58", position: "50% 50%" },
    ],
    "cold-blended": [
      { src: "photos/shakerato.webp", position: "48% 52%" },
      { src: "photos/granita.webp", position: "50% 44%" },
      { src: "photos/frappe-coffee.webp", position: "50% 44%" },
    ],
    "modern-specialty-spritz": [
      { src: "photos/espresso-tonic.webp", position: "42% 48%" },
      { src: "photos/cascara-spritz.webp", position: "50% 44%" },
    ],
    "alcohol-coffee-classics": [
      { src: "photos/irish-coffee.webp", position: "50% 42%" },
      { src: "photos/carajillo.webp", position: "50% 44%" },
    ],
    "coffee-cocktails": [
      { src: "photos/coffee-old-fashioned.webp", position: "50% 46%" },
      { src: "photos/espresso-martini.webp", position: "50% 42%" },
      { src: "photos/cold-brew-negroni.webp", position: "50% 44%" },
      { src: "photos/coffee-manhattan.webp", position: "50% 44%" },
      { src: "photos/revolver.webp", position: "50% 44%" },
      { src: "photos/white-russian.webp", position: "50% 44%" },
    ],
    "signatures-flavoured": [
      { src: "photos/pistachio-latte.webp", position: "46% 44%" },
      { src: "photos/honey-latte.webp", position: "50% 46%" },
      { src: "photos/rose-latte.webp", position: "50% 44%" },
      { src: "photos/lavender-latte.webp", position: "50% 44%" },
      { src: "photos/speculoos-latte.webp", position: "50% 44%" },
      { src: "photos/chai-spiced-latte.webp", position: "50% 44%" },
    ],
    "seasonal-limited": [
      { src: "photos/winter-spice-americano.webp", position: "50% 44%" },
      { src: "photos/fig-cortado.webp", position: "50% 44%" },
    ],
    "peter-s-specials": [
      { src: "photos/peters-sailing-off.webp", position: "50% 44%" },
      { src: "photos/peters-pretty-in-pink.webp", position: "50% 42%" },
      { src: "photos/peters-mango-django.webp", position: "50% 44%" },
      { src: "photos/peters-cuban-kiss.webp", position: "50% 44%" },
      { src: "photos/peters-bed-of-roses.webp", position: "50% 44%" },
      { src: "photos/peters-berry-me-up.webp", position: "50% 44%" },
    ],
  };

  const CHAPTER_OPENERS = {
    "espresso-based": {
      lede: "The house shots.",
      body: "Ristretto, espresso, lungo, americano, mixed. Same coffee, different cups — from the machine, water in the cup, or brew with a shot on top.",
    },
    "brewed-coffee": {
      lede: "Gravity, flotation, cold.",
      body: "Filter, press, cold brew. No puck. Water at 92–96°C for hot brews. Time and water do the work. Follow the brew on the page — not the espresso yields.",
    },
    "milk-coffees": {
      lede: "Espresso, then milk.",
      body: "Macchiato to latte. The shot stays the lead. Steam to 60–65°C, glossy, not soap — stretch, then texture. The ratio is the drink.",
    },
    "coffee-chocolate": {
      lede: "Coffee with chocolate in the cup.",
      body: "Mocha, affogato, bicerin. Real chocolate, not powder as the default. The espresso has to stand up to the cocoa.",
    },
    "cold-blended": {
      lede: "Cold glass, hard ice, fresh coffee.",
      body: "Iced shots, freddo, shakerato, granita. Chill first. A lot of hard ice, a thick glass. Watery ice makes a watery cup.",
    },
    "modern-specialty-spritz": {
      lede: "Sparkle, citrus, long drinks.",
      body: "Tonic, soda, spritz, cascara. The espresso or brew stays coffee. The mixer is the length.",
    },
    "alcohol-coffee-classics": {
      lede: "Coffee and spirit, hot.",
      body: "Irish coffee and its cousins. Built in the glass. The coffee is the drink — the spirit sits with it, not over it.",
    },
    "coffee-cocktails": {
      lede: "The bar, with coffee in it.",
      body: "Martini, Negroni, Old Fashioned. Coffee as the product, not a garnish. Fresh espresso or cold brew, then the spirit.",
    },
    "signatures-flavoured": {
      lede: "House flavours, still coffee.",
      body: "Honey, pistachio, rose, speculoos. Syrup in the coffee, not instead of it. Keep the shot honest.",
    },
    "seasonal-limited": {
      lede: "The calendar in the cup.",
      body: "Fig, spice, blossom, marshmallow. Seasonal when the season is on. The base is still espresso and milk.",
    },
    "peter-s-specials": {
      lede: "Peter’s own line.",
      body: "The drinks he puts his name on — signatures, not a second catalogue. Same method. His window for taste.",
    },
  };

  function chapterPhotos(chapter) {
    const photos = [];
    const seen = new Set();
    chapter.recipes.forEach((recipe) => {
      const photo = recipe.photo;
      if (!photo || !photo.src || seen.has(photo.src)) return;
      seen.add(photo.src);
      photos.push(photo);
    });
    return photos;
  }

  function mosaicLayout(count) {
    if (count >= 6) return "six";
    if (count >= 4) return "four";
    if (count === 3) return "triple";
    if (count === 2) return "pair";
    if (count === 1) return "one";
    return "";
  }

  function chapterMosaic(chapter) {
    const photos = chapterPhotos(chapter);
    const curated = MOSAIC[chapter.id] || [];
    const seen = new Set();
    const tiles = [];
    function push(item, match) {
      if (!item || !item.src || seen.has(item.src) || tiles.length >= 6) return;
      seen.add(item.src);
      tiles.push({
        src: item.src,
        alt: (match && match.alt) || item.alt || "",
        position: item.position || (match && match.position) || "50% 48%",
      });
    }
    curated.forEach((item) => push(item, photos.find((photo) => photo.src === item.src)));
    photos.forEach((photo) => push(photo, photo));
    return { tiles, layout: mosaicLayout(tiles.length) };
  }

  function chapterOpener(chapter) {
    const firstSrc = chapter.recipes[0] && chapter.recipes[0].photo ? chapter.recipes[0].photo.src : "";
    const photos = chapterPhotos(chapter);
    const curated = MOSAIC[chapter.id];
    if (curated && curated[0]) {
      const match = photos.find((photo) => photo.src === curated[0].src);
      return {
        src: curated[0].src,
        alt: (match && match.alt) || chapter.title,
        position: curated[0].position,
      };
    }
    const other = photos.find((photo) => photo.src !== firstSrc);
    return other || photos[0] || chapter.hero || null;
  }

  function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, size + i));
    return out;
  }

  function padSpread(out) {
    if (out.length % 2) out.push({ type: "blank", label: "" });
  }

  function indexLetter(label) {
    const ch = String(label || "").trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(ch) ? ch : "#";
  }

  function indexEntryHtml(entry) {
    if (entry.type === "letter") return `<li class="index-letter">${escapeHtml(entry.label)}</li>`;
    return `<li><button type="button" data-jump="${entry.jump}"><b>${escapeHtml(entry.label)}</b><span>${entry.number || ""}</span></button></li>`;
  }

  function indexVisual(entry) {
    if (entry.type === "letter") return 1.2;
    const len = String(entry.label || "").length;
    if (len > 26) return 2.2;
    if (len > 15) return 1.7;
    return 1.15;
  }

  function pageVisual(page) {
    return page.reduce((sum, entry) => sum + indexVisual(entry), 0);
  }

  function splitIndexColumns(entries) {
    if (entries.length < 2) return [entries, []];
    let best = Math.ceil(entries.length / 2);
    let bestDiff = Infinity;
    for (let cut = 1; cut < entries.length; cut++) {
      if (entries[cut - 1].type === "letter") continue;
      const diff = Math.abs(pageVisual(entries.slice(0, cut)) - pageVisual(entries.slice(cut)));
      if (diff < bestDiff) {
        bestDiff = diff;
        best = cut;
      }
    }
    return [entries.slice(0, best), entries.slice(best)];
  }

  function namesInLetter(entries, from, letter) {
    let n = 0;
    for (let i = from; i < entries.length && indexLetter(entries[i].label) === letter; i++) n += 1;
    return n;
  }

  function ensureLetterHeads(page) {
    const out = [];
    let last = "";
    page.forEach((item) => {
      if (item.type === "letter") {
        if (last === item.label) return;
        last = item.label;
        out.push(item);
        return;
      }
      const letter = indexLetter(item.label);
      if (letter !== last) {
        out.push({ type: "letter", label: letter });
        last = letter;
      }
      out.push(item);
    });
    while (out.length && out[out.length - 1].type === "letter") out.pop();
    return out;
  }

  function paginateIndex(entries, maxRows) {
    const pages = [];
    let current = [];
    let rows = 0;
    let letter = "";
    entries.forEach((entry, idx) => {
      const next = indexLetter(entry.label);
      const extra = next !== letter ? 1 : 0;
      if (current.length) {
        let shouldBreak = rows + 1 + extra > maxRows;
        if (extra) {
          const remaining = maxRows - rows;
          const count = namesInLetter(entries, idx, next);
          if (remaining < Math.min(1 + count, 4)) shouldBreak = true;
        }
        if (shouldBreak) {
          pages.push(current);
          current = [];
          rows = 0;
          letter = "";
        }
      }
      if (indexLetter(entry.label) !== letter) {
        letter = indexLetter(entry.label);
        current.push({ type: "letter", label: letter });
        rows += 1;
      }
      current.push({ type: "entry", ...entry });
      rows += 1;
    });
    if (current.length) pages.push(current);
    return pages;
  }

  function balanceFacingPages(pages) {
    const maxItems = 12;
    for (let i = 0; i + 1 < pages.length; i += 2) {
      let left = pages[i];
      let right = pages[i + 1];
      for (let n = 0; n < 8; n++) {
        const dv = pageVisual(left) - pageVisual(right);
        if (Math.abs(dv) < 1.5) break;
        if (dv > 0) {
          while (left.length && left[left.length - 1].type === "letter") left.pop();
          if (!left.length || right.length >= maxItems) break;
          right.unshift(left.pop());
        } else {
          while (right.length && right[0].type === "letter") right.shift();
          if (!right.length || left.length >= maxItems) break;
          left.push(right.shift());
        }
        left = ensureLetterHeads(left);
        right = ensureLetterHeads(right);
      }
      pages[i] = left;
      pages[i + 1] = right;
    }
  }

  function trailingLetterGroup(page) {
    let i = page.length - 1;
    while (i >= 0 && page[i].type === "letter") i -= 1;
    if (i < 0) return { head: page, stub: [], nameCount: 0, letter: "" };
    const letter = indexLetter(page[i].label);
    let start = i;
    while (start >= 0) {
      const item = page[start];
      if (item.type === "letter") {
        if (item.label !== letter) {
          start += 1;
          break;
        }
        break;
      }
      if (indexLetter(item.label) !== letter) {
        start += 1;
        break;
      }
      start -= 1;
    }
    if (start < 0) start = 0;
    const stub = page.slice(start);
    return {
      head: page.slice(0, start),
      stub,
      nameCount: stub.filter((item) => item.type === "entry").length,
      letter,
    };
  }

  function unstubFacingPages(pages) {
    for (let i = 0; i + 1 < pages.length; i += 2) {
      const { head, stub, nameCount, letter } = trailingLetterGroup(pages[i]);
      if (!stub.length || nameCount >= 3) continue;
      const right = pages[i + 1][0];
      if (!right) continue;
      const rightLetter = right.type === "letter" ? right.label : indexLetter(right.label);
      if (rightLetter !== letter) continue;
      pages[i] = ensureLetterHeads(head);
      pages[i + 1] = ensureLetterHeads(stub.concat(pages[i + 1]));
    }
  }

  function compactIndexTail(pages, maxRows) {
    while (pages.length > 1) {
      const last = pages[pages.length - 1];
      const prev = pages[pages.length - 2];
      if (pageVisual(last) >= 6 || prev.length + last.length > maxRows + 2) break;
      pages[pages.length - 2] = ensureLetterHeads(prev.concat(last));
      pages.pop();
    }
  }

  function buildPages(data) {
    const out = [];
    const chapterJump = new Map();

    out.push({ type: "ghost", label: "" });
    out.push({
      type: "cover",
      author: data.author,
      title: data.title,
      line: "Every drink, worked through.",
      gold: DRINKS + " recipes · method · serve",
      cred: "World Champion Latte Art",
      mosaic: [
        { src: "photos/pistachio-latte.webp", mid: true },
        { src: "photos/cappuccino.webp" },
        { src: "photos/latte.webp" },
        { src: "photos/cortado.webp" },
        { src: "photos/flat-white.webp" },
        { src: "photos/espresso-macchiato.webp" },
        { src: "photos/irish-coffee.webp" },
        { src: "photos/espresso-martini.webp" },
        { src: "photos/affogato.webp" },
        { src: "photos/bicerin.webp" },
        { src: "photos/chemex.webp" },
        { src: "photos/nitro-cold-brew.webp" },
        { src: "photos/coffee-old-fashioned.webp" },
        { src: "photos/granita.webp" },
        { src: "photos/peters-pretty-in-pink.webp" },
        { src: "photos/viennese-coffee.webp" },
        { src: "photos/cascara-spritz.webp" },
        { src: "photos/espresso-tonic.webp" },
        { src: "photos/piccolo-latte.webp" },
        { src: "photos/honey-latte.webp" },
      ],
      label: "Cover",
    });
    out.push({
      type: "lineage-plate",
      src: "photos/latte-arte-cover.webp?v=32",
      alt: "Latte Arte — Peter Hernou",
      kicker: "Before this book",
      headline: "there was…",
      foot: "Latte Arte",
      label: "Before",
    });
    out.push({
      type: "lineage",
      kicker: "Latte Arte",
      title: "Best Coffee Book in the World.",
      running: data.title,
      lede: "Peter Hernou’s book on coffee as a product: the warmth of the cup, coffee with milk, and the vision behind every drink.",
      paragraphs: [
        "Gourmand Award, 2012. Named for latte art — written for coffee.",
        "This Coffee Book continues that line: " + DRINKS + " drinks, fully worked. Ingredients, method, serve.",
      ],
      creds: [
        "Crafted by Peter Hernou",
        "20+ years of coffee",
        "World Champion Latte Art",
      ],
      site: "peterhernou.com",
      siteHref: "https://peterhernou.com",
      label: "Peter Hernou",
    });
    const howIndex = out.length;
    out.push({
      type: "how",
      kicker: "Inside every drink",
      title: "Not just a recipe.",
      title2: "A fully worked drink.",
      running: data.title,
      lede: "Twenty years of bar knowledge, written so you can pour from it.",
      paragraphs: [
        "Every drink is one spread: the plate on the left, the recipe on the right. Professional know-how stays close enough to improve the result — without turning every drink into a manual.",
        "House rules, not laws — not a formula. Technique and knowledge help, and they keep evolving.",
      ],
      label: "How to read",
    });
    out.push({
      type: "how-card",
      kicker: "Every spread gives you",
      running: data.title,
      points: ["Ingredients", "Method", "Pro tips", "Serve notes"],
      body: "Photos and home-first steps keep the method clear. Next: how to make the drinks, then a little coffee — so the recipes can stay short.",
      cats: "Espresso · Milk coffees · Chocolate · Cocktails · Signatures",
      label: "How to read",
    });

    const contentsPageIndex = out.length;
    out.push({ type: "contents", title: "Contents", running: data.title, entries: [], label: "Contents" });
    out.push({
      type: "collection",
      kicker: "The collection",
      title: DRINKS + " drinks. One collection.",
      running: data.title,
      lede: "From a single espresso to Peter’s signatures — " + DRINKS + " drinks, built from real bar work.",
      stats: [
        { n: DRINKS, l: "Fully worked drinks" },
        { n: String(data.chapterCount), l: "Chapters" },
      ],
      cats: "Espresso · Brewed · Milk coffees · Chocolate · Cold · Spritz · Classics · Cocktails · Signatures · Seasonal · Peter’s Specials",
      foot: "Open it. Pour something new.",
      label: "The collection",
    });

    const prepIndex = out.length;
    out.push({
      type: "prep",
      kicker: "At home",
      title: "How to make the drinks",
      running: data.title,
      label: "How to make",
      sections: [
        {
          heading: "Beans",
          body: "Freshly roasted, properly rested — ideally 10–14 days after roasting — and ground on demand. The dose is not a universal gram value; it follows the basket or the brew.",
        },
        {
          heading: "Espresso",
          body: "Use a machine where possible. The puck page is the house method: dry and clean, distribute, level, then match tamp, grind and the lock. Time is a check, not a pass/fail. A moka pot can stand in at home; it is strong coffee, not espresso.",
        },
        {
          heading: "Milk",
          body: "Steam to 60–65°C into glossy microfoam. The milk page is the house method — stretch, then texture. Plant milks: test the product.",
        },
        {
          heading: "Cold",
          body: "Chill the glass. Use hard ice. Avoid watery ice and pre-ground coffee.",
        },
        {
          heading: "Taste",
          body: "After tasting, change only one thing at a time: grind, water or contact time.",
        },
      ],
    });
    out.push({
      type: "yields",
      kicker: "House standard",
      title: "Espresso yields",
      running: data.title,
      label: "Espresso yields",
      lede: "Fresh espresso is 30–35 ml in about 25–28 seconds — then adjust for taste.",
      rows: [
        { label: "Ristretto", value: "18–22 ml" },
        { label: "Double ristretto", value: "36–44 ml" },
        { label: "Espresso", value: "30–35 ml" },
        { label: "Double espresso", value: "60–70 ml" },
        { label: "Triple", value: "90–105 ml" },
        { label: "Quad", value: "120–140 ml" },
        { label: "Espresso lungo", value: "50–65 ml, no water added" },
        { label: "Lungo", value: "130–180 ml" },
      ],
      note: "Recipes name the yield. This page is the house reference behind them. Crema is the check: hazelnut, viscous, still there after a stir.",
    });

    const knowIndex = out.length;
    out.push({
      type: "prep",
      kicker: "Behind the recipes",
      title: "A little coffee",
      running: data.title,
      label: "Coffee",
      sections: [
        {
          heading: "Extraction",
          body: "Water dissolves the coffee as it passes through. Early liquid is sharp, the middle is sweet, the late run turns dry and bitter. Stop when the cup is balanced. Time is a check, not a pass.",
        },
        {
          heading: "Water",
          body: "Most of the cup is water. Use fresh filtered water. Distilled water extracts flat. Very hard water mutes the cup and scales the machine.",
        },
        {
          heading: "Milk",
          body: "Sweetness rises as milk warms. 60–65°C is the house window. Stretch, then texture — the milk page takes it from here.",
        },
        {
          heading: "Freshness",
          body: "Rest the roast 10–14 days so the gas settles. Grind on demand — ground coffee stales in minutes, not days.",
        },
      ],
    });
    out.push({
      type: "prep",
      kicker: "Easy to mix up",
      title: "Five different cups",
      running: data.title,
      label: "Coffee",
      sections: [
        {
          heading: "Ristretto",
          body: "The same coffee, less water through the puck. About 18–22 ml. You cut the shot — denser, often sweeter.",
        },
        {
          heading: "Espresso",
          body: "The house shot: about 30–35 ml from the machine. Fresh, short, the reference for every other cup. Crema should sit hazelnut, elastic — it springs back if you stir.",
        },
        {
          heading: "Lungo",
          body: "Still from the machine: more water through the coffee, never water in the cup. Espresso lungo is a longer espresso (about 50–65 ml). A lungo is longer still (about 130–180 ml).",
        },
        {
          heading: "Americano",
          body: "A normal espresso, then hot water in the cup. The shot stays espresso. The length is the water you add after.",
        },
        {
          heading: "Mixed",
          body: "Espresso plus filter in one cup. A red eye is the house example: brew in the cup, espresso on top. The body is the brew. The force is the shot. It is not an americano — you added coffee, not water.",
        },
      ],
    });
    out.push({
      type: "prep",
      kicker: "A little coffee",
      title: "Grind and the kit",
      running: data.title,
      label: "Coffee",
      sections: [
        {
          heading: "Grind",
          body: "Espresso needs a fine, even grind so the water meets resistance. Filter needs coarser, so the water can fall through. Burrs beat blades. Grind on demand — ground coffee stales in minutes. Too fast and pale: grind finer. Too slow and bitter: grind coarser.",
        },
        {
          heading: "Machines",
          body: "When a recipe says espresso, it means a proper espresso machine. Super-automatics vary. Capsules are a different drink. A moka pot can stand in at home: strong coffee, not espresso.",
        },
        {
          heading: "In the hand",
          body: "Pour-over, AeroPress, French press: each has its own grind, dose and time. Follow the brew on the recipe page — not the espresso yields.",
        },
        {
          heading: "Cleaning",
          body: "Knock the puck. Wipe the group. Purge and wipe the steam wand before milk skins on it. Rinse baskets. Descale to your water. Wash the milk kit — wiping is not washing. A dirty machine writes itself into the cup.",
        },
      ],
    });
    out.push({
      type: "prep",
      kicker: "A little coffee",
      title: "The puck",
      running: data.title,
      label: "Coffee",
      sections: [
        {
          heading: "Dry and clean",
          body: "The portafilter and basket must be dry and clean before the dose. Water left in the basket turns the first coffee to mud. Old grounds and oil write into the next shot. Wipe, dry, then dose.",
        },
        {
          heading: "Distribute",
          body: "The dose follows the basket — fill it, do not heap it. Break the clumps and spread the coffee so the bed is even: a finger, a few taps, or a distributor. Gaps and mounds become channels. The water will find them.",
        },
        {
          heading: "Level",
          body: "The surface must sit flat, rim to rim, before you tamp. A high side is a thin side. You cannot press a slope into even.",
        },
        {
          heading: "Tamp",
          body: "Straight down, once. Wrist level, tamp parallel to the floor. Any pressure is good — as long as the grinder is set to that pressure, and you keep them matched. The same for how hard you lock the portafilter into the group. Change the hand, reset the grind. Another barista: set the mill again, or keep the same handling. Do not corkscrew, do not press twice, do not knock the portafilter after.",
        },
        {
          heading: "The check",
          body: "If one side runs faster, or the crema splits, the puck leaked. Fix the distribution before you touch the grinder.",
        },
      ],
    });
    out.push({
      type: "prep",
      kicker: "A little coffee",
      title: "Four extractions",
      running: data.title,
      label: "Coffee",
      sections: [
        {
          heading: "Espresso",
          body: "Pressure, short contact, a concentrated shot. You stop the flow. You do not let it keep running into a bigger cup.",
        },
        {
          heading: "Filter",
          body: "Gravity, hot water through the bed. Pour-over, drip, batch brew. Water at 92–96°C. Same bean, different cup. Do not pour an espresso recipe through a V60 and expect the same drink.",
        },
        {
          heading: "Flotation",
          body: "The grounds steep in the water — they float — then you press or skim them off. French press and cupping live here. Time in the water does the work, not pressure through a puck.",
        },
        {
          heading: "Cold brew",
          body: "Coarse grind, cold water, long steep: hours, not minutes. Low acid, round body. It is not iced filter. Iced filter is hot coffee on ice. Cold brew never saw the heat.",
        },
      ],
    });

    out.push({
      type: "prep",
      kicker: "A little coffee",
      title: "The bean",
      running: data.title,
      label: "Coffee",
      sections: [
        {
          heading: "Roast",
          body: "Light keeps the fruit and the florals — often a filter cup. Medium is the all-round espresso. Dark goes bitter and roasted; milk can carry it. The darker the roast, the less of the farm you taste.",
        },
        {
          heading: "Blend or origin",
          body: "A blend is built to taste the same tomorrow. A single origin tastes of one place, and of that harvest. Guest espresso is the origin in a small cup. The house shots can be either — know which you are pouring.",
        },
        {
          heading: "Rest",
          body: "The bag shows the roast date, not the pack date. Rest 10–14 days so the gas settles. Too new and the shot is gassy. Too old and it is flat. Grind on demand.",
        },
        {
          heading: "Process",
          body: "Washed: the fruit is cleaned off — a clearer cup. Natural: the cherry dries on the bean — more fruit, more body. Honey: some of the fruit stays — between the two. The process is in the cup before you touch the grinder.",
        },
      ],
    });
    out.push({
      type: "prep",
      kicker: "A little coffee",
      title: "Which coffee",
      running: data.title,
      label: "Coffee",
      sections: [
        {
          heading: "Choose",
          body: "Not every coffee belongs in every cup. Origin or blend can both be right — if you choose them for that drink. A coffee that is right as espresso is not automatically right under milk.",
        },
        {
          heading: "Espresso and milk",
          body: "A straight espresso shows everything. Milk still needs a coffee that tastes of coffee. Some origins and blends sit better in milk drinks. Some sit better as espresso.",
        },
        {
          heading: "Filter",
          body: "Filter is another extraction. A blend built for espresso is not a law for the V60. Choose a coffee for the brew you are making.",
        },
        {
          heading: "Cold and nitro",
          body: "Cold brew and nitro never see espresso heat. They can want another coffee — one that stays round after a long steep. Iced espresso is still espresso.",
        },
      ],
    });
    out.push({
      type: "prep",
      kicker: "A little coffee",
      title: "Milk",
      running: data.title,
      label: "Coffee",
      sections: [
        {
          heading: "Stretch, then texture",
          body: "Cold milk, clean jug. Stretch: wand just under the surface, a light hiss — air in, the milk rises. Texture: keep the wand below the surface. Do not put it deeper. A whirlpool turns that air into microfoam.",
        },
        {
          heading: "The window",
          body: "60–65°C. Glossy, not soap. Whole, semi-skimmed, skimmed, lactose-free — any of them can work if you steam to microfoam. Never reheat. Pour while it is still alive.",
        },
        {
          heading: "No wand",
          body: "Warm the milk to 60–65°C. Froth 10–20 seconds, tap, swirl, pour while glossy.",
        },
        {
          heading: "Plant milks",
          body: "They do not steam like dairy. A barista edition is not a rule. Once you can steam well, test the next product. If the cup is good, the product is good — barista edition or not.",
        },
      ],
    });
    out.push({
      type: "prep",
      kicker: "A little coffee",
      title: "Ice",
      running: data.title,
      label: "Coffee",
      sections: [
        {
          heading: "Hard ice",
          body: "A cold drink lives on the ice. Use a lot of it, and use it hard. Wet, small cubes melt into the cup and you served water.",
        },
        {
          heading: "The glass",
          body: "Chill a thick glass. Thin china and paper will not hold the cold. The drink should still be cold at the last sip.",
        },
        {
          heading: "The shot",
          body: "Pour the espresso last, directly over the ice. That shock-cooling keeps taste and texture. For an iced latte: cold milk and ice first, then the shot on top — you see it fall. An iced americano is espresso, cold water, ice. Not a lungo on cubes.",
        },
        {
          heading: "Cold brew",
          body: "Hours in cold water, never the heat. Serve it cold, on ice, or with milk. It is not iced filter. Iced filter is yesterday’s hot coffee, cooled.",
        },
      ],
    });

    padSpread(out);

    data.chapters.forEach((chapter) => {
      const chapterIndex = out.length;
      chapterJump.set(chapter.id, chapterIndex);
      const mosaic = chapterMosaic(chapter);
      out.push({
        type: "chapter-plate",
        title: chapter.title,
        mosaic: mosaic.tiles,
        layout: mosaic.layout,
        hero: mosaic.tiles.length >= 2 ? null : chapterOpener(chapter),
        running: data.title,
        label: chapter.title,
        chapterId: chapter.id,
      });
      out.push({
        type: "chapter",
        title: chapter.title,
        count: `${chapter.recipes.length} drinks`,
        lede: (CHAPTER_OPENERS[chapter.id] || {}).lede || "",
        body: (CHAPTER_OPENERS[chapter.id] || {}).body || "",
        running: data.title,
        label: chapter.title,
        chapterId: chapter.id,
      });
      chapter.recipes.forEach((recipe) => {
        recipe.jump = out.length;
        out.push({
          type: "plate",
          title: recipe.title,
          chapter: chapter.title,
          photo: recipe.photo,
          recipeId: recipe.id,
          running: chapter.title,
        });
        out.push(bookRecipe(recipe, chapter));
      });
    });

    padSpread(out);

    const indexEntries = data.chapters
      .flatMap((chapter) => chapter.recipes.map((recipe) => ({ label: recipe.title, jump: recipe.jump, chapter: chapter.title })))
      .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));

    const indexStart = out.length;
    const indexPages = paginateIndex(indexEntries, 10);
    balanceFacingPages(indexPages);
    unstubFacingPages(indexPages);
    compactIndexTail(indexPages, 12);
    indexPages.forEach((entries, i) => {
      out.push({
        type: "index",
        title: "A–Z",
        continued: i > 0,
        running: data.title,
        entries,
        label: "Index",
      });
    });

    padSpread(out);

    const closeIndex = out.length;
    out.push({
      type: "closing-lead",
      kicker: "The book",
      title: DRINKS + " drinks.",
      title2: "Fully worked.",
      running: data.title,
      lede: "Ingredients, method, serve. From a single espresso to Peter’s signatures.",
      paragraphs: [
        "Every drink is one spread: the plate on the left, the recipe on the right. Professional know-how stays close enough to improve the result — without turning every drink into a manual.",
      ],
      label: "Close",
    });
    out.push({
      type: "closing",
      kicker: "Peter Hernou",
      title: "Open it.",
      title2: "Pour something new.",
      running: data.title,
      lede: "This Coffee Book continues the line of Latte Arte: coffee as a product, the warmth of the cup, the vision behind every drink.",
      paragraphs: [
        DRINKS + " drinks, written so you can pour from them. Named for the work — not for foam.",
        "Crafted by Peter Hernou. Twenty years of coffee. World Champion Latte Art.",
      ],
      creds: ["PHMENU.STUDIO", "World Champion Latte Art"],
      site: "peterhernou.com",
      siteHref: "https://peterhernou.com",
      label: "Close",
    });

    if (out.length % 2) out.push({ type: "blank", label: "" });

    out.forEach((page, i) => {
      if (page.type !== "cover" && page.type !== "ghost") page.number = i;
    });

    const contents = out[contentsPageIndex];
    contents.entries = [
      { label: "Latte Arte", jump: 2, number: out[2] ? out[2].number : "" },
      { label: "How to read this book", jump: howIndex, number: out[howIndex] ? out[howIndex].number : "" },
      { label: "How to make the drinks", jump: prepIndex, number: out[prepIndex] ? out[prepIndex].number : "" },
      { label: "A little coffee", jump: knowIndex, number: out[knowIndex] ? out[knowIndex].number : "" },
      { label: "The puck", jump: knowIndex + 3, number: out[knowIndex + 3] ? out[knowIndex + 3].number : "" },
      { label: "The bean", jump: knowIndex + 5, number: out[knowIndex + 5] ? out[knowIndex + 5].number : "" },
      { label: "Which coffee", jump: knowIndex + 6, number: out[knowIndex + 6] ? out[knowIndex + 6].number : "" },
      { label: "Milk", jump: knowIndex + 7, number: out[knowIndex + 7] ? out[knowIndex + 7].number : "" },
      { label: "Ice", jump: knowIndex + 8, number: out[knowIndex + 8] ? out[knowIndex + 8].number : "" },
    ].concat(
      data.chapters.map((chapter) => {
        const jump = chapterJump.get(chapter.id);
        return {
          label: chapter.title,
          jump,
          number: out[jump] ? out[jump].number : "",
        };
      })
    ).concat([
      { label: "A–Z", jump: indexStart, number: out[indexStart] ? out[indexStart].number : "" },
      { label: "Close", jump: closeIndex, number: out[closeIndex] ? out[closeIndex].number : "" },
    ]);

    out.forEach((page) => {
      if (page.type !== "index") return;
      page.entries.forEach((entry) => {
        if (entry.type === "letter") return;
        entry.number = out[entry.jump] ? out[entry.jump].number : "";
      });
    });

    return out;
  }

  function currentIndex() {
    return pageFlip ? pageFlip.getCurrentPageIndex() : 0;
  }

  function minPageIndex() {
    return pageFlip && pageFlip.getOrientation() === "portrait" ? 1 : 0;
  }

  function labelFor(index) {
    const page = pages[index];
    if (!page || page.type === "cover" || page.type === "ghost") return "Cover";
    if (page.type === "lineage" || page.type === "lineage-plate") return "Latte Arte";
    if (page.type === "how" || page.type === "how-card") return "How to read";
    if (page.type === "collection") return "The collection";
    if (page.label === "Coffee") return "Coffee";
    if (page.type === "closing" || page.type === "closing-lead") return "Close";
    if (index >= pageCount - 1) return "End";
    const portrait = pageFlip && pageFlip.getOrientation() === "portrait";
    if (!portrait && index % 2 === 0 && index + 1 < pageCount) {
      return `${index}–${index + 1}`;
    }
    return String(index);
  }

  function syncChrome() {
    if (!pageFlip) return;
    const index = currentIndex();
    posEl.textContent = labelFor(index);
    barEl.style.width = `${((index + 1) / pageCount) * 100}%`;
    const atStart = index <= minPageIndex();
    const atEnd = index >= pageCount - 1;
    $("prev").disabled = atStart;
    $("next").disabled = atEnd;
    $("prevBtn").disabled = atStart;
    $("nextBtn").disabled = atEnd;
  }

  const IMG_PARALLEL = 4;
  let imgWait = [];
  let imgBusy = 0;

  function pageElements() {
    try {
      return pageFlip.getPageCollection().getPages().map((page) => page.getElement());
    } catch (err) {
      return [...bookEl.querySelectorAll(".stf__item.leaf")];
    }
  }

  function activateImg(img, first) {
    if (img.naturalWidth || img.getAttribute("src")) return;
    const src = img.dataset.src;
    if (!src) return;
    if (img.dataset.q === "1") {
      if (first) {
        imgWait = imgWait.filter((item) => item !== img);
        imgWait.unshift(img);
      }
      return;
    }
    img.dataset.q = "1";
    if (first) imgWait.unshift(img);
    else imgWait.push(img);
    pumpImgs();
  }

  function pumpImgs() {
    while (imgBusy < IMG_PARALLEL && imgWait.length) {
      const img = imgWait.shift();
      const src = img.dataset.src;
      if (!src || img.naturalWidth) continue;
      imgBusy += 1;
      const done = () => {
        imgBusy = Math.max(0, imgBusy - 1);
        pumpImgs();
      };
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      img.src = src;
    }
  }

  function preferPages(center) {
    if (!pageFlip) return;
    const leaves = pageElements();
    if (!leaves.length) return;
    const index = Math.max(0, Math.min(center, leaves.length - 1));
    for (let dist = 0; dist < leaves.length; dist++) {
      const first = dist <= 5;
      const targets = dist === 0 ? [index] : [index - dist, index + dist];
      targets.forEach((idx) => {
        if (idx < 0 || idx >= leaves.length) return;
        leaves[idx].querySelectorAll("img").forEach((img) => activateImg(img, first));
      });
    }
  }

  function flip(dir) {
    if (!pageFlip) return;
    const now = performance.now();
    if (now - lastFlip < FLIP_MS) return;
    const index = currentIndex();
    if (dir < 0 && index <= minPageIndex()) return;
    if (dir > 0 && index >= pageCount - 1) return;
    const state = pageFlip.getState();
    if (state === "flipping" || state === "user_fold") return;
    lastFlip = now;
    preferPages(index + (dir > 0 ? 2 : -2));
    const rect = pageFlip.getBoundsRect();
    const inset = 12;
    pageFlip.getFlipController().flip({
      x: dir > 0 ? rect.left + rect.width - inset : rect.left + inset,
      y: rect.top + rect.height - inset,
    });
  }

  function goTo(pageIndex) {
    overlay.hidden = true;
    if (!pageFlip) return;
    const target = Math.max(0, Math.min(pageIndex, pageCount - 1));
    preferPages(target);
    pageFlip.turnToPage(target);
    syncChrome();
  }

  function bindJumps(root) {
    root.querySelectorAll("[data-jump]").forEach((node) => {
      node.addEventListener("click", () => {
        const jump = Number(node.getAttribute("data-jump"));
        if (Number.isFinite(jump)) goTo(jump);
      });
    });
  }

  function setOpenChapter(section) {
    contentsBody.querySelectorAll(".overlay__group.is-open").forEach((open) => {
      if (open === section) return;
      open.classList.remove("is-open");
      const btn = open.querySelector(".overlay__chapter");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
    if (!section) return;
    const opening = !section.classList.contains("is-open");
    section.classList.toggle("is-open", opening);
    const btn = section.querySelector(".overlay__chapter");
    if (btn) btn.setAttribute("aria-expanded", opening ? "true" : "false");
  }

  function renderContents(filter) {
    const needle = String(filter || "").trim().toLowerCase();
    contentsBody.innerHTML = book.chapters
      .map((chapter, index) => {
        const recipes = chapter.recipes.filter((recipe) => {
          if (!needle) return true;
          return `${recipe.title} ${chapter.title}`.toLowerCase().includes(needle);
        });
        if (!recipes.length) return "";
        const open = Boolean(needle);
        return `<section class="overlay__group${open ? " is-open" : ""}" data-chapter="${index}">
          <button type="button" class="overlay__chapter" aria-expanded="${open ? "true" : "false"}">
            <span>${escapeHtml(chapter.title)}</span>
            <svg class="overlay__chevron" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 4.25 L6 8.25 L9.5 4.25" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>
            </svg>
          </button>
          <div class="overlay__recipes">
            <div class="overlay__recipes-inner">
            ${recipes
              .map((recipe) => `<button type="button" data-jump="${recipe.jump}">${escapeHtml(recipe.title)}</button>`)
              .join("")}
            </div>
          </div>
        </section>`;
      })
      .join("");
    bindJumps(contentsBody);
    contentsBody.querySelectorAll(".overlay__chapter").forEach((btn) => {
      btn.addEventListener("click", () => setOpenChapter(btn.closest(".overlay__group")));
    });
  }

  function bindUi() {
    $("next").addEventListener("click", () => flip(1));
    $("prev").addEventListener("click", () => flip(-1));
    $("nextBtn").addEventListener("click", () => flip(1));
    $("prevBtn").addEventListener("click", () => flip(-1));
    soundBtn.addEventListener("click", () => {
      soundOn = !soundOn;
      soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
      soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
    });
    $("contentsBtn").addEventListener("click", () => {
      overlay.hidden = false;
      if (!String(searchInput.value || "").trim()) setOpenChapter(null);
      searchInput.focus();
    });
    $("contentsClose").addEventListener("click", () => {
      overlay.hidden = true;
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.hidden = true;
    });
    searchInput.addEventListener("input", () => renderContents(searchInput.value));
    bookEl.addEventListener("click", (e) => {
      const jump = e.target.closest("[data-jump]");
      if (!jump) return;
      const index = Number(jump.getAttribute("data-jump"));
      if (Number.isFinite(index)) goTo(index);
    });
    document.addEventListener("keydown", (e) => {
      if (overlay.hidden === false && e.key === "Escape") {
        overlay.hidden = true;
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        flip(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        flip(-1);
      }
    });
  }

  async function boot() {
    const [bookRes, copyRes] = await Promise.all([
      fetch("./data/book.json"),
      fetch("./data/page-copy.json"),
    ]);
    book = await bookRes.json();
    pageCopy = copyRes.ok ? await copyRes.json() : {};
    pages = buildPages(book);
    pageCount = pages.length;
    const cover = pages.find((page) => page.type === "cover");
    (cover && cover.mosaic ? cover.mosaic : []).forEach((tile) => {
      const preload = new Image();
      preload.src = photoSrc(tile.src);
    });
    bindUi();
    renderContents("");

    const portrait = window.matchMedia("(max-width: 800px)").matches;
    pageFlip = new St.PageFlip(bookEl, {
      width: 420,
      height: 594,
      size: "stretch",
      minWidth: 280,
      maxWidth: portrait ? 400 : 480,
      minHeight: 360,
      maxHeight: portrait ? 560 : 760,
      drawShadow: true,
      maxShadowOpacity: 0.35,
      showCover: false,
      startPage: portrait ? 1 : 0,
      usePortrait: portrait,
      autoSize: true,
      mobileScrollSupport: false,
      swipeDistance: 28,
      flippingTime: FLIP_ANIM_MS,
      useMouseEvents: true,
      showPageCorners: true,
      disableFlipByClick: true,
      clickEventForward: true,
    });

    pageFlip.loadFromHTML(pages.map((page, i) => leafNode(page, i, pageCount)));
    try {
      pageFlip.getPageCollection().getPages().forEach((page) => {
        page.setDensity("soft");
        if (typeof page.setDrawingDensity === "function") page.setDrawingDensity("soft");
      });
    } catch (err) {}
    pageFlip.on("flip", () => {
      syncChrome();
      preferPages(currentIndex());
    });
    pageFlip.on("changeState", (ev) => {
      if (ev && ev.data === "flipping") playTurn();
      syncChrome();
    });
    pageFlip.on("init", () => {
      syncChrome();
      const coverImgs = [...bookEl.querySelectorAll(".leaf--cover img")];
      const wait = coverImgs.filter((img) => !img.complete);
      const startRest = () => preferPages(currentIndex());
      if (!wait.length) {
        startRest();
        return;
      }
      let left = wait.length;
      const done = () => {
        left -= 1;
        if (left <= 0) startRest();
      };
      wait.forEach((img) => {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
      setTimeout(startRest, 2000);
    });
    syncChrome();
  }

  boot().catch((err) => {
    posEl.textContent = "Could not load Coffee Book.";
    console.error(err);
  });
})();
