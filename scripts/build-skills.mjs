// Merges oMaN-Rod/palworld-save-pal active-skill data + English localization into
// a flat src/data/skills.json.  Re-run after refreshing the raw files:
//   node scripts/build-skills.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const load = (name) => JSON.parse(readFileSync(join(dataDir, name), "utf8"));

// Game element names -> our canonical Element union.
const ELEMENT_MAP = {
  Normal: "Neutral",
  Fire: "Fire",
  Water: "Water",
  Leaf: "Grass",
  Electricity: "Electric",
  Ice: "Ice",
  Earth: "Ground",
  Dark: "Dark",
  Dragon: "Dragon",
};

const skillsRaw = load("active_skills_raw.json");
const en = load("active_skills_en.json");

const skills = Object.entries(skillsRaw)
  .map(([wazaId, v]) => {
    const id = wazaId.replace(/^EPalWazaID::/, "");
    const name = en[wazaId]?.localized_name ?? id;
    const element = ELEMENT_MAP[v.element];
    if (!element) throw new Error(`Unmapped element "${v.element}" for ${id}`);
    return {
      id,
      name,
      element,
      category: v.type, // "Shot" | "Melee"
      power: v.power,
      cooldown: v.cool_time,
      description: en[wazaId]?.description ?? "",
    };
  })
  // Drop unnamed/dev entries.
  .filter((s) => s.name && s.name !== s.id);

// Collapse pal-specific duplicates that share name + element + power (e.g. Garm
// and GuardianDog both carry "Double Fang" Neutral/40).
const seen = new Set();
const deduped = skills
  .filter((s) => {
    const key = `${s.name}|${s.element}|${s.power}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(join(dataDir, "skills.json"), JSON.stringify(deduped, null, 2) + "\n");
console.log(`Wrote src/data/skills.json (${deduped.length} skills)`);
