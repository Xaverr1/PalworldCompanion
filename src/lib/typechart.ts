import { ELEMENTS, type Element, type Pal } from "../data/pals";

/**
 * Palworld attack type chart: element → the elements it is super-effective
 * against on offense. Fire is the only element strong against two.
 * Source: game8.co Palworld type chart.
 */
export const STRONG_AGAINST: Record<Element, Element[]> = {
  Neutral: [],
  Fire: ["Ice", "Grass"],
  Water: ["Fire"],
  Grass: ["Ground"],
  Electric: ["Water"],
  Ice: ["Dragon"],
  Ground: ["Electric"],
  Dark: ["Neutral"],
  Dragon: ["Dark"],
};

/** Inverse of STRONG_AGAINST: element → attackers super-effective against it. */
export const WEAK_TO: Record<Element, Element[]> = (() => {
  const weak = Object.fromEntries(ELEMENTS.map((e) => [e, [] as Element[]])) as Record<
    Element,
    Element[]
  >;
  for (const attacker of ELEMENTS) {
    for (const defender of STRONG_AGAINST[attacker]) {
      weak[defender].push(attacker);
    }
  }
  return weak;
})();

export interface PartyMatchup {
  /** Enemy elements at least one member can hit super-effectively. */
  counters: Element[];
  /** Enemy elements no member counters — offensive blind spots. */
  cantCounter: Element[];
  /** Enemy attack elements that are super-effective vs members, with how many. */
  weakTo: { element: Element; count: number }[];
}

/** Offensive coverage and defensive weaknesses for a party roster. */
export function partyMatchup(pals: Pal[]): PartyMatchup {
  const counters = new Set<Element>();
  const weakCount = new Map<Element, number>();

  for (const pal of pals) {
    // Dual-element pals contribute the union of both types' relationships.
    const strengths = new Set<Element>();
    const weaknesses = new Set<Element>();
    for (const el of pal.elements) {
      STRONG_AGAINST[el].forEach((e) => strengths.add(e));
      WEAK_TO[el].forEach((e) => weaknesses.add(e));
    }
    strengths.forEach((e) => counters.add(e));
    weaknesses.forEach((e) => weakCount.set(e, (weakCount.get(e) ?? 0) + 1));
  }

  return {
    counters: ELEMENTS.filter((e) => counters.has(e)),
    cantCounter: ELEMENTS.filter((e) => !counters.has(e)),
    weakTo: ELEMENTS.filter((e) => weakCount.has(e))
      .map((e) => ({ element: e, count: weakCount.get(e)! }))
      .sort((a, b) => b.count - a.count),
  };
}
