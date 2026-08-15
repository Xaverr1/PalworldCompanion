// Palworld breeding logic — a pure port of paldb's model, driven by the scraped
// src/data/breeding.json. Validated exact against paldb's full breeding matrix
// (all 44k pairs) at build time; see scripts/build-breeding.mjs.
//
// Everything here is keyed by pal `code` (e.g. "SheepBall"), matching pals.json.
import { BREEDING, type BreedPal } from "../data/breeding";

const { pals, pool, unique } = BREEDING;

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const UNIQUE = new Map(unique.map(([a, b, child]) => [pairKey(a, b), child]));

/** Is this pal code breedable at all (has a CombiRank)? */
export function isBreedable(code: string): boolean {
  return code in pals;
}

/** A breedable pal's stats, or undefined for non-breedable codes. */
export function breedStats(code: string): BreedPal | undefined {
  return pals[code];
}

/** Nearest pool pal to a target rank; ties pick the higher rank, then lower dup. */
function nearestInPool(target: number): string {
  let best: { code: string; d: number; rank: number; dup: number } | null = null;
  for (const code of pool) {
    const m = pals[code];
    const d = Math.abs(m.combiRank - target);
    if (
      !best ||
      d < best.d ||
      (d === best.d && m.combiRank > best.rank) ||
      (d === best.d && m.combiRank === best.rank && m.dup < best.dup)
    ) {
      best = { code, d, rank: m.combiRank, dup: m.dup };
    }
  }
  // pool is never empty, but keep the type honest.
  return best ? best.code : "";
}

/**
 * The child produced by breeding two pals (order-independent), or null if
 * either parent isn't breedable. Unique combos win over the rank formula.
 */
export function breedChild(codeA: string, codeB: string): string | null {
  if (!pals[codeA] || !pals[codeB]) return null;
  const override = UNIQUE.get(pairKey(codeA, codeB));
  if (override) return override;
  const target = Math.floor((pals[codeA].combiRank + pals[codeB].combiRank + 1) / 2);
  return nearestInPool(target);
}

/**
 * All unordered parent pairs that breed into `childCode`. Used by the
 * "what makes X?" / branch-toward-a-target flows. O(n²) over breedable pals —
 * a few ms; memoized per child so repeat lookups are free.
 */
const parentCache = new Map<string, [string, string][]>();
export function parentPairsFor(childCode: string): [string, string][] {
  const cached = parentCache.get(childCode);
  if (cached) return cached;
  const codes = Object.keys(pals);
  const out: [string, string][] = [];
  for (let i = 0; i < codes.length; i++) {
    for (let j = i; j < codes.length; j++) {
      if (breedChild(codes[i], codes[j]) === childCode) out.push([codes[i], codes[j]]);
    }
  }
  parentCache.set(childCode, out);
  return out;
}
