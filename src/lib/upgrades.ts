import type { Pal, WorkType } from "../data/pals";

/**
 * Pal enhancement data for Palworld v1.0.
 * Sources: game8.co Statue of Power / Pal Essence Condenser guides,
 * palworld.tools/upgrades. Enhancing costs Pal Souls only (gold is refunded
 * on reset, not spent to enhance).
 */

export type SoulTier = "small" | "medium" | "large" | "giant";

export const SOULS: { tier: SoulTier; name: string; icon: string }[] = [
  { tier: "small", name: "Small Pal Soul", icon: "/souls/small.webp" },
  { tier: "medium", name: "Medium Pal Soul", icon: "/souls/medium.webp" },
  { tier: "large", name: "Large Pal Soul", icon: "/souls/large.webp" },
  { tier: "giant", name: "Giant Pal Soul", icon: "/souls/giant.webp" },
];

/** Statue-of-Power stats each pal can enhance with souls. */
export const SOUL_STATS = ["hp", "atk", "def", "work"] as const;
export type SoulStat = (typeof SOUL_STATS)[number];

export const SOUL_STAT_LABEL: Record<SoulStat, string> = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  work: "Work Speed",
};

export const MAX_SOUL_RANK = 20;
export const SOUL_PCT_PER_RANK = 3; // +3% per rank, +60% at rank 20

// Soul cost to raise ONE stat by one rank; index 0 = rank 1.
const RANK_COST: { tier: SoulTier; count: number }[] = [
  { tier: "small", count: 1 },
  { tier: "small", count: 2 },
  { tier: "small", count: 3 },
  { tier: "small", count: 4 },
  { tier: "medium", count: 1 },
  { tier: "medium", count: 2 },
  { tier: "medium", count: 3 },
  { tier: "large", count: 1 },
  { tier: "large", count: 2 },
  { tier: "large", count: 3 },
  { tier: "giant", count: 1 },
  { tier: "giant", count: 2 },
  { tier: "giant", count: 2 },
  { tier: "giant", count: 3 },
  { tier: "giant", count: 3 },
  { tier: "giant", count: 3 },
  { tier: "giant", count: 4 },
  { tier: "giant", count: 4 },
  { tier: "giant", count: 4 },
  { tier: "giant", count: 4 },
];

export type SoulTotals = Record<SoulTier, number>;

export function emptySoulTotals(): SoulTotals {
  return { small: 0, medium: 0, large: 0, giant: 0 };
}

export function addSoulTotals(a: SoulTotals, b: SoulTotals): SoulTotals {
  return {
    small: a.small + b.small,
    medium: a.medium + b.medium,
    large: a.large + b.large,
    giant: a.giant + b.giant,
  };
}

/** Souls to raise one stat from 0 to `rank` (sum of ranks 1..rank). */
export function soulsForStatRank(rank: number): SoulTotals {
  const t = emptySoulTotals();
  for (let r = 0; r < rank && r < RANK_COST.length; r++) {
    t[RANK_COST[r].tier] += RANK_COST[r].count;
  }
  return t;
}

/** Fractional stat bonus from soul rank, e.g. 0.6 at rank 20. */
export function soulStatBonus(rank: number): number {
  return (SOUL_PCT_PER_RANK * rank) / 100;
}

// ---- Condenser ----

export const MAX_STAR = 4;
export const CONDENSER_PCT_PER_STAR = 5; // +5% base HP/Atk/Def per star

// Duplicate pals consumed at each star; index 0 = star 1.
const CONDENSER_FODDER = [4, 8, 12, 24];

/** Cumulative duplicate pals to reach `star` (0-4). */
export function fodderForStar(star: number): number {
  let total = 0;
  for (let s = 0; s < star && s < CONDENSER_FODDER.length; s++) {
    total += CONDENSER_FODDER[s];
  }
  return total;
}

/** Fractional base-stat bonus from condensing, e.g. 0.2 at star 4. */
export function condenserStatBonus(star: number): number {
  return (CONDENSER_PCT_PER_STAR * star) / 100;
}

/**
 * Work-suitability bonus from condensing. Ranks 1-3 raise the highest
 * suitabilities first; at star 4 every suitability the pal has gains +1.
 * We only model the certain star-4 result (+1 to all); intermediate stars
 * are surfaced as a note in the UI.
 */
export function condenserWorkBonus(pal: Pal, star: number): Partial<Record<WorkType, number>> {
  const bonus: Partial<Record<WorkType, number>> = {};
  if (star >= MAX_STAR) {
    for (const w of Object.keys(pal.works) as WorkType[]) bonus[w] = 1;
  }
  return bonus;
}
