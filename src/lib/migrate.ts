// One-time, idempotent localStorage migrations. Run once at startup (main.tsx)
// BEFORE any hook reads its state, so hook initializers see the migrated data.

const OWNED_V2 = "pwc.owned.v2";
const OWNED_V1 = "pwc.owned.v1";
const LOAD_V1 = "pwc.loadouts.v1";
const LOAD_V2 = "pwc.loadouts.v2";
const UPG_V1 = "pwc.upgrades.v1";
const UPG_V2 = "pwc.upgrades.v2";

function newId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

interface Instance {
  id: string;
  species: string;
  level: number;
}

/** Re-key a species-keyed map onto the first instance id of each species. */
function rekeyBySpecies(
  old: Record<string, unknown>,
  firstId: Record<string, string>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [species, value] of Object.entries(old)) {
    const id = firstId[species];
    if (id) next[id] = value;
  }
  return next;
}

function cleanOrphans(key: string, liveIds: Set<string>): void {
  const data = read(key);
  if (!data || typeof data !== "object") return;
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(data as Record<string, unknown>)) {
    if (liveIds.has(id)) next[id] = value;
    else changed = true;
  }
  if (changed) localStorage.setItem(key, JSON.stringify(next));
}

export function runMigrations(): void {
  // 1. Ensure owned instances (v2) exist; migrate from v1 species names.
  let instances = read(OWNED_V2) as Instance[] | null;
  if (!Array.isArray(instances)) {
    const names = read(OWNED_V1);
    instances = Array.isArray(names)
      ? (names as string[]).map((species) => ({ id: newId(), species, level: 1 }))
      : [];
    localStorage.setItem(OWNED_V2, JSON.stringify(instances));
  }

  // species -> first instance id (for re-keying per-species data).
  const firstId: Record<string, string> = {};
  for (const inst of instances) {
    if (inst && !firstId[inst.species]) firstId[inst.species] = inst.id;
  }

  // 2. Loadouts: species-keyed (v1) -> instance-keyed (v2), once.
  if (read(LOAD_V2) == null) {
    const oldL = (read(LOAD_V1) as Record<string, unknown>) ?? {};
    localStorage.setItem(LOAD_V2, JSON.stringify(rekeyBySpecies(oldL, firstId)));
  }

  // 3. Upgrade plans: species-keyed (v1) -> instance-keyed (v2), once.
  if (read(UPG_V2) == null) {
    const oldU = (read(UPG_V1) as Record<string, unknown>) ?? {};
    localStorage.setItem(UPG_V2, JSON.stringify(rekeyBySpecies(oldU, firstId)));
  }

  // 4. Drop loadout/upgrade entries whose instance no longer exists.
  const liveIds = new Set(instances.map((i) => i.id));
  cleanOrphans(LOAD_V2, liveIds);
  cleanOrphans(UPG_V2, liveIds);
}
