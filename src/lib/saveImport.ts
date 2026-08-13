import { PALS } from "../data/pals";
import type { ImportPal } from "../hooks/useOwned";

/** One pal as written by scripts/extract-pals.py. */
export interface SavePal {
  code: string;
  level: number;
  rank?: number;
  gender?: string;
  ivs?: { hp: number; shot: number; defense: number };
  abilities?: string[];
  passives?: string[];
}

export interface SaveExport {
  app?: string;
  kind?: string;
  version?: number;
  pals: SavePal[];
}

export interface ImportSummary {
  /** Instances ready to load into the obtained set. */
  instances: ImportPal[];
  /** How many save pals matched a known species. */
  matched: number;
  /** Save codenames that didn't map to a pal (caught humans, unknowns). */
  skipped: string[];
}

const CODE_TO_NAME = new Map(PALS.map((p) => [p.code, p.name]));
const LOWER_TO_NAME = new Map(PALS.map((p) => [p.code.toLowerCase(), p.name]));
// Alpha/predator/raid/etc. variants share their base species' stats.
const VARIANT_PREFIX = /^(BOSS_|PREDATOR_|RAID_|SUMMON_|GYM_)/i;

/** Resolve a save codename to one of our pal display names, or null. */
export function resolveSpecies(code: string): string | null {
  if (CODE_TO_NAME.has(code)) return CODE_TO_NAME.get(code)!;
  const stripped = code.replace(VARIANT_PREFIX, "");
  return (
    CODE_TO_NAME.get(stripped) ??
    LOWER_TO_NAME.get(stripped.toLowerCase()) ??
    null
  );
}

/** Parse the JSON produced by extract-pals.py into importable instances. */
export function parseSaveExport(text: string): ImportSummary {
  let data: SaveExport;
  try {
    data = JSON.parse(text) as SaveExport;
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (data.kind !== "save-pals" || !Array.isArray(data.pals)) {
    throw new Error(
      "Not a Palworld save export. Generate one with scripts/extract-pals.py.",
    );
  }

  const instances: ImportPal[] = [];
  const skipped: string[] = [];
  for (const p of data.pals) {
    const species = resolveSpecies(p.code);
    if (!species) {
      skipped.push(p.code);
      continue;
    }
    instances.push({
      species,
      level: p.level,
      ...(p.ivs ? { ivs: p.ivs } : {}),
    });
  }
  return { instances, matched: instances.length, skipped };
}
