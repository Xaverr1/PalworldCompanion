import { useMemo, useState } from "react";
import {
  PALS,
  ELEMENTS,
  WORK_TYPES,
  TIERS,
  type Element,
  type Pal,
  type WorkType,
} from "../data/pals";
import { ELEMENT_COLOR } from "../lib/elements";
import { useOwned } from "../hooks/useOwned";
import { PalCard } from "./PalCard";
import { PalPreview } from "./PalPreview";

type SortKey = "paldex" | "name" | "hp" | "atk" | "def" | "tier";

const TIER_RANK: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, F: 4 };

export function Browser() {
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<Element | null>(null);
  const [work, setWork] = useState<WorkType | "">("");
  const [tier, setTier] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("paldex");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [selected, setSelected] = useState<Pal | null>(null);
  const { isOwned, count } = useOwned();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = PALS.filter((p) => {
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.paldex ?? "").toLowerCase().includes(q)
      )
        return false;
      if (element && !p.elements.includes(element)) return false;
      if (work && !(work in p.works)) return false;
      if (tier && p.tier !== tier) return false;
      if (ownedOnly && !isOwned(p.name)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "hp":
          return b.hp - a.hp;
        case "atk":
          return b.atk - a.atk;
        case "def":
          return b.def - a.def;
        case "tier":
          return TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.combatPctl - a.combatPctl;
        case "paldex":
        default: {
          const na = a.paldex ? parseInt(a.paldex, 10) : Infinity;
          const nb = b.paldex ? parseInt(b.paldex, 10) : Infinity;
          return na - nb || (a.paldex ?? a.name).localeCompare(b.paldex ?? b.name);
        }
      }
    });
  }, [query, element, work, tier, sort, ownedOnly, isOwned]);

  return (
    <>
      <div className="filters">
        <div className="filter-row">
          <input
            className="search"
            type="search"
            placeholder="Search by name or paldex #…"
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
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tier
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">Any</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="paldex">Paldex #</option>
              <option value="name">Name</option>
              <option value="tier">Combat tier</option>
              <option value="hp">HP</option>
              <option value="atk">Attack</option>
              <option value="def">Defense</option>
            </select>
          </label>
          <label className="checkfilter">
            <input
              type="checkbox"
              checked={ownedOnly}
              onChange={(e) => setOwnedOnly(e.target.checked)}
            />
            Obtained only
          </label>
          <span className="count">
            {results.length} pals · {count} obtained
          </span>
        </div>
      </div>

      <main className="grid">
        {results.map((pal) => (
          <PalCard
            key={`${pal.paldex}-${pal.name}`}
            pal={pal}
            onSelect={() => setSelected(pal)}
          />
        ))}
        {results.length === 0 && <p className="empty">No pals match those filters.</p>}
      </main>

      {selected && <PalPreview pal={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
