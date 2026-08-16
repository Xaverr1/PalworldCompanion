// Goal-directed breeding pathfinder. Turns a target species into a short, linear
// breeding chain — the planner half of the breeding tools (breeding.ts is the
// deterministic calculator half).
//
// The chain is the shortest ladder from a pal you own up to the goal: start from
// the owned pal nearest the goal, then at each step cross with the partner that
// moves one step closer. Partners are preferred owned (and carrying a wanted
// trait); unowned partners are flagged so you know what you still need to obtain.
//
// Everything is keyed by pal `code`, matching pals.json / breeding.json.
import { BREEDING } from "../data/breeding";
import { PALS } from "../data/pals";
import { breedChild } from "./breeding";

// A partner's "difficulty" to obtain, proxied by combat tier (rarer = pricier),
// so the solver favors common/owned pals over exotic ones — even if that means
// an extra breeding step. Owned pals are credited as easy in the greedy pass.
const TIER_DIFFICULTY: Record<string, number> = { S: 30, A: 12, B: 5, C: 2, F: 1 };
const TIER_OF = new Map(PALS.map((p) => [p.code, p.tier as string]));
const STEP_COST = 2;
const difficulty = (code: string) => TIER_DIFFICULTY[TIER_OF.get(code) ?? ""] ?? 5;
/** Cost of one cross whose partner is `code`. */
const edgeWeight = (code: string) => STEP_COST + difficulty(code);

/** A chain slot: a specific owned instance, or an unowned species placeholder. */
export type SourceRef =
  | { kind: "owned"; instanceId: string }
  | { kind: "species"; code: string };

/** How to obtain an unowned species that appears in a chain. */
export type ObtainHint =
  | { kind: "catch" }
  | { kind: "breed"; parents: [string, string] };

/** One resolved species in a solved chain (before instance selection). */
export interface ChainStep {
  code: string;
  owned: boolean;
}

// ---- Pair index (child -> every unordered parent pair) ----------------------
let PAIRS_BY_CHILD: Map<string, [string, string][]> | null = null;

/** Map of childCode -> parent pairs that breed it. Built once, then cached. */
function pairsByChild(): Map<string, [string, string][]> {
  if (PAIRS_BY_CHILD) return PAIRS_BY_CHILD;
  const codes = Object.keys(BREEDING.pals);
  const map = new Map<string, [string, string][]>();
  for (let i = 0; i < codes.length; i++) {
    for (let j = i; j < codes.length; j++) {
      const child = breedChild(codes[i], codes[j]);
      if (!child) continue;
      const bucket = map.get(child);
      if (bucket) bucket.push([codes[i], codes[j]]);
      else map.set(child, [[codes[i], codes[j]]]);
    }
  }
  PAIRS_BY_CHILD = map;
  return map;
}

// ---- Weighted distance to the goal (Dijkstra) -------------------------------
// Reverse breeding graph: for a cross `s × p = child`, a reverse edge
// child -> s with weight edgeWeight(p). Goal-independent, so built once.
let REVERSE_ADJ: Map<string, { s: string; w: number }[]> | null = null;

function reverseAdj(): Map<string, { s: string; w: number }[]> {
  if (REVERSE_ADJ) return REVERSE_ADJ;
  const codes = Object.keys(BREEDING.pals);
  const adj = new Map<string, { s: string; w: number }[]>();
  const push = (child: string, s: string, partner: string) => {
    const w = edgeWeight(partner);
    const bucket = adj.get(child);
    if (bucket) bucket.push({ s, w });
    else adj.set(child, [{ s, w }]);
  };
  for (let i = 0; i < codes.length; i++) {
    for (let j = i; j < codes.length; j++) {
      const child = breedChild(codes[i], codes[j]);
      if (!child) continue;
      // s = codes[i] crossing partner codes[j], and vice versa.
      push(child, codes[i], codes[j]);
      if (j !== i) push(child, codes[j], codes[i]);
    }
  }
  REVERSE_ADJ = adj;
  return adj;
}

const costCache = new Map<string, Map<string, number>>();

/**
 * `costToGoal(s)` = cheapest weighted breeding cost to turn a pal of species `s`
 * into the goal (favoring common partners). Ownership-independent, cached per
 * goal. Unreachable species are absent from the map.
 */
function costToGoal(goal: string): Map<string, number> {
  const cached = costCache.get(goal);
  if (cached) return cached;
  const adj = reverseAdj();
  const dist = new Map<string, number>([[goal, 0]]);
  const settled = new Set<string>();

  // O(V²) Dijkstra — a few hundred nodes, plenty fast.
  for (;;) {
    let u: string | null = null;
    let best = Infinity;
    for (const [node, d] of dist) {
      if (!settled.has(node) && d < best) {
        best = d;
        u = node;
      }
    }
    if (u === null) break;
    settled.add(u);
    for (const { s, w } of adj.get(u) ?? []) {
      const nd = best + w;
      if (nd < (dist.get(s) ?? Infinity)) dist.set(s, nd);
    }
  }
  costCache.set(goal, dist);
  return dist;
}

// ---- Solve a linear chain ---------------------------------------------------
/** "shortest" = fewest/cheapest crosses; "traits" = route wanted traits down. */
export type SolveMode = "shortest" | "traits";

export interface SolveOptions {
  mode?: SolveMode;
  /** The goal's desired passive ids. */
  wanted?: string[];
  /** Which wanted traits an owned species can supply (via one of your instances). */
  wantedTraitsOf?: (code: string) => string[];
}

const ALL_CODES = () => Object.keys(BREEDING.pals);

/**
 * Cheapest partner from `current` that stays on an optimal path to the goal.
 * Prefers owned (and trait-carrying) partners, then the easiest to obtain.
 */
function bestSteer(
  current: string,
  cost: Map<string, number>,
  ownedSpecies: Set<string>,
  carriesWanted: (c: string) => boolean,
  goal: string,
): { p: string; child: string } | null {
  const here = cost.get(current);
  if (here === undefined) return null;
  let best: { p: string; child: string; score: number; w: number } | null = null;
  for (const p of ALL_CODES()) {
    if (p === goal) continue; // the goal is a result, never an ingredient
    const child = breedChild(current, p);
    if (!child) continue;
    const cc = cost.get(child);
    if (cc === undefined) continue;
    const w = edgeWeight(p);
    if (Math.abs(w + cc - here) > 1e-6) continue; // must be on an optimal path
    const owned = ownedSpecies.has(p);
    const score = (owned && carriesWanted(p) ? 4 : 0) + (owned ? 2 : 0);
    if (!best || score > best.score || (score === best.score && w < best.w))
      best = { p, child, score, w };
  }
  return best;
}

/**
 * A breeding chain to `goal`, drawn from owned pals. Returns the ordered parents
 * of a left-fold (`start × p1 = r1`, `r1 × p2 = r2`, … = goal).
 *
 * - `shortest`: fewest/cheapest crosses, favoring common & owned partners.
 * - `traits`: routes the goal's wanted passives down the chain first (starting
 *   from a carrier and crossing in other carriers while staying reachable to the
 *   goal), then steers the species home — accepting a longer chain for coverage.
 */
export function solveChain(
  goal: string,
  ownedSpecies: Set<string>,
  opts: SolveOptions = {},
): ChainStep[] {
  const cost = costToGoal(goal);
  const wanted = opts.wanted ?? [];
  const wantedTraitsOf = opts.wantedTraitsOf ?? (() => []);
  const carriesWanted = (c: string) => wantedTraitsOf(c).length > 0;
  // The goal is the chain's result, never an ingredient (owning the species
  // doesn't give you the wanted traits) — so it's never eligible as a parent.
  const reachable = (c: string) => c !== goal && cost.has(c);

  if (opts.mode === "traits" && wanted.length) {
    const chain = solveTraitFirst(goal, ownedSpecies, cost, reachable, wanted, wantedTraitsOf, carriesWanted);
    if (chain) return chain;
    // fall through to shortest if trait routing couldn't start
  }

  // Shortest: start from the owned pal cheapest to raise (tie-break carriers).
  const ownedStarts = [...ownedSpecies].filter(reachable);
  let start: string | null = null;
  if (ownedStarts.length) {
    ownedStarts.sort(
      (a, b) =>
        cost.get(a)! - cost.get(b)! ||
        Number(carriesWanted(b)) - Number(carriesWanted(a)) ||
        a.localeCompare(b),
    );
    start = ownedStarts[0];
  } else {
    let bd = Infinity;
    for (const [c, d] of cost) {
      if (c !== goal && d < bd) {
        bd = d;
        start = c;
      }
    }
  }
  if (!start) return [{ code: goal, owned: ownedSpecies.has(goal) }];

  const steps: ChainStep[] = [{ code: start, owned: ownedSpecies.has(start) }];
  let current = start;
  for (let guard = 0; (cost.get(current) ?? 0) > 1e-6 && guard < 40; guard++) {
    const best = bestSteer(current, cost, ownedSpecies, carriesWanted, goal);
    if (!best) break;
    steps.push({ code: best.p, owned: ownedSpecies.has(best.p) });
    current = best.child;
  }
  return steps;
}

/**
 * Trait-first chain: consolidate the wanted passives from your carriers, then
 * steer the species to the goal. Returns null if no owned pal can even start a
 * reachable chain (caller falls back to shortest).
 */
function solveTraitFirst(
  goal: string,
  ownedSpecies: Set<string>,
  cost: Map<string, number>,
  reachable: (c: string) => boolean,
  wanted: string[],
  wantedTraitsOf: (c: string) => string[],
  carriesWanted: (c: string) => boolean,
): ChainStep[] | null {
  // Which wanted traits are obtainable from the Palbox at all.
  const obtainable = new Set<string>();
  for (const c of ownedSpecies) for (const t of wantedTraitsOf(c)) obtainable.add(t);

  // Start from the owned, reachable carrier covering the most wanted traits.
  const carrierStarts = [...ownedSpecies].filter((c) => reachable(c) && carriesWanted(c));
  let start: string | null = null;
  if (carrierStarts.length) {
    carrierStarts.sort(
      (a, b) =>
        wantedTraitsOf(b).length - wantedTraitsOf(a).length ||
        cost.get(a)! - cost.get(b)! ||
        a.localeCompare(b),
    );
    start = carrierStarts[0];
  } else {
    // No reachable carriers: let the caller use shortest instead.
    return null;
  }

  const steps: ChainStep[] = [{ code: start, owned: true }];
  const collected = new Set(wantedTraitsOf(start));
  let current = start;

  for (let guard = 0; guard < 40; guard++) {
    const missing = wanted.filter((t) => !collected.has(t) && obtainable.has(t));

    // Phase A: bring in another carrier for a missing trait, staying reachable.
    if (missing.length) {
      let bestC: { p: string; child: string; gain: number; lands: boolean; cc: number } | null = null;
      for (const p of ALL_CODES()) {
        if (p === goal || !ownedSpecies.has(p)) continue;
        const gain = wantedTraitsOf(p).filter((t) => missing.includes(t)).length;
        if (!gain) continue;
        const child = breedChild(current, p);
        if (!child) continue;
        const cc = cost.get(child);
        if (cc === undefined) continue; // must stay reachable to the goal
        // Landing on the goal now strands any traits this cross doesn't supply.
        const lands = child === goal && gain < missing.length;
        if (
          !bestC ||
          (!lands && bestC.lands) ||
          (lands === bestC.lands && (gain > bestC.gain || (gain === bestC.gain && cc < bestC.cc)))
        )
          bestC = { p, child, gain, lands, cc };
      }
      if (bestC && !bestC.lands) {
        steps.push({ code: bestC.p, owned: true });
        for (const t of wantedTraitsOf(bestC.p)) collected.add(t);
        current = bestC.child;
        continue;
      }
    }

    // Phase B: species done? stop. Otherwise steer one step toward the goal.
    if (current === goal) break;
    const steer = bestSteer(current, cost, ownedSpecies, carriesWanted, goal);
    if (!steer) break;
    steps.push({ code: steer.p, owned: ownedSpecies.has(steer.p) });
    current = steer.child;
  }
  return steps;
}

// ---- Obtain hint for an unowned placeholder ---------------------------------
/**
 * How to get an unowned species: the parent pair that reuses the most pals you
 * own, or "catch" when nothing you own breeds it.
 */
export function obtainHint(code: string, ownedSpecies: Set<string>): ObtainHint {
  const pairs = pairsByChild().get(code);
  if (!pairs || pairs.length === 0) return { kind: "catch" };
  let best: [string, string] = pairs[0];
  let bestScore = -1;
  for (const [a, b] of pairs) {
    const score = (ownedSpecies.has(a) ? 1 : 0) + (ownedSpecies.has(b) ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }
  // Only suggest breeding when you already own a parent; else it's simpler to catch.
  return bestScore >= 1 ? { kind: "breed", parents: best } : { kind: "catch" };
}

// ---- Progressing partners (for the constrained "not owned" picker) ----------
/**
 * Species that, crossed with `current`, move one step closer to `goal`.
 * Returned nearest-first. Ownership is irrelevant here — the caller decides
 * which of these to surface as owned vs. "not owned" options.
 */
export function progressingPartners(current: string, goal: string): string[] {
  const cost = costToGoal(goal);
  const here = cost.get(current);
  if (here === undefined) return [];
  const out: { code: string; d: number }[] = [];
  for (const p of Object.keys(BREEDING.pals)) {
    const child = breedChild(current, p);
    if (!child) continue;
    const d = cost.get(child);
    if (d !== undefined && d < here) out.push({ code: p, d });
  }
  out.sort((x, y) => x.d - y.d || x.code.localeCompare(y.code));
  return out.map((o) => o.code);
}
