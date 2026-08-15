import { PALS } from "../data/pals";
import { SKILL_BY_ID } from "../data/skills";
import { PASSIVE_BY_ID } from "../data/passives";
import { EQUIP_LIMIT, PASSIVE_LIMIT } from "../hooks/useLoadouts";
import type { ImportPal } from "../hooks/useOwned";
import { decompressSave } from "./saveDecompress";
import { extractPals } from "./saveParse";

/** One pal as written by scripts/extract-pals.py. */
export interface SavePal {
  code: string;
  level: number;
  rank?: number;
  gender?: string;
  nickname?: string;
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

/** Dedupe while keeping only ids known to `has`, capped at `limit`. */
function knownIds(
  raw: string[] | undefined,
  has: (id: string) => boolean,
  limit: number,
): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (has(id) && !out.includes(id)) out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}

/** Map save pals to importable instances, dropping unknown species. */
export function summarizeSavePals(pals: SavePal[]): ImportSummary {
  const instances: ImportPal[] = [];
  const skipped: string[] = [];
  for (const p of pals) {
    const species = resolveSpecies(p.code);
    if (!species) {
      skipped.push(p.code);
      continue;
    }
    // EquipWaza holds the equipped moves, so import them as learned + equipped.
    const abilities = knownIds(p.abilities, (id) => SKILL_BY_ID.has(id), EQUIP_LIMIT);
    const passives = knownIds(p.passives, (id) => PASSIVE_BY_ID.has(id), PASSIVE_LIMIT);
    instances.push({
      species,
      level: p.level,
      ...(p.ivs ? { ivs: p.ivs } : {}),
      ...(p.nickname ? { nickname: p.nickname } : {}),
      ...(p.gender ? { gender: p.gender } : {}),
      ...(abilities.length ? { abilities } : {}),
      ...(passives.length ? { passives } : {}),
    });
  }
  return { instances, matched: instances.length, skipped };
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
  return summarizeSavePals(data.pals);
}

/**
 * Turn a picked file into an import summary — either a raw Palworld `.sav`
 * (decompressed + parsed in-browser) or the legacy extract-pals.py JSON.
 */
export async function readSaveFile(file: File): Promise<ImportSummary> {
  const buf = new Uint8Array(await file.arrayBuffer());
  // The legacy export is JSON text ('{'); real saves are compressed binaries.
  const isJson = file.name.toLowerCase().endsWith(".json") || buf[0] === 0x7b;
  if (isJson) return parseSaveExport(new TextDecoder().decode(buf));

  const gvas = await decompressSave(buf);
  const { pals } = extractPals(gvas);
  if (pals.length === 0) throw new Error("No pals found in that save file.");
  return summarizeSavePals(pals);
}
