import { useEffect } from "react";
import { WORK_TYPES, type WorkType } from "../data/pals";
import { PASSIVE_BY_ID } from "../data/passives";
import { WORK_ICON } from "../lib/work";
import { MAX_LEVEL } from "../hooks/useOwned";
import { useLoadouts } from "../hooks/useLoadouts";
import { PassivesEditor } from "./PassivesEditor";
import type { HumanWorker } from "../lib/sets";

/** Passive tier colour, mirrored from the pal cards. */
function passiveColor(rank: number): string {
  if (rank < 0) return "#e0533a"; // negative
  if (rank >= 4) return "#14b8a6"; // top tier — teal
  if (rank >= 3) return "#f0b429"; // 2nd tier — gold
  return "#9ca3af"; // 3rd tier — gray
}

/** A human's work suitabilities, highest level first. */
function sortedWorks(
  works: Partial<Record<WorkType, number>>,
): [WorkType, number][] {
  return (Object.entries(works) as [WorkType, number][])
    .filter(([, lvl]) => lvl > 0)
    .sort((a, b) => b[1] - a[1]);
}

/** "+ Add human" tile, styled to match the "+ Add pals" tile. */
export function HumanAddButton({
  onAdd,
  disabled,
}: {
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="roster__add"
      onClick={onAdd}
      disabled={disabled}
      title={disabled ? "Base full" : "Add a human worker"}
    >
      {disabled ? "Full" : "+ Add human"}
    </button>
  );
}

/**
 * A human base worker as a roster card, mirroring the pal member card but with
 * a face in place of the icon and no combat/food stats. Click to edit.
 */
export function HumanCard({
  human,
  onSelect,
  onRemove,
}: {
  human: HumanWorker;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { getLoadout } = useLoadouts();
  const works = sortedWorks(human.works);
  const passives = getLoadout(human.id)
    .passives.map((id) => PASSIVE_BY_ID.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  return (
    <div
      className="bmc bmc--human"
      role="button"
      tabIndex={0}
      title={`Edit ${human.name || "Human Worker"}`}
      onClick={onSelect}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onSelect();
        }
      }}
    >
      <button
        className="pmc__remove"
        aria-label="Remove human"
        onClick={(ev) => {
          ev.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>
      <span className="bmc__face">👤</span>
      <div className="pmc__body">
        <div className="pmc__title">
          <span className="pmc__lv">Lv {human.level}</span>
          <span className="pmc__name">{human.name || "Human Worker"}</span>
        </div>

        <div className="bmc__works">
          {works.map(([work, lvl]) => (
            <span key={work} className="workicon" title={`${work} · Lv ${lvl}`}>
              <img src={WORK_ICON[work]} alt={work} loading="lazy" />
              <span className="workicon__lvl">{lvl}</span>
            </span>
          ))}
          {works.length === 0 && (
            <span className="bmc__nowork">No work set — tap to configure</span>
          )}
        </div>

        {passives.length > 0 && (
          <div className="pmc__passives">
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
          </div>
        )}
      </div>
    </div>
  );
}

/** Modal editor for a human worker: rename, per-work levels, passive skills. */
export function HumanDetail({
  human,
  onRename,
  onLevel,
  onWork,
  onClose,
}: {
  human: HumanWorker;
  onRename: (name: string) => void;
  onLevel: (level: number) => void;
  onWork: (work: WorkType, level: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal__panel humandetail"
        role="dialog"
        aria-modal="true"
        aria-label="Edit human worker"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="humandetail__head">
          <span className="bmc__face bmc__face--lg">👤</span>
          <input
            className="setedit__name"
            value={human.name ?? ""}
            placeholder="Human Worker"
            aria-label="Human worker name"
            onChange={(e) => onRename(e.target.value)}
          />
          <label className="owninst__lvl">
            Lv
            <input
              type="number"
              min={1}
              max={MAX_LEVEL}
              value={human.level}
              onChange={(e) => onLevel(Number(e.target.value))}
            />
          </label>
        </div>

        <h3 className="detail__sub">Work Suitability</h3>
        <div className="human-card__works">
          {WORK_TYPES.map((w) => (
            <label key={w} className="human-work" title={w}>
              <img src={WORK_ICON[w]} alt={w} />
              <input
                type="number"
                min={0}
                max={10}
                value={human.works[w] ?? 0}
                onChange={(e) => onWork(w, Number(e.target.value))}
              />
            </label>
          ))}
        </div>

        <h3 className="detail__sub">Passive Skills</h3>
        <PassivesEditor instanceId={human.id} showHeading={false} addCollapsed />
      </div>
    </div>
  );
}
