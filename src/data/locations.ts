import locationsJson from "./locations.json";

/** A named map region a pal spawns in, with its in-game map coordinate. */
export interface RegionSpot {
  name: string;
  x: number;
  y: number;
}

/** Where a pal is found in the wild, scraped from paldb.cc. */
export interface PalLocation {
  /** Top spawn regions during daytime (null if it doesn't spawn by day). */
  day: RegionSpot[] | null;
  /** Top spawn regions at night. */
  night: RegionSpot[] | null;
  /** Overworld field-spawn level range. */
  overworld: { min: number; max: number } | null;
  /** Named dungeon spawns + their level range. */
  dungeons: { names: string[]; min: number | null; max: number | null } | null;
  /** Fixed Alpha-boss spot — fallback location for pals with no wild spawns. */
  boss: { name: string; x: number; y: number; lv: number | null } | null;
  /** Also spawns on the separate "The World Tree" map. */
  worldTree: boolean;
}

/** slug -> location; only pals with wild-spawn data are present. */
export const LOCATION_BY_SLUG = locationsJson as Record<string, PalLocation>;
