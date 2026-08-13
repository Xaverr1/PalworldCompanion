import type { WorkType } from "./pals";

/**
 * Catchable humans in Palworld are near-uniform base workers: almost all share
 * Handiwork / Watering / Lumbering / Mining at Lv 1. Rather than list all ~130
 * faction variants, we offer the few profiles that actually differ. Levels and
 * work types are from the Palworld wiki (palworld.wiki.gg/wiki/Humans).
 */
export interface HumanType {
  /** Stable key stored on saved workers. */
  id: string;
  name: string;
  /** Where you find them / why you'd catch one. */
  note: string;
  works: Partial<Record<WorkType, number>>;
  /** Deployable as a base shop. */
  merchant?: boolean;
}

export const HUMAN_TYPES: HumanType[] = [
  {
    id: "common",
    name: "Common Human",
    note: "Most caught humans — Syndicate, PIDF, Free Pal Alliance, islanders.",
    works: { Handiwork: 1, Watering: 1, Lumbering: 1, Mining: 1 },
  },
  {
    id: "flamethrower",
    name: "Flamethrower Human",
    note: "Fire Cult / Scientist with a flamethrower — also handles Kindling.",
    works: { Kindling: 1, Handiwork: 1, Watering: 1, Lumbering: 1, Mining: 1 },
  },
  {
    id: "pal-merchant",
    name: "Pal Merchant",
    note: "Deploy at a base to buy and sell pals on demand.",
    works: { Handiwork: 1, Watering: 1, Lumbering: 1, Mining: 2 },
    merchant: true,
  },
  {
    id: "wandering-merchant",
    name: "Wandering Merchant",
    note: "Deploy at a base for an always-open item shop.",
    works: { Handiwork: 1, Watering: 1, Mining: 1, Lumbering: 2 },
    merchant: true,
  },
  {
    id: "custom",
    name: "Custom Human",
    note: "Blank — set work levels by hand.",
    works: {},
  },
];

export const HUMAN_TYPE_BY_ID = new Map(HUMAN_TYPES.map((h) => [h.id, h]));
