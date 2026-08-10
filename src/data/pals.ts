import palsJson from "./pals.json";

export const ELEMENTS = [
  "Neutral",
  "Fire",
  "Water",
  "Grass",
  "Electric",
  "Ice",
  "Ground",
  "Dark",
  "Dragon",
] as const;
export type Element = (typeof ELEMENTS)[number];

export const WORK_TYPES = [
  "Kindling",
  "Watering",
  "Planting",
  "Generating Electricity",
  "Handiwork",
  "Gathering",
  "Lumbering",
  "Mining",
  "Medicine Production",
  "Cooling",
  "Transporting",
  "Farming",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const TIERS = ["S", "A", "B", "C", "F"] as const;
export type Tier = (typeof TIERS)[number];

/** Trigger tags derived from each partner skill's description. */
export type PartnerTag =
  | "base"
  | "ranch"
  | "party"
  | "active"
  | "mount"
  | "passive";

export interface RanchItem {
  name: string;
  icon: string;
  slug: string;
}

export interface PartnerSkill {
  name: string;
  desc: string;
  tags: PartnerTag[];
}

export interface Pal {
  /**
   * Paldex number as a string; variants carry a suffix, e.g. "121B".
   * `null` for the 11 unnumbered Terraria crossover pals.
   */
  paldex: string | null;
  name: string;
  slug: string;
  /** Internal game codename, e.g. "SheepBall". */
  code: string;
  icon: string;
  elements: Element[];
  /** Base work-suitability levels (1–8), only for work types the pal has. */
  works: Partial<Record<WorkType, number>>;
  /** True for the Terraria collab pals. */
  crossover: boolean;
  /** Ranch produce, present only for pals with the Farming suitability. */
  ranch?: RanchItem[];
  hp: number;
  atk: number;
  def: number;
  food: number;
  /** Our derived raw-stat combat grade. */
  tier: Tier;
  /** Composite stat percentile across all pals (0–100). */
  combatPctl: number;
  partnerSkill: PartnerSkill;
}

export const PALS = palsJson as Pal[];
