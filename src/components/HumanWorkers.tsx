import { WORK_TYPES, type WorkType } from "../data/pals";
import { WORK_ICON } from "../lib/work";
import { MAX_LEVEL } from "../hooks/useOwned";
import type { HumanWorker } from "../lib/sets";

export function HumanWorkers({
  humans,
  onAdd,
  onRemove,
  onLevel,
  onWork,
}: {
  humans: HumanWorker[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onLevel: (id: string, level: number) => void;
  onWork: (id: string, work: WorkType, level: number) => void;
}) {
  return (
    <div className="humans">
      <div className="humans__head">
        <h3 className="detail__sub">Human Workers</h3>
        <button className="own-add" onClick={onAdd}>
          + Add human
        </button>
      </div>

      {humans.length === 0 ? (
        <p className="coverage__note">
          Caught humans assigned to this base. Set each one's work levels by hand —
          they count toward coverage below.
        </p>
      ) : (
        <ul className="humans__list">
          {humans.map((h, i) => (
            <li key={h.id} className="human-card">
              <div className="human-card__top">
                <span className="owninst__idx">👤 #{i + 1}</span>
                <label className="owninst__lvl">
                  Lv
                  <input
                    type="number"
                    min={1}
                    max={MAX_LEVEL}
                    value={h.level}
                    onChange={(e) => onLevel(h.id, Number(e.target.value))}
                  />
                </label>
                <button
                  className="owninst__remove"
                  aria-label="Remove human"
                  onClick={() => onRemove(h.id)}
                >
                  ×
                </button>
              </div>
              <div className="human-card__works">
                {WORK_TYPES.map((w) => (
                  <label key={w} className="human-work" title={w}>
                    <img src={WORK_ICON[w]} alt={w} />
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={h.works[w] ?? 0}
                      onChange={(e) => onWork(h.id, w, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
