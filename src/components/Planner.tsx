import { useEffect, useMemo, useRef, useState } from "react";
import { PALS, type Pal, type WorkType } from "../data/pals";
import { PASSIVE_BY_ID } from "../data/passives";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { WORK_ICON } from "../lib/work";
import { useSavedSets } from "../hooks/useSavedSets";
import { useOwned, type OwnedPal } from "../hooks/useOwned";
import { useLoadouts } from "../hooks/useLoadouts";
import { SET_LIMIT, type PalSet } from "../lib/sets";
import { BaseCoverage } from "./BaseCoverage";
import { PartySummary } from "./PartySummary";
import { PartyPlanner } from "./PartyPlanner";
import { PalPicker } from "./PalPicker";
import { PalInstanceDetail } from "./PalInstanceDetail";
import { HumanAddButton, HumanCard, HumanDetail } from "./HumanWorkers";

const PAL_BY_NAME = new Map(PALS.map((p) => [p.name, p]));

/** Passive tier colour, mirrored from PartyPlanner / PalInstanceDetail. */
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

/** A base member (owned instance) paired with its species + per-species ordinal. */
interface BaseEntry {
  inst: OwnedPal;
  pal: Pal;
  /** 1-based index among same-species members (0 if this species is unique here). */
  ordinal: number;
}

/** Resolve a base set's member instance-ids to owned entries, numbering duplicates. */
function resolveEntries(memberIds: string[], instances: OwnedPal[]): BaseEntry[] {
  const byId = new Map(instances.map((i) => [i.id, i]));
  const total = new Map<string, number>();
  for (const id of memberIds) {
    const i = byId.get(id);
    if (i) total.set(i.species, (total.get(i.species) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const out: BaseEntry[] = [];
  for (const id of memberIds) {
    const inst = byId.get(id);
    if (!inst) continue;
    const pal = PAL_BY_NAME.get(inst.species);
    if (!pal) continue;
    const n = (seen.get(inst.species) ?? 0) + 1;
    seen.set(inst.species, n);
    out.push({ inst, pal, ordinal: total.get(inst.species)! > 1 ? n : 0 });
  }
  return out;
}

export function Planner() {
  const [mode, setMode] = useState<"party" | "base">("party");
  return (
    <div className="plannerwrap">
      <div className="plannerwrap__modes" role="tablist">
        <button
          role="tab"
          aria-selected={mode === "party"}
          className={`modebtn ${mode === "party" ? "is-active" : ""}`}
          onClick={() => setMode("party")}
        >
          Parties
        </button>
        <button
          role="tab"
          aria-selected={mode === "base"}
          className={`modebtn ${mode === "base" ? "is-active" : ""}`}
          onClick={() => setMode("base")}
        >
          Bases
        </button>
      </div>
      {mode === "party" ? <PartyPlanner /> : <BasePlanner />}
    </div>
  );
}

function BasePlanner() {
  const {
    sets,
    addSet,
    removeSet,
    renameSet,
    addMember,
    removeMember,
    replaceMembers,
    addHuman,
    setHumanName,
    removeHuman,
    setHumanLevel,
    setHumanWork,
  } = useSavedSets();
  const { instances } = useOwned();
  const baseSets = sets.filter((s) => s.kind === "base");
  const [activeId, setActiveId] = useState<string | null>(baseSets[0]?.id ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<BaseEntry | null>(null);

  const active = baseSets.find((s) => s.id === activeId) ?? null;
  const entries = useMemo(
    () => (active ? resolveEntries(active.members, instances) : []),
    [active, instances],
  );

  // One-time migration: older bases stored species names; rewrite each to an
  // owned instance-id (best-level of that species), dropping unowned species.
  const didMigrate = useRef(false);
  useEffect(() => {
    if (didMigrate.current || instances.length === 0) return;
    didMigrate.current = true;
    const validIds = new Set(instances.map((i) => i.id));
    for (const s of baseSets) {
      const legacy = s.members.some(
        (m) => !validIds.has(m) && PAL_BY_NAME.has(m),
      );
      if (!legacy) continue;
      const used = new Set<string>();
      const migrated: string[] = [];
      for (const m of s.members) {
        if (validIds.has(m)) {
          migrated.push(m);
          used.add(m);
        } else if (PAL_BY_NAME.has(m)) {
          const inst = instances
            .filter((i) => i.species === m && !used.has(i.id))
            .sort((a, b) => b.level - a.level)[0];
          if (inst) {
            migrated.push(inst.id);
            used.add(inst.id);
          }
        }
      }
      replaceMembers(s.id, migrated);
    }
  }, [instances, baseSets, replaceMembers]);

  /** Add a suggestion by species: the best-level owned instance not yet placed. */
  function addBySpecies(name: string) {
    if (!active) return;
    const placed = new Set(active.members);
    const inst = instances
      .filter((i) => i.species === name && !placed.has(i.id))
      .sort((a, b) => b.level - a.level)[0];
    if (inst) addMember(active.id, inst.id);
  }

  function handleNew(kind: PalSet["kind"]) {
    const label = kind === "base" ? "Base" : "Party";
    const count = sets.filter((s) => s.kind === kind).length + 1;
    const id = addSet(kind, `${label} ${count}`);
    setActiveId(id);
  }

  function handleDelete(id: string) {
    removeSet(id);
    if (activeId === id) {
      const remaining = baseSets.filter((s) => s.id !== id);
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
        </div>

        {baseSets.length === 0 && (
          <p className="muted planner__hint">Create a base to start planning.</p>
        )}

        <ul className="setlist">
          {baseSets.map((s) => (
            <li key={s.id}>
              <button
                className={`setlist__item ${s.id === activeId ? "is-active" : ""}`}
                onClick={() => setActiveId(s.id)}
              >
                <span className={`setlist__kind kind--${s.kind}`}>{s.kind}</span>
                <span className="setlist__name">{s.name}</span>
                <span className="setlist__count">
                  {s.members.length + (s.humans?.length ?? 0)}/{SET_LIMIT[s.kind]}
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
            entries={entries}
            onRename={(name) => renameSet(active.id, name)}
            onDelete={() => handleDelete(active.id)}
            onOpenPicker={() => setPickerOpen(true)}
            onAddMember={addBySpecies}
            onRemoveMember={(instanceId) => removeMember(active.id, instanceId)}
            onSelectEntry={setDetailEntry}
            onAddHuman={() => addHuman(active.id)}
            onRemoveHuman={(hid) => removeHuman(active.id, hid)}
            onSetHumanName={(hid, name) => setHumanName(active.id, hid, name)}
            onSetHumanLevel={(hid, lvl) => setHumanLevel(active.id, hid, lvl)}
            onSetHumanWork={(hid, w, lvl) => setHumanWork(active.id, hid, w, lvl)}
          />
        )}
      </section>

      {active && pickerOpen && (
        <PalPicker
          set={active}
          onAdd={(instanceId) => addMember(active.id, instanceId)}
          onRemove={(instanceId) => removeMember(active.id, instanceId)}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {detailEntry && (
        <PalInstanceDetail
          instance={detailEntry.inst}
          pal={detailEntry.pal}
          ordinal={detailEntry.ordinal}
          onClose={() => setDetailEntry(null)}
        />
      )}
    </div>
  );
}

function ActiveSet({
  set,
  entries,
  onRename,
  onDelete,
  onOpenPicker,
  onAddMember,
  onRemoveMember,
  onSelectEntry,
  onAddHuman,
  onRemoveHuman,
  onSetHumanName,
  onSetHumanLevel,
  onSetHumanWork,
}: {
  set: PalSet;
  entries: BaseEntry[];
  onRename: (name: string) => void;
  onDelete: () => void;
  onOpenPicker: () => void;
  onAddMember: (name: string) => void;
  onRemoveMember: (instanceId: string) => void;
  onSelectEntry: (entry: BaseEntry) => void;
  onAddHuman: () => void;
  onRemoveHuman: (id: string) => void;
  onSetHumanName: (id: string, name: string) => void;
  onSetHumanLevel: (id: string, level: number) => void;
  onSetHumanWork: (id: string, work: WorkType, level: number) => void;
}) {
  const pals = entries.map((e) => e.pal);
  const humans = set.humans ?? [];
  const limit = SET_LIMIT[set.kind];
  // Base cap counts pals + humans together (15 workers per base).
  const workerCount = set.members.length + humans.length;
  const full = workerCount >= limit;
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
          {workerCount}/{limit}
        </span>
        <button className="btn btn--danger" onClick={onDelete}>
          Delete
        </button>
      </header>

      <div className="setedit__body setedit__body--stack">
        <div className="roster">
          {(entries.length > 0 || humans.length > 0) && (
            <div className="bmc-grid">
              {entries.map((e) => (
                <BaseMemberCard
                  key={e.inst.id}
                  entry={e}
                  onRemove={() => onRemoveMember(e.inst.id)}
                  onSelect={() => onSelectEntry(e)}
                />
              ))}
              {set.kind === "base" &&
                humans.map((h) => (
                  <HumanCard
                    key={h.id}
                    human={h}
                    onSelect={() => setSelectedHuman(h.id)}
                    onRemove={() => {
                      onRemoveHuman(h.id);
                      if (selectedHuman === h.id) setSelectedHuman(null);
                    }}
                  />
                ))}
            </div>
          )}

          <div className="roster__grid roster__grid--controls">
            <button
              className="roster__add"
              onClick={onOpenPicker}
              disabled={full}
              title={full ? "Roster full" : "Add pals"}
            >
              {full ? "Full" : "+ Add pals"}
            </button>
            {set.kind === "base" && (
              <HumanAddButton onAdd={onAddHuman} disabled={full} />
            )}
          </div>
        </div>

        {set.kind === "base" ? (
          <BaseCoverage
            pals={pals}
            humans={humans}
            onAdd={onAddMember}
            full={full}
          />
        ) : (
          <div className="setedit__summary">
            <PartySummary pals={pals} setId={set.id} onAdd={onAddMember} full={full} />
          </div>
        )}
      </div>

      {editing && (
        <HumanDetail
          human={editing}
          onRename={(name) => onSetHumanName(editing.id, name)}
          onLevel={(lvl) => onSetHumanLevel(editing.id, lvl)}
          onWork={(w, lvl) => onSetHumanWork(editing.id, w, lvl)}
          onClose={() => setSelectedHuman(null)}
        />
      )}
    </>
  );
}

/** A base roster member card: work suitabilities, food capacity, and passives. */
function BaseMemberCard({
  entry,
  onRemove,
  onSelect,
}: {
  entry: BaseEntry;
  onRemove: () => void;
  onSelect: () => void;
}) {
  const { inst, pal, ordinal } = entry;
  const { getLoadout } = useLoadouts();
  const works = sortedWorks(pal);
  const passives = getLoadout(inst.id)
    .passives.map((id) => PASSIVE_BY_ID.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  return (
    <div
      className="bmc"
      role="button"
      tabIndex={0}
      title={`Edit ${inst.nickname || pal.name}`}
      onClick={onSelect}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onSelect();
        }
      }}
    >
      <span
        className="pmc__tier"
        style={{ background: TIER_COLOR[pal.tier] }}
        title={`Combat tier ${pal.tier}`}
      >
        {pal.tier}
      </span>
      <button
        className="pmc__remove"
        aria-label={`Remove ${pal.name}`}
        onClick={(ev) => {
          ev.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>
      <img className="pmc__icon" src={pal.icon} alt="" loading="lazy" />
      <div className="pmc__body">
        <div className="pmc__title">
          <span className="pmc__lv">
            Lv {inst.level}
            {(inst.stars ?? 0) > 0 && (
              <span className="pbx__stars">{"★".repeat(inst.stars!)}</span>
            )}
          </span>
          <span className="pmc__name">
            {inst.nickname || pal.name}
            {ordinal > 0 && <span className="pmc__ord">#{ordinal}</span>}
          </span>
          <span className="pmc__els">
            {pal.elements.map((el) => (
              <span
                key={el}
                className="pmc__el"
                style={{ background: ELEMENT_COLOR[el] }}
                title={el}
              />
            ))}
          </span>
        </div>

        <div className="bmc__works">
          {works.map(([work, lvl]) => (
            <span key={work} className="workicon" title={`${work} · Lv ${lvl}`}>
              <img src={WORK_ICON[work]} alt={work} loading="lazy" />
              <span className="workicon__lvl">{lvl}</span>
            </span>
          ))}
          {works.length === 0 && (
            <span className="bmc__nowork">No work suitability</span>
          )}
          <span className="bmc__food" title={`Food capacity ${pal.food}`}>
            🍖 {pal.food}
          </span>
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
