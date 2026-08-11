// Builds src/data/passives.json from oMaN-Rod/palworld-save-pal passive-skill
// data + English localization.  Re-run: node scripts/build-passives.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const load = (name) => JSON.parse(readFileSync(join(dataDir, name), "utf8"));

const raw = load("passive_skills_raw.json");
const en = load("passive_skills_en.json");

// Strip Palworld rich-text markup tags (e.g. <NumBlue_13>, </>) and tidy space.
const clean = (s) =>
  (s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const seen = new Set();
const passives = Object.entries(raw)
  // Keep enabled entries that have a real localized name (drops dev/internal ones).
  .filter(([id, v]) => !v.disabled && en[id]?.localized_name)
  .map(([id, v]) => ({
    id,
    name: en[id].localized_name,
    description: clean(en[id]?.description),
    rank: v.rank ?? 0,
  }))
  // Collapse identical passives that share name + rank + description.
  .filter((p) => {
    const key = `${p.name}|${p.rank}|${p.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));

writeFileSync(join(dataDir, "passives.json"), JSON.stringify(passives, null, 2) + "\n");
console.log(`Wrote src/data/passives.json (${passives.length} passives)`);
