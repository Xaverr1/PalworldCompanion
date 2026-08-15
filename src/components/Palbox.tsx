import { useEffect, useMemo, useState } from "react";
import {
  PALS,
  ELEMENTS,
  WORK_TYPES,
  TIERS,
  type Element,
  type Pal,
  type WorkType,
} from "../data/pals";
import { SKILL_BY_ID } from "../data/skills";
import { PASSIVE_BY_ID } from "../data/passives";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { scaledStats } from "../lib/stats";
import { MAX_LEVEL, useOwned, type OwnedPal } from "../hooks/useOwned";
import { useLoadouts } from "../hooks/useLoadouts";
import { AbilitiesEditor } from "./AbilitiesEditor";
import { PassivesEditor } from "./PassivesEditor";

const PAL_BY_NAME = new Map(PALS.map((p) => [p.name, p]));

/** An owned instance paired with its species record + a per-species ordinal. */
interface Entry {
  inst: OwnedPal;
  pal: Pal;
  /** 1-based index among instances of the same species (0 if unique). */
  ordinal: number;
}

const statsOf = (e: Entry) =>
  scaledStats(e.pal, e.inst.level, e.inst.ivs ? { talents: e.inst.ivs } : {});

type SortKey = "level" | "name" | "species" | "tier";
const TIER_RANK: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, F: 4 };

export function Palbox() {
  const { instances, addInstance, removeInstance } = useOwned();
  const { getLoadout } = useLoadouts();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [query, setQuery] = useState("");
  const [element, setElement] = useState<Element | null>(null);
  const [work, setWork] = useState<WorkType | "">("");
  const [tier, setTier] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [passiveQ, setPassiveQ] = useState("");
  const [sort, setSort] = useState<SortKey>("species");

  // Resolve owned instances to species records, numbering duplicates.
  const entries = useMemo<Entry[]>(() => {
    const seen = new Map<string, number>();
    const total = new Map<string, number>();
    for (const i of instances)
      total.set(i.species, (total.get(i.species) ?? 0) + 1);
    const out: Entry[] = [];
    for (const inst of instances) {
      const pal = PAL_BY_NAME.get(inst.species);
      if (!pal) continue;
      const n = (seen.get(inst.species) ?? 0) + 1;
      seen.set(inst.species, n);
      out.push({ inst, pal, ordinal: total.get(inst.species)! > 1 ? n : 0 });
    }
    return out;
  }, [instances]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pq = passiveQ.trim().toLowerCase();
    const filtered = entries.filter((e) => {
      if (
        q &&
        !e.pal.name.toLowerCase().includes(q) &&
        !(e.inst.nickname ?? "").toLowerCase().includes(q)
      )
        return false;
      if (element && !e.pal.elements.includes(element)) return false;
      if (work && !(work in e.pal.works)) return false;
      if (tier && e.pal.tier !== tier) return false;
      if (gender && (e.inst.gender ?? "") !== gender) return false;
      if (pq) {
        const names = getLoadout(e.inst.id)
          .passives.map((id) => PASSIVE_BY_ID.get(id)?.name.toLowerCase() ?? "")
          .join(" ");
        if (!names.includes(pq)) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      switch (sort) {
        case "name":
          return (a.inst.nickname ?? a.pal.name).localeCompare(
            b.inst.nickname ?? b.pal.name,
          );
        case "level":
          return b.inst.level - a.inst.level || a.pal.name.localeCompare(b.pal.name);
        case "tier":
          return (
            TIER_RANK[a.pal.tier] - TIER_RANK[b.pal.tier] ||
            b.inst.level - a.inst.level
          );
        case "species":
        default:
          return (
            a.pal.name.localeCompare(b.pal.name) || a.ordinal - b.ordinal
          );
      }
    });
  }, [entries, query, passiveQ, element, work, tier, gender, sort, getLoadout]);

  const detail = entries.find((e) => e.inst.id === detailId) ?? null;

  return (
    <div className="pbx">
      <div className="pbx__bar">
        <div className="pbx__barhead">
          <h2 className="pbx__title">
            Palbox <span className="pbx__count">{instances.length} pals</span>
          </h2>
          <button className="btn" onClick={() => setAdding(true)}>
            + Add pal
          </button>
        </div>
        <div className="filters">
          <div className="filter-row">
            <input
              className="search"
              type="search"
              placeholder="Search by name or nickname…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <input
              className="search"
              type="search"
              placeholder="Has passive…"
              value={passiveQ}
              onChange={(e) => setPassiveQ(e.target.value)}
            />
          </div>
          <div className="filter-row" role="group" aria-label="Filter by element">
            <button
              className={`chip ${!element ? "chip--on" : ""}`}
              onClick={() => setElement(null)}
            >
              All
            </button>
            {ELEMENTS.map((el) => (
              <button
                key={el}
                className={`chip ${element === el ? "chip--on" : ""}`}
                style={
                  element === el
                    ? { background: ELEMENT_COLOR[el], borderColor: ELEMENT_COLOR[el] }
                    : { borderColor: ELEMENT_COLOR[el], color: ELEMENT_COLOR[el] }
                }
                onClick={() => setElement((cur) => (cur === el ? null : el))}
              >
                {el}
              </button>
            ))}
          </div>
          <div className="filter-row filter-row--selects">
            <label>
              Work
              <select value={work} onChange={(e) => setWork(e.target.value as WorkType | "")}>
                <option value="">Any</option>
                {WORK_TYPES.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </label>
            <label>
              Tier
              <select value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">Any</option>
                {TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Gender
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Any</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
            <label>
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="species">Species</option>
                <option value="name">Name</option>
                <option value="level">Level</option>
                <option value="tier">Combat tier</option>
              </select>
            </label>
            <span className="count">{results.length} shown</span>
          </div>
        </div>
      </div>

      <div className="pbx__catalog">
        {entries.length === 0 ? (
          <p className="empty">
            Your Palbox is empty. Use “Import Pals” to load your save, or add pals
            manually.
          </p>
        ) : results.length === 0 ? (
          <p className="empty">No pals match those filters.</p>
        ) : (
          <div className="pbx__grid">
            {results.map((e) => (
              <PalboxCard
                key={e.inst.id}
                entry={e}
                onOpen={() => setDetailId(e.inst.id)}
              />
            ))}
          </div>
        )}
      </div>

      {detail && (
        <InstanceDetail
          entry={detail}
          onClose={() => setDetailId(null)}
          onRemove={() => {
            removeInstance(detail.inst.id);
            setDetailId(null);
          }}
        />
      )}

      {adding && (
        <AddPalPicker onAdd={(name) => addInstance(name)} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}

/** Compact chips for a pal's equipped abilities. */
function AbilityChips({ instanceId }: { instanceId: string }) {
  const { getLoadout } = useLoadouts();
  const equipped = getLoadout(instanceId)
    .equipped.map((id) => SKILL_BY_ID.get(id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);
  if (equipped.length === 0)
    return <span className="party__abil-empty">no abilities</span>;
  return (
    <>
      {equipped.map((sk) => (
        <span
          key={sk.id}
          className="abil-chip"
          style={{ borderColor: ELEMENT_COLOR[sk.element] }}
        >
          <i style={{ background: ELEMENT_COLOR[sk.element] }} />
          {sk.name}
        </span>
      ))}
    </>
  );
}

/** Compact chips for a pal's passive skills. */
function PassiveChips({ instanceId }: { instanceId: string }) {
  const { getLoadout } = useLoadouts();
  const passives = getLoadout(instanceId)
    .passives.map((id) => PASSIVE_BY_ID.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  if (passives.length === 0) return null;
  return (
    <div className="pbx__passives">
      {passives.map((p) => (
        <span key={p.id} className="chip chip--tag" title={p.description}>
          {p.name}
        </span>
      ))}
    </div>
  );
}

function GenderBadge({ gender }: { gender?: string }) {
  if (gender !== "Male" && gender !== "Female") return null;
  const male = gender === "Male";
  return (
    <span className={`pbx__gender ${male ? "is-male" : "is-female"}`} title={gender}>
      {male ? "♂" : "♀"}
    </span>
  );
}

function PalboxCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const s = statsOf(entry);
  const label = entry.inst.nickname || entry.pal.name;
  return (
    <article
      className="icard pbx__card"
      role="button"
      tabIndex={0}
      title={`Edit ${label}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="icard__head">
        <span className="icard__tier" style={{ background: TIER_COLOR[entry.pal.tier] }}>
          {entry.pal.tier}
        </span>
        <GenderBadge gender={entry.inst.gender} />
      </div>
      <img className="icard__icon" src={entry.pal.icon} alt="" loading="lazy" />
      <h3 className="icard__name">
        {label}
        {entry.ordinal > 0 && <span className="icard__ord">#{entry.ordinal}</span>}
      </h3>
      {entry.inst.nickname && <div className="pbx__species">{entry.pal.name}</div>}
      <div className="icard__lv">Lv {entry.inst.level}</div>
      <div className="icard__els">
        {entry.pal.elements.map((el) => (
          <span
            key={el}
            className="chip chip--element"
            style={{ background: ELEMENT_COLOR[el] }}
          >
            {el}
          </span>
        ))}
      </div>
      <dl className="icard__stats">
        <div><dt>HP</dt><dd>{s.hp.toLocaleString()}</dd></div>
        <div><dt>ATK</dt><dd>{s.atk.toLocaleString()}</dd></div>
        <div><dt>DEF</dt><dd>{s.def.toLocaleString()}</dd></div>
      </dl>
      <div className="pbx__abils">
        <AbilityChips instanceId={entry.inst.id} />
      </div>
      <PassiveChips instanceId={entry.inst.id} />
    </article>
  );
}

/** Full editor for a single owned instance (level, nickname, gender, skills). */
function InstanceDetail({
  entry,
  onClose,
  onRemove,
}: {
  entry: Entry;
  onClose: () => void;
  onRemove: () => void;
}) {
  const { setLevel, setNickname, setGender } = useOwned();
  const { inst, pal } = entry;
  const s = statsOf(entry);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={inst.nickname || pal.name}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <header className="detail__head">
          <img className="detail__icon" src={pal.icon} alt="" />
          <div>
            <span className="detail__dex">
              {pal.paldex ? `#${pal.paldex}` : "Terraria Collab"} · {pal.name}
              {entry.ordinal > 0 && ` #${entry.ordinal}`}
            </span>
            <input
              className="setedit__name pbx__nick"
              value={inst.nickname ?? ""}
              placeholder={pal.name}
              aria-label="Nickname"
              onChange={(e) => setNickname(inst.id, e.target.value)}
            />
            <div className="detail__elements">
              {pal.elements.map((el) => (
                <span
                  key={el}
                  className="chip chip--element"
                  style={{ background: ELEMENT_COLOR[el] }}
                >
                  {el}
                </span>
              ))}
              <span
                className="chip chip--element"
                style={{ background: TIER_COLOR[pal.tier] }}
                title={`${pal.combatPctl}th combat percentile`}
              >
                Tier {pal.tier}
              </span>
            </div>
          </div>
        </header>

        <div className="pbx__editrow">
          <label className="owninst__lvl">
            Lv
            <input
              type="number"
              min={1}
              max={MAX_LEVEL}
              value={inst.level}
              onChange={(e) => setLevel(inst.id, Number(e.target.value))}
            />
          </label>
          <input
            type="range"
            min={1}
            max={MAX_LEVEL}
            value={inst.level}
            onChange={(e) => setLevel(inst.id, Number(e.target.value))}
            className="owninst__slider"
            aria-label={`Level of ${pal.name}`}
          />
          <div className="pbx__genderpick" role="group" aria-label="Gender">
            {(["Male", "Female"] as const).map((g) => (
              <button
                key={g}
                className={`chip ${inst.gender === g ? "chip--on" : ""}`}
                onClick={() => setGender(inst.id, inst.gender === g ? "" : g)}
              >
                {g === "Male" ? "♂ Male" : "♀ Female"}
              </button>
            ))}
          </div>
        </div>

        <div className="detail__stats">
          <Stat label="HP" value={s.hp} />
          <Stat label="Attack" value={s.atk} />
          <Stat label="Defense" value={s.def} />
          <Stat label="Food" value={pal.food} />
        </div>
        {inst.ivs && (
          <p className="stats__note">
            IVs — HP {inst.ivs.hp} · Shot {inst.ivs.shot} · Defense {inst.ivs.defense}
          </p>
        )}

        <AbilitiesEditor instanceId={inst.id} />
        <PassivesEditor instanceId={inst.id} />

        <div className="pbx__detailfoot">
          <button className="btn btn--danger" onClick={onRemove}>
            Remove from Palbox
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="detail__stat">
      <span className="detail__stat-label">{label}</span>
      <span className="detail__stat-value">{value.toLocaleString()}</span>
    </div>
  );
}

/** Lightweight species picker that adds an owned instance and stays open. */
function AddPalPicker({
  onAdd,
  onClose,
}: {
  onAdd: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PALS.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.paldex ?? "").toLowerCase().includes(q),
    ).slice(0, 120);
  }, [query]);

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal__panel picker"
        role="dialog"
        aria-modal="true"
        aria-label="Add a pal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3 className="detail__sub">Add a pal to your Palbox</h3>
        <input
          className="search"
          type="search"
          autoFocus
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="picker__list">
          {results.map((p) => (
            <li key={p.name}>
              <button
                className="picker__row"
                onClick={() => {
                  onAdd(p.name);
                  setJustAdded(p.name);
                }}
              >
                <img src={p.icon} alt="" loading="lazy" />
                <span className="picker__name">{p.name}</span>
                <span className="picker__els">
                  {p.elements.map((el) => (
                    <i
                      key={el}
                      className="picker__dot"
                      style={{ background: ELEMENT_COLOR[el] }}
                      title={el}
                    />
                  ))}
                </span>
                <span className="picker__act">
                  {justAdded === p.name ? "✓ Added" : "+ Add"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
