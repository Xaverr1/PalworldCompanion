// Scrapes each pal's wild-spawn locations from paldb.cc into
// src/data/locations.json: the named map regions it spawns in (day / night),
// with in-game coordinates, plus its dungeon spawns and level range.
//
//   node scripts/build-locations.mjs               # all pals
//   node scripts/build-locations.mjs Lamball Anubis # just these (prints, no write)
//
// Two paldb sources are combined (both cached under scripts/.cache/):
//   1. /paldex/<code>.json  -> raw day/night spawn points (world coordinates)
//   2. the pal page HTML     -> named dungeons + overworld level range
// Named regions + the world->in-game coordinate transform come from
// /js/map_data_en.js (regionData + config).
//
// paldb's spawn points MIX IN the separate "The World Tree" map (a shared
// high-altitude point set that falls outside the Palpagos world bounds). We
// drop those before mapping to regions; their presence just flags worldTree.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "src", "data");
const cacheDir = join(here, ".cache");
mkdirSync(cacheDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET text, caching to scripts/.cache/. `allow404` returns "" instead of throwing. */
async function get(url, cacheName, allow404 = false) {
  const cacheFile = join(cacheDir, cacheName);
  if (existsSync(cacheFile)) return readFileSync(cacheFile, "utf8");
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (PalworldCompanion data build)" },
  });
  if (res.status === 404 && allow404) {
    writeFileSync(cacheFile, "");
    return "";
  }
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  const text = await res.text();
  writeFileSync(cacheFile, text);
  await sleep(120); // be polite between live fetches
  return text;
}

// --- Map regions + coordinate transform --------------------------------------
// Extract the `name = [...]` / `name = {...}` literal that follows in `js`.
function extractLiteral(js, name, open, close) {
  const start = js.indexOf(name);
  if (start < 0) throw new Error(`${name} not found in map data`);
  let i = js.indexOf(open, start),
    depth = 0;
  for (let j = i; j < js.length; j++) {
    if (js[j] === open) depth++;
    else if (js[j] === close && --depth === 0)
      return JSON.parse(js.slice(i, j + 1));
  }
  throw new Error(`unterminated ${name}`);
}

const mapJs = await get(
  "https://paldb.cc/js/map_data_en.js",
  "map_data_en.js",
);
const config = extractLiteral(mapJs, "config = {", "{", "}");
const rawRegions = extractLiteral(mapJs, "regionData = [", "[", "]");
const fixedDungeon = extractLiteral(mapJs, "fixedDungeon = [", "[", "]");

const MIN = config.landScapeRealPositionMin;
const MAX = config.landScapeRealPositionMax;
const PER_PIXEL = 459; // paldb map page `options`
const OFF_X = -582888;
const OFF_Y = -301000;
const txPix = (MAX.X - MIN.X) / PER_PIXEL;
const tyPix = (MAX.Y - MIN.Y) / PER_PIXEL;
const ingameXStart = 1000 + (OFF_X - MIN.X) / PER_PIXEL;
const ingameYStart = 1000 + (OFF_Y - MIN.Y) / PER_PIXEL;

/** paldb's world-position -> in-game map coordinate (projIpos ∘ rposToScale). */
function toIngame(p) {
  const sX = (p.X - MIN.X) / (MAX.X - MIN.X);
  const sY = (p.Y - MIN.Y) / (MAX.Y - MIN.Y);
  return {
    X: Math.round(sY * tyPix - ingameYStart),
    Y: Math.round(sX * txPix - ingameXStart),
  };
}

const inBounds = (p) =>
  p.X >= MIN.X && p.X <= MAX.X && p.Y >= MIN.Y && p.Y <= MAX.Y;

// Named regions only (drop unnamed "-" markers); strip "Lv.xx-yy " prefixes.
const REGIONS = rawRegions
  .filter((r) => r.type === "Region" && r.item && r.item !== "-")
  .map((r) => ({
    name: r.item.replace(/^Lv\.[\d\-–~]+\s+/, ""),
    x: r.ipos.X,
    y: r.ipos.Y,
  }));

// Fixed "Alpha Pal" field bosses, keyed by id (e.g. "boss_jetdragon"). Used as
// a fallback location for legendaries/variants that have no wild spawn points.
const BOSS_BY_ID = new Map(
  fixedDungeon
    .filter((e) => e.type === "Alpha Pal" && e.id && e.pos)
    .map((e) => [e.id.toLowerCase(), e]),
);

function nearestRegion(ip) {
  let best = REGIONS[0],
    bd = Infinity;
  for (const r of REGIONS) {
    const d = (ip.X - r.x) ** 2 + (ip.Y - r.y) ** 2;
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}

/** Top spawn regions for a set of points: those holding >=12% of them, max 3. */
function topRegions(points) {
  const kept = points.filter(inBounds);
  if (!kept.length) return [];
  const tally = new Map(); // name -> { count, x, y }
  for (const p of kept) {
    const r = nearestRegion(toIngame(p));
    const e = tally.get(r.name) ?? { count: 0, x: r.x, y: r.y };
    e.count++;
    tally.set(r.name, e);
  }
  const arr = [...tally.entries()]
    .map(([name, e]) => ({ name, x: e.x, y: e.y, count: e.count }))
    .sort((a, b) => b.count - a.count);
  // Always keep the dominant region; add others only if they hold a real
  // share (>=12% and >=2 points) so a handful of stray spawns don't add noise.
  return arr
    .filter((r, i) => i === 0 || (r.count >= 2 && r.count >= kept.length * 0.12))
    .slice(0, 3)
    .map(({ name, x, y }) => ({ name, x, y }));
}

// --- Pal page: dungeons + overworld level range ------------------------------
const LEVEL_RE = /<span class="level">(\d+)&ndash;(\d+)<\/span>/;

function spawnerTable(html) {
  const h = html.indexOf(">Spawner<");
  if (h < 0) return "";
  const t = html.indexOf("<table", h);
  const end = html.indexOf("</table>", t);
  return t < 0 || end < 0 ? "" : html.slice(t, end + 8);
}

/** Parse dungeon spawns + overworld field level range from the pal page. */
function parsePage(html, code) {
  const rows = spawnerTable(html).split("<tr>").slice(1);
  let owMin = Infinity,
    owMax = 0,
    hasOw = false,
    sawDungeon = false,
    dgMin = Infinity,
    dgMax = 0;
  const dungeonNames = new Set();

  for (const row of rows) {
    const idm = /data-pal-id="([^"]+)"/.exec(row);
    if (!idm || idm[1] !== code) continue; // this pal only (skip alphas/others)
    const lvl = LEVEL_RE.exec(row);
    if (row.includes("T_icon_compass_dungeon")) {
      sawDungeon = true;
      // Dungeon links after the compass icon; paldb marks unknown ones "???".
      for (const lm of row.matchAll(/<a href="[^"]+">([^<]+)<\/a>/g)) {
        const name = lm[1].trim();
        if (name && name !== "???") dungeonNames.add(name);
      }
      if (lvl) {
        dgMin = Math.min(dgMin, +lvl[1]);
        dgMax = Math.max(dgMax, +lvl[2]);
      }
    } else if (row.includes("?spawner=") && lvl) {
      hasOw = true;
      owMin = Math.min(owMin, +lvl[1]);
      owMax = Math.max(owMax, +lvl[2]);
    }
  }

  return {
    overworld: hasOw ? { min: owMin, max: owMax } : null,
    dungeons: sawDungeon
      ? {
          names: [...dungeonNames],
          min: dgMin === Infinity ? null : dgMin,
          max: dgMax || null,
        }
      : null,
  };
}

// --- Run ---------------------------------------------------------------------
const pals = JSON.parse(readFileSync(join(dataDir, "pals.json"), "utf8"));
const argv = process.argv.slice(2);
const targets = argv.length
  ? pals.filter((p) => argv.includes(p.slug) || argv.includes(p.name))
  : pals;

const out = {};
let done = 0,
  withData = 0;
for (const p of targets) {
  const page = await get(
    `https://paldb.cc/en/${p.slug}`,
    `pal_${p.slug.replace(/[^\w.-]/g, "_")}.html`,
  );
  const { overworld, dungeons } = parsePage(page, p.code);

  const dexRaw = await get(
    `https://paldb.cc/paldex/${p.code.toLowerCase()}.json`,
    `paldex_${p.code.toLowerCase().replace(/[^\w.-]/g, "_")}.json`,
    true,
  );
  let day = [],
    night = [],
    worldTree = false;
  if (dexRaw) {
    const dex = JSON.parse(dexRaw);
    const dayPts = dex.dayTimeLocations?.Locations ?? [];
    const nightPts = dex.nightTimeLocations?.Locations ?? [];
    day = topRegions(dayPts);
    night = topRegions(nightPts);
    worldTree = [...dayPts, ...nightPts].some((pt) => !inBounds(pt));
  }

  // Legendaries / alpha-only variants have no wild spawns — fall back to the
  // pal's fixed Alpha boss location (its exact spot on the map).
  let boss = null;
  if (!day.length && !night.length) {
    const b = BOSS_BY_ID.get(`boss_${p.code.toLowerCase()}`);
    if (b && inBounds(b.pos)) {
      const ip = toIngame(b.pos);
      boss = {
        name: nearestRegion(ip).name,
        x: ip.X,
        y: ip.Y,
        lv: b.lv ?? null,
      };
    }
  }

  const loc = {
    day: day.length ? day : null,
    night: night.length ? night : null,
    overworld,
    dungeons,
    boss,
    worldTree,
  };
  if (loc.day || loc.night || loc.dungeons || loc.boss || loc.worldTree) {
    out[p.slug] = loc;
    withData++;
  }
  if (++done % 25 === 0) console.log(`  ${done}/${targets.length}`);
}

if (argv.length) {
  console.log(JSON.stringify(out, null, 2));
} else {
  const outFile = join(dataDir, "locations.json");
  writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");
  console.log(
    `\nWrote ${outFile}\n  ${withData}/${targets.length} pals have wild-spawn data`,
  );
}
