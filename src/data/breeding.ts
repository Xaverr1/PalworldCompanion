import breedingJson from "./breeding.json";

/** One breedable pal's breeding stats (keyed by pal `code`). */
export interface BreedPal {
  name: string;
  /** Breeding power. Child rank = floor((rankA + rankB + 1) / 2). */
  combiRank: number;
  /** Tiebreak priority when two pals share a combiRank (lower wins). */
  dup: number;
}

export interface BreedingData {
  /** Every breedable pal, keyed by code. */
  pals: Record<string, BreedPal>;
  /** Codes eligible as a normal (nearest-rank) breeding result. */
  pool: string[];
  /** Special parent-pair overrides: [parentCodeA, parentCodeB, childCode]. */
  unique: [string, string, string][];
}

// JSON infers `unique` as string[][]; bridge through unknown to the tuple type.
export const BREEDING = breedingJson as unknown as BreedingData;
