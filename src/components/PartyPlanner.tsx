import { useEffect, useMemo, useRef, useState } from "react";
import {
  PALS,
  ELEMENTS,
  WORK_TYPES,
  TIERS,
  type Element,
  type Pal,
  type WorkType,
} from "../data/pals";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { scaledStats } from "../lib/stats";
import { condenserStatBonus } from "../lib/upgrades";
import { partySummary, bestCounter } from "../lib/sets";
import { partyMatchup } from "../lib/typechart";
import { useOwned, type OwnedPal } from "../hooks/useOwned";
import { useParties, PARTY_LIMIT } from "../hooks/useParties";
import { PalInstanceDetail } from "./PalInstanceDetail";

const PAL_BY_NAME = new Map(PALS.map((p) => [p.name, p]));

/** An owned instance paired with its species record + a per-species ordinal. */
interface OwnedEntry {
  inst: OwnedPal;
  pal: Pal;
  /** 1-based index among instances of the same species (0 if unique). */
  ordinal: number;
}

const stats = (e: OwnedEntry) =>
  scaledStats(e.pal, e.inst.level, {
    ...(e.inst.ivs ? { talents: e.inst.ivs } : {}),
    condenser: condenserStatBonus(e.inst.stars ?? 0),
  });

type SortKey = "level" | "name" | "tier" | "hp" | "atk" | "def";
const TIER_RANK: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, F: 4 };

export function PartyPlanner() {
  const { instances } = useOwned();
  const { parties, addParty, removeParty, renameParty, toggleMember } =
    useParties();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Catalog filters.
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<Element | null>(null);
  const [work, setWork] = useState<WorkType | "">("");
  const [tier, setTier] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("level");

  // Resolve owned instances to species records, numbering duplicates.
  const entries = useMemo<OwnedEntry[]>(() => {
    const seen = new Map<string, number>();
    const total = new Map<string, number>();
    for (const i of instances)
      total.set(i.species, (total.get(i.species) ?? 0) + 1);
    const out: OwnedEntry[] = [];
    for (const inst of instances) {
      const pal = PAL_BY_NAME.get(inst.species);
      if (!pal) continue;
      const n = (seen.get(inst.species) ?? 0) + 1;
      seen.set(inst.species, n);
      out.push({ inst, pal, ordinal: total.get(inst.species)! > 1 ? n : 0 });
    }
    return out;
  }, [instances]);

  const byId = useMemo(
    () => new Map(entries.map((e) => [e.inst.id, e])),
    [entries],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entries.filter((e) => {
      if (q && !e.pal.name.toLowerCase().includes(q)) return false;
      if (element && !e.pal.elements.includes(element)) return false;
      if (work && !(work in e.pal.works)) return false;
      if (tier && e.pal.tier !== tier) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.pal.name.localeCompare(b.pal.name) || a.inst.level - b.inst.level;
        case "tier":
          return (
            TIER_RANK[a.pal.tier] - TIER_RANK[b.pal.tier] ||
            b.inst.level - a.inst.level
          );
        case "hp":
          return stats(b).hp - stats(a).hp;
        case "atk":
          return stats(b).atk - stats(a).atk;
        case "def":
          return stats(b).def - stats(a).def;
        case "level":
        default:
          return b.inst.level - a.inst.level || a.pal.name.localeCompare(b.pal.name);
      }
    });
  }, [entries, query, element, work, tier, sort]);

  const active = parties.find((p) => p.id === activeId) ?? parties[0] ?? null;
  const memberIds = new Set(active?.members ?? []);
  const members = (active?.members ?? [])
    .map((id) => byId.get(id))
    .filter((e): e is OwnedEntry => e !== undefined);

  // Always have a party to fill, so catalog clicks can't spawn duplicates.
  // Ref-guarded so React StrictMode's double-invoke can't create two.
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current && parties.length === 0) {
      didInit.current = true;
      addParty("Party 1");
    }
  }, [parties.length, addParty]);

  function toggle(instanceId: string) {
    if (active) toggleMember(active.id, instanceId);
  }

  return (
    <div className="pp">
      <div className="pp__frozen">
        <PartyBar
          parties={parties}
          activeId={active?.id ?? null}
          onSelect={setActiveId}
          onNew={() => setActiveId(addParty(`Party ${parties.length + 1}`))}
          onRename={(name) => active && renameParty(active.id, name)}
          onDelete={() => {
            if (!active) return;
            removeParty(active.id);
            setActiveId(null);
          }}
        />
        <div className="pp__top">
          <PartyCards members={members} onRemove={toggle} />
          <PartyInfo members={members} />
        </div>
        <CatalogFilters
          query={query}
          setQuery={setQuery}
          element={element}
          setElement={setElement}
          work={work}
          setWork={setWork}
          tier={tier}
          setTier={setTier}
          sort={sort}
          setSort={setSort}
          count={results.length}
        />
      </div>

      <div className="pp__catalog">
        {entries.length === 0 ? (
          <p className="empty">
            You have no obtained pals yet. Import a save or mark pals obtained in
            Browse.
          </p>
        ) : (
          <div className="pp__grid">
            {results.map((e) => (
              <InstanceCard
                key={e.inst.id}
                entry={e}
                inParty={memberIds.has(e.inst.id)}
                onToggle={() => toggle(e.inst.id)}
                onInfo={() => setDetailId(e.inst.id)}
              />
            ))}
            {results.length === 0 && (
              <p className="empty">No pals match those filters.</p>
            )}
          </div>
        )}
      </div>

      {detailId && byId.has(detailId) && (
        <PalInstanceDetail
          instance={byId.get(detailId)!.inst}
          pal={byId.get(detailId)!.pal}
          ordinal={byId.get(detailId)!.ordinal}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

// --- Party selector ----------------------------------------------------------
function PartyBar({
  parties,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: {
  parties: { id: string; name: string; members: string[] }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const active = parties.find((p) => p.id === activeId) ?? null;
  return (
    <div className="pp__bar">
      <div className="pp__tabs">
        {parties.map((p) => (
          <button
            key={p.id}
            className={`pp__tab ${p.id === activeId ? "is-active" : ""}`}
            onClick={() => onSelect(p.id)}
          >
            {p.name}
            <span className="pp__tab-count">{p.members.length}/{PARTY_LIMIT}</span>
          </button>
        ))}
        <button className="pp__tab pp__tab--new" onClick={onNew}>
          + Party
        </button>
      </div>
      {active && (
        <div className="pp__baractions">
          <input
            className="pp__name"
            value={active.name}
            aria-label="Party name"
            onChange={(e) => onRename(e.target.value)}
          />
          <button className="btn btn--danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// --- Party member cards (left) ----------------------------------------------
function PartyCards({
  members,
  onRemove,
}: {
  members: OwnedEntry[];
  onRemove: (instanceId: string) => void;
}) {
  const slots = PARTY_LIMIT - members.length;
  return (
    <div className="pp__cards">
      {members.map((e) => {
        const s = stats(e);
        return (
          <div key={e.inst.id} className="pmc">
            <button
              className="pmc__remove"
              aria-label={`Remove ${e.pal.name}`}
              onClick={() => onRemove(e.inst.id)}
            >
              ×
            </button>
            <img className="pmc__icon" src={e.pal.icon} alt="" loading="lazy" />
            <div className="pmc__name">
              {e.pal.name}
              {e.ordinal > 0 && <span className="pmc__ord">#{e.ordinal}</span>}
            </div>
            <div className="pmc__lv">
              Lv {e.inst.level}
              {(e.inst.stars ?? 0) > 0 && (
                <span className="pbx__stars">{"★".repeat(e.inst.stars!)}</span>
              )}
            </div>
            <div className="pmc__els">
              {e.pal.elements.map((el) => (
                <span
                  key={el}
                  className="pmc__el"
                  style={{ background: ELEMENT_COLOR[el] }}
                  title={el}
                />
              ))}
            </div>
            <dl className="pmc__stats">
              <div><dt>HP</dt><dd>{s.hp.toLocaleString()}</dd></div>
              <div><dt>ATK</dt><dd>{s.atk.toLocaleString()}</dd></div>
              <div><dt>DEF</dt><dd>{s.def.toLocaleString()}</dd></div>
            </dl>
          </div>
        );
      })}
      {Array.from({ length: Math.max(0, slots) }).map((_, i) => (
        <div key={`empty-${i}`} className="pmc pmc--empty">
          <span>Empty</span>
        </div>
      ))}
    </div>
  );
}

// --- Party info (right) ------------------------------------------------------
function PartyInfo({ members }: { members: OwnedEntry[] }) {
  const pals = members.map((m) => m.pal);
  const totals = members.reduce(
    (acc, e) => {
      const s = stats(e);
      acc.hp += s.hp;
      acc.atk += s.atk;
      acc.def += s.def;
      return acc;
    },
    { hp: 0, atk: 0, def: 0 },
  );
  const s = partySummary(pals);
  const matchup = partyMatchup(pals);
  const missing = ELEMENTS.filter((e) => !s.elements.includes(e));
  const topThreat = matchup.weakTo[0] ?? null;
  const counter =
    topThreat && members.length < PARTY_LIMIT
      ? bestCounter(
          topThreat.element,
          matchup.cantCounter,
          new Set(pals.map((p) => p.name)),
        )
      : null;

  if (members.length === 0) {
    return (
      <div className="pp__info">
        <p className="empty">
          Add pals from the catalog below to build your party.
        </p>
      </div>
    );
  }

  return (
    <div className="pp__info">
      <div className="pp__totals">
        <Stat label="Party HP" value={totals.hp} />
        <Stat label="Party ATK" value={totals.atk} />
        <Stat label="Party DEF" value={totals.def} />
      </div>

      <h4 className="coverage__minihead">Element coverage</h4>
      <div className="party__elements">
        {ELEMENTS.map((el) => {
          const on = s.elements.includes(el);
          return (
            <span
              key={el}
              className={`chip chip--element ${on ? "" : "party__el-off"}`}
              style={on ? { background: ELEMENT_COLOR[el] } : undefined}
            >
              {el}
            </span>
          );
        })}
      </div>
      {missing.length > 0 && (
        <p className="coverage__note">Missing: {missing.join(", ")}.</p>
      )}

      <h4 className="coverage__minihead">Weak to</h4>
      {matchup.weakTo.length === 0 ? (
        <p className="matchup__ok">No shared elemental weakness.</p>
      ) : (
        <ul className="matchup__weak">
          {matchup.weakTo.map(({ element, count }) => (
            <li key={element}>
              <span
                className="chip chip--element"
                style={{ background: ELEMENT_COLOR[element] }}
              >
                {element}
              </span>
              <span className="matchup__bar">
                <span
                  className="matchup__bar-fill"
                  style={{
                    width: `${(count / members.length) * 100}%`,
                    background: ELEMENT_COLOR[element],
                  }}
                />
              </span>
              <b>
                {count}/{members.length}
              </b>
            </li>
          ))}
        </ul>
      )}

      {counter && (
        <p className="coverage__note">
          Weak to{" "}
          <strong style={{ color: ELEMENT_COLOR[topThreat!.element] }}>
            {topThreat!.element}
          </strong>{" "}
          — a strong counter you could add:{" "}
          <strong>{counter.pal.name}</strong> (Tier {counter.pal.tier}).
        </p>
      )}

      <h4 className="coverage__minihead">Tier spread</h4>
      <div className="party__tiers">
        {TIERS.map((t) => (
          <span key={t} className="party__tier">
            <b style={{ color: TIER_COLOR[t] }}>{t}</b>
            <span>{s.tierCounts[t]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Catalog filter bar (frozen with the party header) ----------------------
function CatalogFilters({
  query,
  setQuery,
  element,
  setElement,
  work,
  setWork,
  tier,
  setTier,
  sort,
  setSort,
  count,
}: {
  query: string;
  setQuery: (v: string) => void;
  element: Element | null;
  setElement: (v: Element | null | ((c: Element | null) => Element | null)) => void;
  work: WorkType | "";
  setWork: (v: WorkType | "") => void;
  tier: string;
  setTier: (v: string) => void;
  sort: SortKey;
  setSort: (v: SortKey) => void;
  count: number;
}) {
  return (
    <div className="filters pp__filters">
      <div className="filter-row">
        <input
          className="search"
          type="search"
          placeholder="Search your pals by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="level">Level</option>
            <option value="name">Name</option>
            <option value="tier">Combat tier</option>
            <option value="hp">HP</option>
            <option value="atk">Attack</option>
            <option value="def">Defense</option>
          </select>
        </label>
        <span className="count">{count} pals</span>
      </div>
    </div>
  );
}

function InstanceCard({
  entry,
  inParty,
  onToggle,
  onInfo,
}: {
  entry: OwnedEntry;
  inParty: boolean;
  onToggle: () => void;
  onInfo: () => void;
}) {
  const s = stats(entry);
  return (
    <article
      className={`icard ${inParty ? "is-in" : ""}`}
      role="button"
      tabIndex={0}
      title={inParty ? "Remove from party" : "Add to party"}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="icard__head">
        <span
          className="icard__tier"
          style={{ background: TIER_COLOR[entry.pal.tier] }}
        >
          {entry.pal.tier}
        </span>
        <span className="icard__headright">
          {inParty && <span className="icard__badge">✓</span>}
          <button
            className="icard__info"
            aria-label={`Details for ${entry.pal.name}`}
            title="Details"
            onClick={(e) => {
              e.stopPropagation();
              onInfo();
            }}
          >
            i
          </button>
        </span>
      </div>
      <img className="icard__icon" src={entry.pal.icon} alt="" loading="lazy" />
      <h3 className="icard__name">
        {entry.pal.name}
        {entry.ordinal > 0 && <span className="icard__ord">#{entry.ordinal}</span>}
      </h3>
      <div className="icard__lv">
        Lv {entry.inst.level}
        {(entry.inst.stars ?? 0) > 0 && (
          <span className="pbx__stars" title={`${entry.inst.stars}★ condenser`}>
            {"★".repeat(entry.inst.stars!)}
          </span>
        )}
      </div>
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
    </article>
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
