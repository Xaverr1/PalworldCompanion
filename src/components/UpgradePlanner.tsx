import { useMemo, useState } from "react";
import { PALS, type Pal } from "../data/pals";
import { useOwned } from "../hooks/useOwned";
import { useUpgradePlans } from "../hooks/useUpgradePlans";
import {
  SOULS,
  SOUL_STATS,
  SOUL_STAT_LABEL,
  MAX_SOUL_RANK,
  MAX_STAR,
  addSoulTotals,
  condenserStatBonus,
  condenserWorkBonus,
  emptySoulTotals,
  fodderForStar,
  soulStatBonus,
  soulsForStatRank,
  type SoulStat,
} from "../lib/upgrades";

const PAL_BY_NAME = new Map(PALS.map((p) => [p.name, p]));
const pct = (frac: number) => `${Math.round(frac * 100)}%`;

export function UpgradePlanner() {
  const { getPlan, setPlan } = useUpgradePlans();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const pal = selectedName ? PAL_BY_NAME.get(selectedName) ?? null : null;

  if (!pal) return <PalSelector onSelect={setSelectedName} />;

  const plan = getPlan(pal.name);
  const soulTotals = SOUL_STATS.reduce(
    (acc, s) => addSoulTotals(acc, soulsForStatRank(plan[s])),
    emptySoulTotals(),
  );
  const dupes = fodderForStar(plan.star);
  const cond = condenserStatBonus(plan.star);
  const workBonus = condenserWorkBonus(pal, plan.star);

  const projected = (base: number, stat: SoulStat) =>
    Math.round(base * (1 + cond + soulStatBonus(plan[stat])));

  return (
    <div className="upgrade">
      <header className="upgrade__head">
        <img className="upgrade__icon" src={pal.icon} alt="" />
        <div>
          <span className="detail__dex">
            {pal.paldex ? `#${pal.paldex}` : "Collab"}
          </span>
          <h2 className="detail__name">{pal.name}</h2>
          <span className="upgrade__base">
            Base {pal.hp} HP · {pal.atk} ATK · {pal.def} DEF
          </span>
        </div>
        <div className="upgrade__headbtns">
          <button className="btn" onClick={() => setSelectedName(null)}>
            Change pal
          </button>
          <button
            className="btn btn--danger"
            onClick={() => setPlan(pal.name, { star: 0, hp: 0, atk: 0, def: 0, work: 0 })}
          >
            Reset
          </button>
        </div>
      </header>

      <div className="upgrade__body">
        <div className="upgrade__controls">
          {/* Condenser */}
          <section className="upcard">
            <h3 className="detail__sub">Pal Essence Condenser</h3>
            <div className="stars">
              {Array.from({ length: MAX_STAR + 1 }, (_, i) => (
                <button
                  key={i}
                  className={`star-btn ${plan.star === i ? "is-on" : ""}`}
                  onClick={() => setPlan(pal.name, { star: i })}
                >
                  {i === 0 ? "0" : "★".repeat(i)}
                </button>
              ))}
            </div>
            <dl className="upgrade__facts">
              <div>
                <dt>Duplicate pals</dt>
                <dd>{dupes}</dd>
              </div>
              <div>
                <dt>Base stat bonus</dt>
                <dd>+{pct(cond)} HP / ATK / DEF</dd>
              </div>
            </dl>
            <p className="coverage__note">
              {plan.star >= MAX_STAR
                ? "★4 raises every work suitability by +1 and maxes the partner skill."
                : "Each star raises the highest work suitabilities first; all reach +1 at ★4."}
            </p>
          </section>

          {/* Statue of Power */}
          <section className="upcard">
            <h3 className="detail__sub">Statue of Power · souls</h3>
            {SOUL_STATS.map((stat) => (
              <div key={stat} className="soulrow">
                <span className="soulrow__label">{SOUL_STAT_LABEL[stat]}</span>
                <input
                  className="soulrow__slider"
                  type="range"
                  min={0}
                  max={MAX_SOUL_RANK}
                  value={plan[stat]}
                  onChange={(e) => setPlan(pal.name, { [stat]: Number(e.target.value) })}
                />
                <span className="soulrow__rank">
                  {plan[stat]}/{MAX_SOUL_RANK}
                </span>
                <span className="soulrow__pct">+{pct(soulStatBonus(plan[stat]))}</span>
              </div>
            ))}
          </section>
        </div>

        {/* Totals */}
        <aside className="upgrade__totals">
          <h3 className="detail__sub">Total cost</h3>
          <div className="soultotals">
            {SOULS.map((s) => (
              <div key={s.tier} className={`soultotal ${soulTotals[s.tier] ? "" : "is-zero"}`}>
                <img src={s.icon} alt={s.name} title={s.name} />
                <b>×{soulTotals[s.tier]}</b>
              </div>
            ))}
          </div>
          <dl className="upgrade__facts">
            <div>
              <dt>Duplicate pals</dt>
              <dd>{dupes}</dd>
            </div>
          </dl>

          <h3 className="detail__sub">Projected stats</h3>
          <table className="projtable">
            <tbody>
              <ProjRow label="HP" base={pal.hp} final={projected(pal.hp, "hp")} />
              <ProjRow label="Attack" base={pal.atk} final={projected(pal.atk, "atk")} />
              <ProjRow label="Defense" base={pal.def} final={projected(pal.def, "def")} />
              <tr>
                <td>Work Speed</td>
                <td className="projtable__arrow">—</td>
                <td className="projtable__final">+{pct(soulStatBonus(plan.work))}</td>
              </tr>
            </tbody>
          </table>

          {Object.keys(workBonus).length > 0 && (
            <p className="coverage__note">
              Work suitabilities at ★4:{" "}
              {(Object.keys(pal.works) as (keyof typeof pal.works)[]).map((w, i) => (
                <span key={w}>
                  {i > 0 && ", "}
                  {w} {Math.min(10, (pal.works[w] ?? 0) + (workBonus[w] ?? 0))}
                </span>
              ))}
              .
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function ProjRow({ label, base, final }: { label: string; base: number; final: number }) {
  const up = final > base;
  return (
    <tr>
      <td>{label}</td>
      <td className="projtable__arrow">
        {base} →
      </td>
      <td className={`projtable__final ${up ? "is-up" : ""}`}>{final}</td>
    </tr>
  );
}

function PalSelector({ onSelect }: { onSelect: (name: string) => void }) {
  const { owned, isOwned } = useOwned();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? PALS.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.paldex ?? "").toLowerCase().includes(q),
        )
      : // No query: show obtained pals first as quick picks.
        PALS.filter((p) => isOwned(p.name));
    return base.slice(0, 60);
  }, [query, isOwned]);

  return (
    <div className="upgrade__select">
      <h2 className="upgrade__selecttitle">Plan a pal's upgrades</h2>
      <input
        className="search"
        type="search"
        placeholder="Search for a pal…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {!query && (
        <p className="coverage__note">
          {owned.size > 0
            ? "Your obtained pals — or search for any pal above."
            : "Search for any pal above, or mark pals obtained to see them here."}
        </p>
      )}
      <div className="upgrade__selgrid">
        {results.map((p: Pal) => (
          <button key={p.name} className="upgrade__selpal" onClick={() => onSelect(p.name)}>
            <img src={p.icon} alt="" loading="lazy" />
            <span>{p.name}</span>
          </button>
        ))}
        {results.length === 0 && <p className="empty">No pals match.</p>}
      </div>
    </div>
  );
}
