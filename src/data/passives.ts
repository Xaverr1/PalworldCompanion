import passivesJson from "./passives.json";

export interface Passive {
  /** Stable id from the game's PassiveSkill key (e.g. "Legend"). */
  id: string;
  name: string;
  description: string;
  /** Tier: positive (1–5) are beneficial, negative are detrimental traits. */
  rank: number;
}

export const PASSIVES = passivesJson as Passive[];

export const PASSIVE_BY_ID = new Map(PASSIVES.map((p) => [p.id, p]));
