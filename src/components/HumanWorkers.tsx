import { WORK_TYPES, type WorkType } from "../data/pals";
import { WORK_ICON } from "../lib/work";
import { MAX_LEVEL } from "../hooks/useOwned";
import { HUMAN_TYPES } from "../data/humans";
import type { HumanWorker } from "../lib/sets";

/** Preset picker that adds a human worker; styled to sit in the roster grid. */
export function HumanAddSelect({ onAdd }: { onAdd: (typeId: string) => void }) {
  return (
    <select
      className="roster__add roster__add--human"
      value=""
      aria-label="Add a human worker"
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
        e.currentTarget.value = "";
      }}
    >
      <option value="">+ Add human</option>
      {HUMAN_TYPES.map((t) => (
        <option key={t.id} value={t.id} title={t.note}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

/** A human worker shown as a roster tile (click to edit). */
export function HumanTile({
  human,
  selected,
  onSelect,
  onRemove,
}: {
  human: HumanWorker;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`roster__pal roster__human ${selected ? "is-selected" : ""}`}
      role="button"
      tabIndex={0}
      title={`Edit ${human.name ?? "Human"}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <button
        className="roster__remove"
        aria-label="Remove human"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>
      <span className="roster__human-face">👤</span>
      <span>{human.name ?? "Human"}</span>
      <span className="roster__human-lv">
        Lv {human.level}
        {human.merchant && " · Merchant"}
      </span>
    </div>
  );
}

/** Editor for one selected human: level + per-work suitability. */
export function HumanEditor({
  human,
  onLevel,
  onWork,
}: {
  human: HumanWorker;
  onLevel: (level: number) => void;
  onWork: (work: WorkType, level: number) => void;
}) {
  return (
    <div className="human-card">
      <div className="human-card__top">
        <span className="human-card__name">
          👤 {human.name ?? "Human"}
          {human.merchant && <span className="human-card__tag">Merchant</span>}
        </span>
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
    </div>
  );
}
