import type { Pal } from "../data/pals";

/** Level-0 flat bases shared by every pal (Palworld 1.0). */
const FLAT = { hp: 500, atk: 100, def: 50 } as const;
/** Per-level growth applied to the species stat. */
const GROWTH = { hp: 0.5, atk: 0.075, def: 0.075 } as const;

export interface ScaledStats {
  hp: number;
  atk: number;
  def: number;
}

/** Per-stat IVs ("talents"), each 0–100, as stored in the save. */
export interface Talents {
  hp: number;
  shot: number;
  defense: number;
}

export interface StatModifiers {
  /** Per-stat talents (0–100). Absent stats count as 0. */
  talents?: Partial<Talents>;
  /** Soul upgrade bonus, e.g. 0.2 for +20%. */
  soul?: number;
  /** Condenser (star) bonus, e.g. 0.2 for +20%. */
  condenser?: number;
}

/** A talent of 0–100 maps to a 0–30% bonus on level-up stat gains. */
const ivBonus = (talent = 0) => (talent / 100) * 0.3;

/**
 * In-game HP/Attack/Defense for a pal at a given level, per the community stat
 * formula (Palworld Wiki). Our `pal.hp/atk/def` are the species scaling stats.
 * Talents (IVs) default to 0; soul/condenser default to 0 too — a no-investment
 * baseline. Attack is driven by the Shot talent. Food is a fixed hunger value
 * and does not scale.
 *
 *   HP  = (500 + 5·L + hpStat  · 0.5   · L·(1+ivHp )) · (1+soul) · (1+condenser)
 *   Atk = (100        + atkStat · 0.075 · L·(1+ivAtk)) · (1+soul) · (1+condenser)
 *   Def = ( 50        + defStat · 0.075 · L·(1+ivDef)) · (1+soul) · (1+condenser)
 */
export function scaledStats(
  pal: Pal,
  level: number,
  { talents, soul = 0, condenser = 0 }: StatModifiers = {},
): ScaledStats {
  const mult = (1 + soul) * (1 + condenser);
  const term = (stat: number, growth: number, talent?: number) =>
    stat * growth * level * (1 + ivBonus(talent));
  return {
    hp: Math.floor((FLAT.hp + 5 * level + term(pal.hp, GROWTH.hp, talents?.hp)) * mult),
    atk: Math.floor((FLAT.atk + term(pal.atk, GROWTH.atk, talents?.shot)) * mult),
    def: Math.floor((FLAT.def + term(pal.def, GROWTH.def, talents?.defense)) * mult),
  };
}
