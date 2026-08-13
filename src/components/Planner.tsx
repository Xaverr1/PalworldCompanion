import { useState } from "react";
import type { Pal, WorkType } from "../data/pals";
import { useSavedSets } from "../hooks/useSavedSets";
import { SET_LIMIT, resolveMembers, type PalSet } from "../lib/sets";
import { BaseCoverage } from "./BaseCoverage";
import { PartySummary } from "./PartySummary";
import { PalPicker } from "./PalPicker";
import { PalDetail } from "./PalDetail";
import { HumanAddSelect, HumanTile, HumanEditor } from "./HumanWorkers";

export function Planner() {
  const {
    sets,
    addSet,
    removeSet,
    renameSet,
    addMember,
    removeMember,
    addHuman,
    removeHuman,
    setHumanLevel,
    setHumanWork,
  } = useSavedSets();
  const [activeId, setActiveId] = useState<string | null>(sets[0]?.id ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailPal, setDetailPal] = useState<Pal | null>(null);

  const active = sets.find((s) => s.id === activeId) ?? null;

  function handleNew(kind: PalSet["kind"]) {
    const label = kind === "base" ? "Base" : "Party";
    const count = sets.filter((s) => s.kind === kind).length + 1;
    const id = addSet(kind, `${label} ${count}`);
    setActiveId(id);
  }

  function handleDelete(id: string) {
    removeSet(id);
    if (activeId === id) {
      const remaining = sets.filter((s) => s.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  }

  return (
    <div className="planner">
      <aside className="planner__sidebar">
        <div className="planner__new">
          <button className="btn" onClick={() => handleNew("base")}>
            + Base
          </button>
          <button className="btn" onClick={() => handleNew("party")}>
            + Party
          </button>
        </div>

        {sets.length === 0 && (
          <p className="muted planner__hint">
            Create a base or party to start planning.
          </p>
        )}

        <ul className="setlist">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                className={`setlist__item ${s.id === activeId ? "is-active" : ""}`}
                onClick={() => setActiveId(s.id)}
              >
                <span className={`setlist__kind kind--${s.kind}`}>{s.kind}</span>
                <span className="setlist__name">{s.name}</span>
                <span className="setlist__count">
                  {s.members.length}/{SET_LIMIT[s.kind]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="planner__main">
        {!active ? (
          <div className="empty">Select or create a set on the left.</div>
        ) : (
          <ActiveSet
            key={active.id}
            set={active}
            onRename={(name) => renameSet(active.id, name)}
            onDelete={() => handleDelete(active.id)}
            onOpenPicker={() => setPickerOpen(true)}
            onAddMember={(name) => addMember(active.id, name)}
            onRemoveMember={(name) => removeMember(active.id, name)}
            onSelectPal={setDetailPal}
            onAddHuman={(typeId) => addHuman(active.id, typeId)}
            onRemoveHuman={(hid) => removeHuman(active.id, hid)}
            onSetHumanLevel={(hid, lvl) => setHumanLevel(active.id, hid, lvl)}
            onSetHumanWork={(hid, w, lvl) => setHumanWork(active.id, hid, w, lvl)}
          />
        )}
      </section>

      {active && pickerOpen && (
        <PalPicker
          set={active}
          onAdd={(name) => addMember(active.id, name)}
          onRemove={(name) => removeMember(active.id, name)}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {detailPal && (
        <PalDetail pal={detailPal} onClose={() => setDetailPal(null)} />
      )}
    </div>
  );
}

function ActiveSet({
  set,
  onRename,
  onDelete,
  onOpenPicker,
  onAddMember,
  onRemoveMember,
  onSelectPal,
  onAddHuman,
  onRemoveHuman,
  onSetHumanLevel,
  onSetHumanWork,
}: {
  set: PalSet;
  onRename: (name: string) => void;
  onDelete: () => void;
  onOpenPicker: () => void;
  onAddMember: (name: string) => void;
  onRemoveMember: (name: string) => void;
  onSelectPal: (pal: Pal) => void;
  onAddHuman: (typeId: string) => void;
  onRemoveHuman: (id: string) => void;
  onSetHumanLevel: (id: string, level: number) => void;
  onSetHumanWork: (id: string, work: WorkType, level: number) => void;
}) {
  const pals = resolveMembers(set);
  const humans = set.humans ?? [];
  const limit = SET_LIMIT[set.kind];
  const full = set.members.length >= limit;
  const [selectedHuman, setSelectedHuman] = useState<string | null>(null);
  const editing = humans.find((h) => h.id === selectedHuman) ?? null;

  return (
    <>
      <header className="setedit__head">
        <span className={`setlist__kind kind--${set.kind}`}>{set.kind}</span>
        <input
          className="setedit__name"
          value={set.name}
          aria-label="Set name"
          onChange={(e) => onRename(e.target.value)}
        />
        <span className="count">
          {set.members.length}/{limit}
        </span>
        <button className="btn btn--danger" onClick={onDelete}>
          Delete
        </button>
      </header>

      <div className="setedit__body">
        <div className="roster">
          <div className="roster__grid">
            {pals.map((p) => (
              <div
                key={p.name}
                className="roster__pal"
                role="button"
                tabIndex={0}
                title={`Edit ${p.name}`}
                onClick={() => onSelectPal(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectPal(p);
                  }
                }}
              >
                <button
                  className="roster__remove"
                  aria-label={`Remove ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveMember(p.name);
                  }}
                >
                  ×
                </button>
                <img src={p.icon} alt="" loading="lazy" />
                <span>{p.name}</span>
              </div>
            ))}

            {set.kind === "base" &&
              humans.map((h) => (
                <HumanTile
                  key={h.id}
                  human={h}
                  selected={h.id === selectedHuman}
                  onSelect={() =>
                    setSelectedHuman((id) => (id === h.id ? null : h.id))
                  }
                  onRemove={() => {
                    onRemoveHuman(h.id);
                    if (selectedHuman === h.id) setSelectedHuman(null);
                  }}
                />
              ))}

            <button
              className="roster__add"
              onClick={onOpenPicker}
              disabled={full}
              title={full ? "Roster full" : "Add pals"}
            >
              {full ? "Full" : "+ Add pals"}
            </button>
            {set.kind === "base" && <HumanAddSelect onAdd={onAddHuman} />}
          </div>

          {set.kind === "base" && editing && (
            <HumanEditor
              human={editing}
              onLevel={(lvl) => onSetHumanLevel(editing.id, lvl)}
              onWork={(w, lvl) => onSetHumanWork(editing.id, w, lvl)}
            />
          )}
        </div>

        <div className="setedit__summary">
          {set.kind === "base" ? (
            <BaseCoverage
              pals={pals}
              humans={humans}
              onAdd={onAddMember}
              full={full}
            />
          ) : (
            <PartySummary pals={pals} setId={set.id} onAdd={onAddMember} full={full} />
          )}
        </div>
      </div>
    </>
  );
}
