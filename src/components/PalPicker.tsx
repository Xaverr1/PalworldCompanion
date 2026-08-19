import { useEffect, useMemo, useState } from "react";
import { PALS, WORK_TYPES, type WorkType } from "../data/pals";
import { PASSIVE_BY_ID } from "../data/passives";
import { WORK_ICON } from "../lib/work";
import { SET_LIMIT, type PalSet } from "../lib/sets";
import { useOwned, type OwnedPal } from "../hooks/useOwned";
import { useLoadouts } from "../hooks/useLoadouts";

const PAL_BY_NAME = new Map(PALS.map((p) => [p.name, p]));

/** A pal's work suitabilities, highest level first. */
function sortedWorks(pal: { works: Partial<Record<WorkType, number>> }): [WorkType, number][] {
  return (Object.entries(pal.works) as [WorkType, number][]).sort(
    (a, b) => b[1] - a[1],
  );
}

/**
 * Two-step owned picker for a base roster: choose a species you own, then the
 * specific pal (instance) to place. Bases track the exact instance, so only
 * obtained pals appear.
 */
export function PalPicker({
  set,
  onAdd,
  onRemove,
  onClose,
}: {
  set: PalSet;
  onAdd: (instanceId: string) => void;
  onRemove: (instanceId: string) => void;
  onClose: () => void;
}) {
  const { instances } = useOwned();
  const { getLoadout } = useLoadouts();
  const [species, setSpecies] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [passiveQuery, setPassiveQuery] = useState("");
  const [works, setWorks] = useState<Set<WorkType>>(new Set());
  const members = new Set(set.members);
  const full = members.size + (set.humans?.length ?? 0) >= SET_LIMIT[set.kind];

  // Does an instance carry a passive whose name matches the passive filter?
  const matchesPassive = useMemo(() => {
    const pq = passiveQuery.trim().toLowerCase();
    return (id: string): boolean => {
      if (!pq) return true;
      return getLoadout(id).passives.some((pid) => {
        const p = PASSIVE_BY_ID.get(pid);
        return p ? p.name.toLowerCase().includes(pq) : false;
      });
    };
  }, [passiveQuery, getLoadout]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleWork = (w: WorkType) =>
    setWorks((prev) => {
      const next = new Set(prev);
      next.has(w) ? next.delete(w) : next.add(w);
      return next;
    });

  // Owned species, grouped, filtered by the search box and any selected work
  // suitabilities (a species matches if it can do every checked job).
  const speciesRows = useMemo(() => {
    const bySpecies = new Map<string, OwnedPal[]>();
    for (const i of instances) {
      const arr = bySpecies.get(i.species) ?? [];
      arr.push(i);
      bySpecies.set(i.species, arr);
    }
    const q = query.trim().toLowerCase();
    const wanted = [...works];
    return [...bySpecies.entries()]
      .filter(([n, arr]) => {
        if (q && !n.toLowerCase().includes(q)) return false;
        if (wanted.length) {
          const pal = PAL_BY_NAME.get(n);
          if (!pal || !wanted.every((w) => (pal.works[w] ?? 0) > 0)) return false;
        }
        // Keep only species with an instance carrying the wanted passive.
        if (!arr.some((i) => matchesPassive(i.id))) return false;
        return true;
      })
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [instances, query, works, matchesPassive]);

  // Instances of the chosen species, highest level first; narrowed to those
  // carrying the passive filter when one is set.
  const chosen = useMemo(
    () =>
      species
        ? instances
            .filter((i) => i.species === species && matchesPassive(i.id))
            .sort((a, b) => b.level - a.level)
        : [],
    [species, instances, matchesPassive],
  );

  const speciesPal = species ? PAL_BY_NAME.get(species) : null;

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal__panel picker"
        role="dialog"
        aria-modal="true"
        aria-label="Add pals"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {species ? (
          <>
            <button
              className="btn btn--sm bx-back"
              onClick={() => setSpecies(null)}
            >
              ← Species
            </button>
            <h3 className="detail__sub">Choose which {species}</h3>
            <ul className="picker__list">
              {chosen.map((i) => {
                const inSet = members.has(i.id);
                const disabled = !inSet && full;
                return (
                  <li key={i.id}>
                    <button
                      className={`breedpick__row ${inSet ? "picker__row--on" : ""}`}
                      disabled={disabled}
                      onClick={() => (inSet ? onRemove(i.id) : onAdd(i.id))}
                    >
                      <img src={speciesPal?.icon} alt="" loading="lazy" style={{ width: 34, height: 34 }} />
                      <span className="breedpick__name">
                        {i.nickname || i.species}
                        {i.gender === "Male" && (
                          <span className="pid__gender is-on is-male bx-g">♂</span>
                        )}
                        {i.gender === "Female" && (
                          <span className="pid__gender is-on is-female bx-g">♀</span>
                        )}
                      </span>
                      {speciesPal && (
                        <span className="picker__works">
                          {sortedWorks(speciesPal).map(([w, lvl]) => (
                            <span
                              key={w}
                              className="workicon"
                              title={`${w} · Lv ${lvl}`}
                            >
                              <img src={WORK_ICON[w]} alt={w} loading="lazy" />
                              <span className="workicon__lvl">{lvl}</span>
                            </span>
                          ))}
                        </span>
                      )}
                      <span className="picker__lv">
                        Lv {i.level}
                        {(i.stars ?? 0) > 0 && (
                          <span className="pbx__stars">{"★".repeat(i.stars!)}</span>
                        )}
                      </span>
                      <span className="picker__act">
                        {inSet ? "✓ Added" : disabled ? "Full" : "+ Add"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <h3 className="detail__sub">
              Add pals · {members.size + (set.humans?.length ?? 0)}/
              {SET_LIMIT[set.kind]}
            </h3>
            <input
              className="search"
              type="search"
              autoFocus
              placeholder="Search your obtained pals…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <input
              className="search"
              type="search"
              placeholder="Filter by passive trait… (e.g. Artisan, Lucky)"
              value={passiveQuery}
              onChange={(e) => setPassiveQuery(e.target.value)}
            />
            <div
              className="workfilter"
              role="group"
              aria-label="Filter by work suitability"
            >
              {WORK_TYPES.map((w) => {
                const on = works.has(w);
                return (
                  <button
                    key={w}
                    type="button"
                    className={`workfilter__btn ${on ? "is-on" : ""}`}
                    aria-pressed={on}
                    title={w}
                    onClick={() => toggleWork(w)}
                  >
                    <img src={WORK_ICON[w]} alt={w} />
                  </button>
                );
              })}
              {works.size > 0 && (
                <button
                  type="button"
                  className="workfilter__clear"
                  onClick={() => setWorks(new Set())}
                >
                  Clear
                </button>
              )}
            </div>
            {speciesRows.length === 0 ? (
              <p className="coverage__note">
                {query || works.size || passiveQuery
                  ? "No obtained pals match those filters."
                  : "No obtained pals yet — import a save or mark pals obtained in Browse."}
              </p>
            ) : (
              <ul className="picker__list">
                {speciesRows.map(([n, arr]) => {
                  const pal = PAL_BY_NAME.get(n);
                  const inBase = arr.filter((i) => members.has(i.id)).length;
                  return (
                    <li key={n}>
                      <button
                        className="breedpick__row"
                        onClick={() => setSpecies(n)}
                      >
                        <img src={pal?.icon} alt="" loading="lazy" style={{ width: 34, height: 34 }} />
                        <span className="breedpick__name" style={{ flex: 1 }}>
                          {n}
                        </span>
                        {inBase > 0 && (
                          <span className="picker__inbase">{inBase} in base</span>
                        )}
                        <span className="bx-count">×{arr.length}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
