// Builds src/data/breeding.json — the data a breeding planner needs:
//   • combiRank (breeding power) + dupPriority per breedable pal
//   • pool: the pals eligible as a *normal* breeding result, sorted by rank
//   • unique: the special parent-pair → child overrides (Anubis, etc.)
//
//   node scripts/build-breeding.mjs
//
// Sources (both paldb.cc, cached under scripts/.cache/, git-ignored):
//   1. pal page HTML  -> CombiRank + CombiDuplicatePriority   (already cached
//      by build-locations.mjs as pal_<slug>.html)
//   2. /en/api/pal_breed_2a?parent2a=<code> -> that pal paired with every other
//      pal and the resulting child (the full breeding matrix, one row per call)
//
// Palworld's normal breeding is deterministic: child =
//   argmin_pal |combiRank(pal) - floor((rankA + rankB + 1) / 2)|
// over the result pool, with a handful of hard-coded unique combos on top. We
// DON'T trust a hand-copied unique list: we pull paldb's full matrix as ground
// truth, reproduce it with (pool nearest-rank) + (unique overrides), and ASSERT
// the reproduction is byte-exact. Any pair the formula misses becomes an
// override, so the emitted data + the runtime formula reproduce paldb exactly.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "src", "data");
const cacheDir = join(here, ".cache");
mkdirSync(cacheDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET text, caching to scripts/.cache/. */
async function get(url, cacheName) {
  const cacheFile = join(cacheDir, cacheName);
  if (existsSync(cacheFile)) return readFileSync(cacheFile, "utf8");
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (PalworldCompanion data build)" },
  });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  const text = await res.text();
  writeFileSync(cacheFile, text);
  await sleep(150); // be polite between live fetches
  return text;
}

const palCache = (slug) => `pal_${slug.replace(/[^\w.-]/g, "_")}.html`;
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const RANK_RE = /CombiRank<\/a><\/div>[\s\S]*?<div>(\d+)<\/div>/;
const DUP_RE = /CombiDuplicatePriority<\/div>\s*<div>(\d+)<\/div>/;

// --- 1. Pals + CombiRank -----------------------------------------------------
const pals = JSON.parse(readFileSync(join(dataDir, "pals.json"), "utf8"));
const codeSet = new Set(pals.map((p) => p.code));
const meta = new Map(); // code -> { name, combiRank, dup }

for (const p of pals) {
  const html = await get(`https://paldb.cc/en/${p.slug}`, palCache(p.slug));
  const rank = html.match(RANK_RE);
  const dup = html.match(DUP_RE);
  if (!rank) continue; // no CombiRank -> not breedable (towers, NPCs, ...)
  meta.set(p.code, {
    name: p.name,
    combiRank: Number(rank[1]),
    dup: dup ? Number(dup[1]) : Number(rank[1]) * 100,
  });
}
console.log(`Breedable pals with CombiRank: ${meta.size}/${pals.length}`);

// --- 2. Ground-truth breeding matrix ----------------------------------------
// pal_breed_2a returns flat [parentA, parentB, child] triples, parentA fixed.
const truth = new Map(); // key(a,b) -> childCode
let unknownChild = 0;
let done = 0;
for (const code of meta.keys()) {
  const html = await get(
    `https://paldb.cc/en/api/pal_breed_2a?parent2a=${encodeURIComponent(code)}`,
    `breed2a_${code.replace(/[^\w.-]/g, "_")}.html`,
  );
  const ids = [...html.matchAll(/data-pal-id="([^"]+)"/g)].map((m) => m[1]);
  if (ids.length % 3 !== 0)
    throw new Error(`${code}: ${ids.length} pal ids (not a multiple of 3)`);
  for (let i = 0; i < ids.length; i += 3) {
    const [a, b, child] = [ids[i], ids[i + 1], ids[i + 2]];
    // paldb sorts each pair for display, so the queried pal may be a OR b —
    // just require it's one of the two parents (child is always the 3rd anchor).
    if (a !== code && b !== code)
      throw new Error(`${code}: row parents=${a},${b} exclude queried pal`);
    if (!meta.has(a) || !meta.has(b)) continue; // partner not breedable/known
    if (!codeSet.has(child)) {
      unknownChild++;
      continue; // child is a form we don't carry; can't represent it
    }
    const k = key(a, b);
    const prev = truth.get(k);
    if (prev !== undefined && prev !== child)
      throw new Error(`Asymmetric combo ${k}: ${prev} vs ${child}`);
    truth.set(k, child);
  }
  if (++done % 40 === 0) console.log(`  matrix ${done}/${meta.size}`);
}
console.log(
  `Matrix pairs: ${truth.size} (skipped ${unknownChild} with off-dex child)`,
);

// --- 3. Derive normal-result pool + unique overrides ------------------------
const childRank = (a, b) =>
  Math.floor((meta.get(a).combiRank + meta.get(b).combiRank + 1) / 2);

/** Nearest pal in `pool` to a target rank; ties pick the HIGHER rank (paldb's
 *  rule — ranks are spaced by 10 so targets land dead-centre constantly). */
function nearest(pool, target) {
  let best = null;
  for (const code of pool) {
    const m = meta.get(code);
    const d = Math.abs(m.combiRank - target);
    if (
      !best ||
      d < best.d ||
      (d === best.d && m.combiRank > best.combiRank) ||
      (d === best.d && m.combiRank === best.combiRank && m.dup < best.dup)
    ) {
      best = { code, d, combiRank: m.combiRank, dup: m.dup };
    }
  }
  return best?.code ?? null;
}

// The normal-result pool: for each target rank, the child produced by the most
// pairs is the ordinary nearest-rank result; variant forms (Cryst/Ignis/...) and
// legendaries only ever appear via their own unique combos, so they lose the
// plurality and stay out of the pool.
const tally = new Map(); // target rank -> Map(childCode -> count)
for (const [k, child] of truth) {
  const [a, b] = k.split("|");
  const t = childRank(a, b);
  let m = tally.get(t);
  if (!m) tally.set(t, (m = new Map()));
  m.set(child, (m.get(child) ?? 0) + 1);
}
const pool = new Set();
for (const m of tally.values()) {
  let bestC = null,
    bestN = -1;
  for (const [c, n] of m) {
    if (n > bestN || (n === bestN && meta.get(c).combiRank > meta.get(bestC).combiRank)) {
      bestC = c;
      bestN = n;
    }
  }
  pool.add(bestC);
}

const poolArr = [...pool];
const unique = [];
for (const [k, child] of truth) {
  const [a, b] = k.split("|");
  if (nearest(poolArr, childRank(a, b)) !== child) unique.push([a, b, child]);
}
console.log(`Result pool: ${pool.size} pals | unique overrides: ${unique.length}`);

// --- 4. Validate: formula + overrides must reproduce the matrix exactly -----
const overrideMap = new Map(unique.map(([a, b, c]) => [key(a, b), c]));
let wrong = 0;
for (const [k, child] of truth) {
  const [a, b] = k.split("|");
  const got = overrideMap.get(k) ?? nearest(poolArr, childRank(a, b));
  if (got !== child) wrong++;
}
if (wrong) throw new Error(`Validation failed: ${wrong} pairs not reproduced`);
console.log(`Validation OK — all ${truth.size} matrix pairs reproduced.`);

// --- 5. Emit -----------------------------------------------------------------
const palsOut = {};
for (const [code, m] of [...meta].sort(
  (a, b) => a[1].combiRank - b[1].combiRank || a[0].localeCompare(b[0]),
)) {
  palsOut[code] = { name: m.name, combiRank: m.combiRank, dup: m.dup };
}
const poolOut = poolArr.sort(
  (a, b) => meta.get(a).combiRank - meta.get(b).combiRank || a.localeCompare(b),
);
const uniqueOut = unique
  .map(([a, b, c]) => (a < b ? [a, b, c] : [b, a, c]))
  .sort((x, y) => x[0].localeCompare(y[0]) || x[1].localeCompare(y[1]));

const out = { pals: palsOut, pool: poolOut, unique: uniqueOut };
const outFile = join(dataDir, "breeding.json");
writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");
console.log(
  `\nWrote ${outFile}\n  ${Object.keys(palsOut).length} pals, ` +
    `${poolOut.length} in result pool, ${uniqueOut.length} unique combos`,
);
