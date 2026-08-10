import skillsJson from "./skills.json";
import type { Element } from "./pals";

export type SkillCategory = "Shot" | "Melee";

export interface Skill {
  /** Stable id derived from the game's WazaID (e.g. "FireBall"). */
  id: string;
  name: string;
  element: Element;
  category: SkillCategory;
  power: number;
  /** Raw cooldown value from the game data. */
  cooldown: number;
  description: string;
}

export const SKILLS = skillsJson as Skill[];

export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
