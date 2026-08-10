import {
  PALS,
  WORK_TYPES,
  ELEMENTS,
  type Element,
  type Pal,
  type Tier,
  type WorkType,
} from "../data/pals";
import { STRONG_AGAINST, WEAK_TO } from "./typechart";

export type SetKind = "base" | "party";

/** Roster capacity per set kind (Palworld: 15 base workers, 5-pal party). */
export const SET_LIMIT: Record<SetKind, number> = {
  base: 15,
  party: 5,
};

export interface PalSet {
  id: string;
  name: string;
  kind: SetKind;
  /** Pal names (unique across the dex) making up the roster. */
  members: string[];
  createdAt: number;
  updatedAt: number;
}

const PAL_BY_NAME = new Map(PALS.map((p) => [p.name, p]));

/** Resolve a set's member names to Pal records, dropping any unknown names. */
export function resolveMembers(set: PalSet): Pal[] {
  return set.members
    .map((name) => PAL_BY_NAME.get(name))
    .filter((p): p is Pal => p !== undefined);
}

export interface WorkCoverage {
  work: WorkType;
  /** Highest suitability level in the roster (0 = uncovered gap). */
  maxLevel: number;
  /** How many pals in the roster have this work type. */
  contributors: number;
}

/** Per-work-type coverage for a base roster. */
export function baseCoverage(pals: Pal[]): WorkCoverage[] {
  return WORK_TYPES.map((work) => {
    let maxLevel = 0;
    let contributors = 0;
    for (const p of pals) {
      const lvl = p.works[work] ?? 0;
      if (lvl > 0) {
        contributors++;
        if (lvl > maxLevel) maxLevel = lvl;
      }
    }
    return { work, maxLevel, contributors };
  });
}

export interface PartySummary {
  totalHp: number;
  totalAtk: number;
  totalDef: number;
  /** Distinct elements represented, in canonical order. */
  elements: Element[];
  tierCounts: Record<Tier, number>;
}

/** Combat-oriented rollup for a party roster. */
export function partySummary(pals: Pal[]): PartySummary {
  const present = new Set<Element>();
  const tierCounts = { S: 0, A: 0, B: 0, C: 0, F: 0 } as Record<Tier, number>;
  let totalHp = 0;
  let totalAtk = 0;
  let totalDef = 0;
  for (const p of pals) {
    totalHp += p.hp;
    totalAtk += p.atk;
    totalDef += p.def;
    tierCounts[p.tier]++;
    p.elements.forEach((e) => present.add(e));
  }
  return {
    totalHp,
    totalAtk,
    totalDef,
    elements: ELEMENTS.filter((e) => present.has(e)),
    tierCounts,
  };
}

/**
 * Highest-suitability pal for a work type, excluding names already chosen.
 * When `pool` is given, only pals in it are considered (e.g. obtained pals).
 * Ties resolve to the earliest paldex entry. Returns null if none qualify.
 */
export function bestForWork(
  work: WorkType,
  exclude: Set<string>,
  pool?: Set<string>,
): Pal | null {
  let best: Pal | null = null;
  let bestLvl = 0;
  for (const p of PALS) {
    if (exclude.has(p.name)) continue;
    if (pool && !pool.has(p.name)) continue;
    const lvl = p.works[work] ?? 0;
    if (lvl > bestLvl) {
      bestLvl = lvl;
      best = p;
    }
  }
  return best;
}

export interface CounterPick {
  pal: Pal;
  /** Party offensive blind spots this pal also covers (its strengths ∩ gaps). */
  blindSpotsCovered: Element[];
}

/**
 * Best counter to an element the party is weak to. Among pals whose typing is
 * super-effective against `threat`, prefers the one that also covers the most of
 * the party's offensive blind spots (`cantCounter`), breaking ties by combat
 * percentile — so one add can fix two things. `exclude` skips current members;
 * `pool` restricts to a set (e.g. obtained pals).
 */
export function bestCounter(
  threat: Element,
  cantCounter: Element[],
  exclude: Set<string>,
  pool?: Set<string>,
): CounterPick | null {
  const counterEls = new Set(WEAK_TO[threat]);
  const gaps = new Set(cantCounter);
  let best: CounterPick | null = null;
  let bestScore = -1;
  let bestPctl = -1;
  for (const p of PALS) {
    if (exclude.has(p.name)) continue;
    if (pool && !pool.has(p.name)) continue;
    if (!p.elements.some((e) => counterEls.has(e))) continue;

    const strengths = new Set<Element>();
    for (const el of p.elements) STRONG_AGAINST[el].forEach((e) => strengths.add(e));
    const covered = [...gaps].filter((g) => strengths.has(g));
    const score = covered.length;

    if (score > bestScore || (score === bestScore && p.combatPctl > bestPctl)) {
      best = { pal: p, blindSpotsCovered: covered };
      bestScore = score;
      bestPctl = p.combatPctl;
    }
  }
  return best;
}

export function createSet(kind: SetKind, name: string): PalSet {
  const now = Date.now();
  return {
    id: `${kind}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    kind,
    members: [],
    createdAt: now,
    updatedAt: now,
  };
}
