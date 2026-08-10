import { useEffect, useMemo, useState } from "react";
import { PALS } from "../data/pals";
import { ELEMENT_COLOR } from "../lib/elements";
import { SET_LIMIT, type PalSet } from "../lib/sets";
import { useOwned } from "../hooks/useOwned";

export function PalPicker({
  set,
  onAdd,
  onRemove,
  onClose,
}: {
  set: PalSet;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
}) {
  const { isOwned } = useOwned();
  const [query, setQuery] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const members = new Set(set.members);
  const full = set.members.length >= SET_LIMIT[set.kind];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PALS.filter(
      (p) =>
        (!ownedOnly || isOwned(p.name)) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          (p.paldex ?? "").toLowerCase().includes(q)),
    ).slice(0, 120);
  }, [query, ownedOnly, isOwned]);

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
        <h3 className="detail__sub">
          Add pals · {set.members.length}/{SET_LIMIT[set.kind]}
        </h3>
        <input
          className="search"
          type="search"
          autoFocus
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="picker__ownedonly">
          <input
            type="checkbox"
            checked={ownedOnly}
            onChange={(e) => setOwnedOnly(e.target.checked)}
          />
          Obtained only
        </label>

        <ul className="picker__list">
          {results.map((p) => {
            const inSet = members.has(p.name);
            const disabled = !inSet && full;
            return (
              <li key={p.name}>
                <button
                  className={`picker__row ${inSet ? "picker__row--on" : ""}`}
                  disabled={disabled}
                  onClick={() => (inSet ? onRemove(p.name) : onAdd(p.name))}
                >
                  <img src={p.icon} alt="" loading="lazy" />
                  <span className="picker__name">
                    {isOwned(p.name) && <span className="picker__owned" title="Obtained">★</span>}
                    {p.name}
                  </span>
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
                  <span className="picker__act">{inSet ? "✓ Added" : disabled ? "Full" : "+ Add"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
