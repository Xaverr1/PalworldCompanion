import type { Pal, WorkType } from "../data/pals";
import { baseCoverage, bestForWork, type HumanWorker } from "../lib/sets";
import { useOwned } from "../hooks/useOwned";

interface GapFit {
  work: WorkType;
  have: Pal | null;
  ideal: Pal | null;
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
  const { owned } = useOwned();
  const coverage = baseCoverage(pals, humans);
  const gaps = coverage.filter((c) => c.maxLevel === 0);
  const exclude = new Set(pals.map((p) => p.name));

  const fits: GapFit[] = gaps.map((g) => ({
    work: g.work,
    have: bestForWork(g.work, exclude, owned),
    ideal: bestForWork(g.work, exclude),
  }));

  return (
    <div className="coverage">
      <div className="coverage__head">
        <h3 className="detail__sub">Work Coverage</h3>
        {(pals.length > 0 || humans.length > 0) && (
          <span className={`coverage__flag ${gaps.length ? "is-gap" : "is-ok"}`}>
            {gaps.length
              ? `${gaps.length} gap${gaps.length > 1 ? "s" : ""}`
              : "All work covered"}
          </span>
        )}
      </div>

      <ul className="worklist">
        {coverage.map((c) => (
          <li key={c.work} className={c.maxLevel ? "" : "worklist__off worklist__gap"}>
            <span>{c.work}</span>
            <span className="worklist__bar">
              <span
                className="worklist__fill"
                style={{ width: `${(c.maxLevel / 10) * 100}%` }}
              />
            </span>
            <b title={`${c.contributors} pal${c.contributors === 1 ? "" : "s"}`}>
              {c.maxLevel || "—"}
              {c.contributors > 1 && <small> ×{c.contributors}</small>}
            </b>
          </li>
        ))}
      </ul>

      {gaps.length > 0 && (
        <div className="suggest">
          <h4 className="coverage__minihead">Best fit for gaps</h4>
          {full ? (
            <p className="coverage__note">Roster full — remove a pal to add suggestions.</p>
          ) : (
            <ul className="suggest__list">
              {fits.map(({ work, have, ideal }) => {
                const sameAsHave = have && ideal && have.name === ideal.name;
                return (
                  <li key={work} className="suggest__gap">
                    <span className="suggest__work">{work}</span>
                    <div className="suggest__fits">
                      <FitRow
                        label="Have"
                        pal={have}
                        work={work}
                        owned
                        onAdd={onAdd}
                      />
                      {!sameAsHave && (
                        <FitRow label="Ideal" pal={ideal} work={work} onAdd={onAdd} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {owned.size === 0 && (
            <p className="coverage__note">
              Mark pals as obtained (☆ on their cards) to see what you can build now.
            </p>
          )}
        </div>
      )}

      <p className="coverage__note">
        Bar shows the highest suitability level in the base; ×N marks how many pals
        can do that job.
      </p>
    </div>
  );
}

function FitRow({
  label,
  pal,
  work,
  owned,
  onAdd,
}: {
  label: string;
  pal: Pal | null;
  work: WorkType;
  owned?: boolean;
  onAdd: (name: string) => void;
}) {
  return (
    <div className="fit">
      <span className={`fit__label ${owned ? "fit__label--have" : "fit__label--ideal"}`}>
        {label}
      </span>
      {pal ? (
        <button className="suggest__btn" onClick={() => onAdd(pal.name)}>
          <img src={pal.icon} alt="" loading="lazy" />
          {pal.name}
          <b>Lv {pal.works[work]}</b>
        </button>
      ) : (
        <span className="fit__none">{owned ? "none obtained" : "—"}</span>
      )}
    </div>
  );
}
