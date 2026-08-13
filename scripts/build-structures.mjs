// Scrapes buildable structures + their material costs from paldb.cc into
// src/data/structures.json. paldb.cc serves static server-rendered HTML, so we
// parse it with regexes (same source we already use for every icon URL).
//
//   node scripts/build-structures.mjs
//
// Fetched HTML is cached under scripts/.cache/ (git-ignored) so re-runs are
// cheap and polite. Delete the cache to force a fresh pull.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "src", "data");
const cacheDir = join(here, ".cache");
mkdirSync(cacheDir, { recursive: true });

const BASE = "https://paldb.cc/en/";
// The nine in-game construction tabs (build menu categories), in menu order.
const CATEGORIES = [
  "Production",
  "Food",
  "Infrastructure",
  "Storage",
  "Foundations",
  "Defenses",
  "Lighting",
  "Furniture",
  "Other",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch a paldb page, caching the raw HTML to disk. */
async function getPage(slug) {
  const cacheFile = join(cacheDir, `${slug.replace(/[^\w.-]/g, "_")}.html`);
  if (existsSync(cacheFile)) return readFileSync(cacheFile, "utf8");
  const res = await fetch(BASE + slug, {
    headers: { "user-agent": "Mozilla/5.0 (PalworldCompanion data build)" },
  });
  if (!res.ok) throw new Error(`GET ${slug} -> HTTP ${res.status}`);
  const html = await res.text();
  writeFileSync(cacheFile, html);
  await sleep(150); // be polite between live fetches
  return html;
}

const stripTags = (s) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const nameFromSlug = (slug) => decodeURIComponent(slug).replace(/_/g, " ");

// --- Category pages: enumerate buildable structures --------------------------
// Structures are <a href="Slug"><img src=".../BuildObject/PNG/T_icon_buildObject_*"/></a>,
// grouped under <div class="productUiDisplayTitle">Subsection</div> headers.
function parseCategory(html, category) {
  const out = [];
  // Split on subsection titles so we can attribute each structure to one.
  const parts = html.split(
    /<div class="productUiDisplayTitle[^"]*">([^<]*)<\/div>/,
  );
  // parts[0] is preamble; then alternating [title, block, title, block, ...].
  for (let i = 1; i < parts.length; i += 2) {
    const subcategory = stripTags(parts[i]);
    const block = parts[i + 1] ?? "";
    const linkRe =
      /<a[^>]*href="([^"#][^"]*)"[^>]*>\s*<img[^>]*src="([^"]*buildObject[^"]*)"/gi;
    let m;
    while ((m = linkRe.exec(block))) {
      out.push({ slug: m[1], icon: m[2], category, subcategory });
    }
  }
  return out;
}

// --- Structure page: parse the build recipe ----------------------------------
// The Production table's rows are `<td>materials<td>product<td>schematic`.
// We want the row whose product is this structure itself. Materials cell holds
// <a class="itemname" href="Mat">..<img src=ICON/>Name</a> <small class="itemQuantity">N</small>.
const MAT_RE =
  /<a class="itemname"[^>]*href="([^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*\/?>\s*([^<]*)<\/a>\s*<small class="itemQuantity">(\d+)<\/small>/g;

function parseMaterialsCell(cell) {
  const mats = [];
  let m;
  MAT_RE.lastIndex = 0;
  while ((m = MAT_RE.exec(cell))) {
    mats.push({
      slug: decodeURIComponent(m[1]),
      icon: m[2],
      name: stripTags(m[3]) || nameFromSlug(m[1]),
      qty: Number(m[4]),
    });
  }
  return mats;
}

function parseRecipe(html, structureName) {
  const target = norm(structureName);
  const tables = html.match(/<table[\s\S]*?<\/table>/g) ?? [];
  for (const table of tables) {
    if (!/>\s*Materials\s*</.test(table)) continue;
    const rows = table.split(/<tr>/).slice(1);
    for (const row of rows) {
      if (!row.includes("itemQuantity")) continue;
      const cells = row.split(/<td>/);
      if (cells.length < 3) continue;
      const matCell = cells[1];
      const productText = stripTags(cells[2]);
      if (norm(productText) !== target) continue;
      const mats = parseMaterialsCell(matCell);
      if (mats.length) return mats;
    }
  }
  return null;
}

// --- Run ---------------------------------------------------------------------
console.log("Fetching category pages...");
const seen = new Map(); // slug -> { slug, name, category, subcategory, icon }
for (const cat of CATEGORIES) {
  const html = await getPage(cat);
  const entries = parseCategory(html, cat);
  for (const e of entries) {
    if (seen.has(e.slug)) continue; // first category wins
    seen.set(e.slug, {
      slug: e.slug,
      name: nameFromSlug(e.slug),
      category: e.category,
      subcategory: e.subcategory,
      icon: e.icon,
    });
  }
  console.log(`  ${cat}: ${entries.length} structure links`);
}
console.log(`Unique structures: ${seen.size}`);

console.log("Fetching structure recipes...");
const structures = [];
const materials = {}; // slug -> { name, icon }
const noRecipe = [];
let done = 0;
for (const s of seen.values()) {
  const html = await getPage(s.slug);
  const mats = parseRecipe(html, s.name);
  if (!mats) {
    noRecipe.push(s.slug);
  } else {
    for (const m of mats) {
      if (!materials[m.slug]) materials[m.slug] = { name: m.name, icon: m.icon };
    }
  }
  structures.push({
    slug: s.slug,
    name: s.name,
    category: s.category,
    subcategory: s.subcategory,
    icon: s.icon,
    materials: (mats ?? []).map((m) => ({ slug: m.slug, qty: m.qty })),
  });
  if (++done % 25 === 0) console.log(`  ${done}/${seen.size}`);
}

structures.sort(
  (a, b) =>
    CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
    a.subcategory.localeCompare(b.subcategory) ||
    a.name.localeCompare(b.name),
);

const outFile = join(dataDir, "structures.json");
writeFileSync(
  outFile,
  JSON.stringify({ structures, materials }, null, 2) + "\n",
);
console.log(
  `\nWrote ${outFile}\n  ${structures.length} structures, ` +
    `${Object.keys(materials).length} distinct materials`,
);
if (noRecipe.length) {
  console.log(`\n${noRecipe.length} structures had NO parseable recipe:`);
  console.log("  " + noRecipe.join(", "));
}
