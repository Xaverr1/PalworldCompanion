// Merges the three raw MagitekZed/palworld-helper datasets (work suitability,
// combat stats, partner skills) into a single normalized src/data/pals.json.
// Re-run after refreshing the raw JSON files:  node scripts/build-pals.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const load = (name) => JSON.parse(readFileSync(join(dataDir, name), "utf8"));

const work = load("pals_work_suitability.json").pals;
const combat = load("pals_combat_stats.json").pals;
const partner = load("pals_partner_skills.json").pals;

const combatByKey = new Map(combat.map((c) => [`${c.paldex}|${c.name}`, c]));

const pals = work.map((w) => {
  const c = combatByKey.get(`${w.paldex}|${w.name}`);
  const p = partner[w.name];
  if (!c) throw new Error(`No combat stats for ${w.paldex} ${w.name}`);
  if (!p) throw new Error(`No partner skill for ${w.name}`);
  return {
    paldex: w.paldex,
    name: w.name,
    slug: w.slug,
    code: w.code,
    icon: w.icon,
    elements: w.elements ?? [],
    works: w.works ?? {},
    crossover: Boolean(w.crossover),
    ...(w.ranch ? { ranch: w.ranch } : {}),
    hp: c.hp,
    atk: c.atk,
    def: c.def,
    food: c.food,
    tier: c.tier,
    combatPctl: c.combat_pctl,
    partnerSkill: { name: p.skill, desc: p.desc, tags: p.tags ?? [] },
  };
});

writeFileSync(join(dataDir, "pals.json"), JSON.stringify(pals, null, 2) + "\n");
console.log(`Wrote src/data/pals.json (${pals.length} pals)`);
