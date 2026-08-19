import { useMemo, useState } from "react";
import type { Pal, WorkType } from "../data/pals";
import { PASSIVE_BY_ID, type Passive } from "../data/passives";
import { WORK_ICON } from "../lib/work";
import { baseCoverage, bestForWork, type HumanWorker } from "../lib/sets";
import { useOwned } from "../hooks/useOwned";
import { useLoadouts } from "../hooks/useLoadouts";

/** Passive tier colour, mirrored from the pal cards. */
function passiveColor(rank: number): string {
  if (rank < 0) return "#e0533a"; // negative
  if (rank >= 4) return "#14b8a6"; // top tier — teal
  if (rank >= 3) return "#f0b429"; // 2nd tier — gold
  return "#9ca3af"; // 3rd tier — gray
}

/** A pal's work suitabilities, highest level first. */
function sortedWorks(pal: Pal): [WorkType, number][] {
  return (Object.entries(pal.works) as [WorkType, number][]).sort(
    (a, b) => b[1] - a[1],
  );
}

/** An owned pal that fills a 0-coverage work gap. */
interface GapFit {
  work: WorkType;
  pal: Pal | null;
  passives: Passive[];
}

/** An owned pal that beats the base's current best at a work type. */
interface Upgrade {
  work: WorkType;
  pal: Pal;
  passives: Passive[];
}

export function BaseCoverage({
  pals,
  humans = [],
  onAdd,
  full,
}: {
  pals: Pal[];
  humans?: HumanWorker[];
  onAdd: (name: string) => void;
  full: boolean;
}) {
  const { owned, instances } = useOwned();
  const { getLoadout } = useLoadouts();
  const [showUpgrades, setShowUpgrades] = useState(false);
  const coverage = baseCoverage(pals, humans);
  const gaps = coverage.filter((c) => c.maxLevel === 0);
  const exclude = useMemo(() => new Set(pals.map((p) => p.name)), [pals]);

  // Passives of the specific instance a recommendation would add: the best-level
  // owned pal of that species (mirrors addBySpecies in the planner).
  const passivesFor = useMemo(() => {
    return (species: string): Passive[] => {
      const inst = instances
        .filter((i) => i.species === species)
        .sort((a, b) => b.level - a.level)[0];
      if (!inst) return [];
      return getLoadout(inst.id)
        .passives.map((id) => PASSIVE_BY_ID.get(id))
        .filter((p): p is Passive => p !== undefined);
    };
  }, [instances, getLoadout]);

  // Owned-only picks for the 0-coverage gaps (always shown).
  const gapFits: GapFit[] = useMemo(
    () =>
      gaps.map((g) => {
        const pal = bestForWork(g.work, exclude, owned);
        return {
          work: g.work,
          pal,
          passives: pal ? passivesFor(pal.name) : [],
        };
      }),
    [gaps, exclude, owned, passivesFor],
  );

  // Owned pals that would raise a work type already covered (revealed on expand).
  const upgrades: Upgrade[] = useMemo(
    () =>
      coverage
        .filter((c) => c.maxLevel > 0)
        .map((c) => {
          const pal = bestForWork(c.work, exclude, owned);
          const to = pal?.works[c.work] ?? 0;
          return pal && to > c.maxLevel
            ? { work: c.work, pal, passives: passivesFor(pal.name) }
            : null;
        })
        .filter((u): u is Upgrade => u !== null),
    [coverage, exclude, owned, passivesFor],
  );

  return (
    <div className="basecov">
      <div className="coverage__head">
        <h3 className="detail__sub">Work Coverage</h3>
      </div>

      <ul className="basecov__grid">
        {coverage.map((c) => (
          <li
            key={c.work}
            className={`basecov__cell ${c.maxLevel ? "" : "is-gap"}`}
          >
            <span
              className="workicon"
              title={`${c.work} · best Lv ${c.maxLevel || 0} · ${c.contributors} pal${
                c.contributors === 1 ? "" : "s"
              }`}
            >
              <img src={WORK_ICON[c.work]} alt={c.work} loading="lazy" />
              <span className="workicon__lvl">{c.maxLevel || "—"}</span>
            </span>
            <span className="basecov__count">
              {c.contributors ? `×${c.contributors}` : "0"}
            </span>
          </li>
        ))}
      </ul>

      <div className="basecov__rec">
        <div className="basecov__rec-head">
          <h4 className="coverage__minihead">Fill the gaps</h4>
          {upgrades.length > 0 && (
            <button
              className="pp__details-toggle"
              aria-expanded={showUpgrades}
              onClick={() => setShowUpgrades((o) => !o)}
            >
              {showUpgrades ? "▾ Hide upgrades" : "▸ Upgrades"}
            </button>
          )}
        </div>

        {owned.size === 0 ? (
          <p className="coverage__note">
            Mark pals as obtained (☆ on their cards) or import a save to see what
            you can build now.
          </p>
        ) : gaps.length === 0 ? (
          <p className="coverage__note">
            Every work type is covered by this base.
          </p>
        ) : full ? (
          <p className="coverage__note">Roster full — remove a pal to add suggestions.</p>
        ) : (
          <ul className="suggest__list">
            {gapFits.map(({ work, pal, passives }) => (
              <li key={work} className="suggest__gap">
                <span className="suggest__work" title={work}>
                  <img src={WORK_ICON[work]} alt={work} loading="lazy" />
                </span>
                <RecRow pal={pal} passives={passives} onAdd={onAdd} />
              </li>
            ))}
          </ul>
        )}

        {showUpgrades && upgrades.length > 0 && (
          <>
            <h4 className="coverage__minihead">Owned upgrades</h4>
            <ul className="suggest__list">
              {upgrades.map(({ work, pal, passives }) => (
                <li key={work} className="suggest__gap">
                  <span className="suggest__work" title={work}>
                    <img src={WORK_ICON[work]} alt={work} loading="lazy" />
                  </span>
                  <RecRow
                    pal={pal}
                    passives={passives}
                    onAdd={onAdd}
                    disabled={full}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <p className="coverage__note">
        Best level shown per job; ×N marks how many pals (and humans) can do it.
        Suggestions only ever recommend pals you own.
      </p>
    </div>
  );
}

/** One owned recommendation: a click-to-add button, or an empty note. */
function RecRow({
  pal,
  passives,
  onAdd,
  disabled,
}: {
  pal: Pal | null;
  passives: Passive[];
  onAdd: (name: string) => void;
  disabled?: boolean;
}) {
  if (!pal) {
    return <span className="fit__none">no owned pal for this job</span>;
  }
  return (
    <button
      className="suggest__btn recrow"
      disabled={disabled}
      title={disabled ? "Roster full" : `Add ${pal.name}`}
      onClick={() => onAdd(pal.name)}
    >
      <img src={pal.icon} alt="" loading="lazy" />
      <span className="recrow__name">{pal.name}</span>
      <span className="recrow__works">
        {sortedWorks(pal).map(([w, lvl]) => (
          <span key={w} className="workicon" title={`${w} · Lv ${lvl}`}>
            <img src={WORK_ICON[w]} alt={w} loading="lazy" />
            <span className="workicon__lvl">{lvl}</span>
          </span>
        ))}
      </span>
      {passives.length > 0 && (
        <span className="recrow__passives">
          {passives.map((p) => (
            <span
              key={p.id}
              className="pmc__passive"
              style={{ borderColor: passiveColor(p.rank) }}
              title={p.description}
            >
              <i style={{ background: passiveColor(p.rank) }} />
              <span className="pmc__passive-name">{p.name}</span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
