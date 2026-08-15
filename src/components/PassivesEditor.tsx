import { useMemo, useState } from "react";
import { PASSIVES, PASSIVE_BY_ID, type Passive } from "../data/passives";
import { PASSIVE_LIMIT, useLoadouts } from "../hooks/useLoadouts";

/** Colour a passive by in-game tier: teal top, gold 2nd, gray 3rd, red bad. */
function rankColor(rank: number): string {
  if (rank < 0) return "#e0533a"; // negative
  if (rank >= 4) return "#14b8a6"; // top tier — teal
  if (rank >= 3) return "#f0b429"; // 2nd tier — gold
  return "#9ca3af"; // 3rd tier — gray
}

export function PassivesEditor({
  instanceId,
  showHeading = true,
  addCollapsed = false,
}: {
  instanceId: string;
  /** Hide the internal heading when the parent already labels the section. */
  showHeading?: boolean;
  /** Hide the search box behind a "+ Add Passive" button until clicked. */
  addCollapsed?: boolean;
}) {
  const { getLoadout, togglePassive } = useLoadouts();
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(!addCollapsed);
  const passiveIds = getLoadout(instanceId).passives;
  const chosen = passiveIds
    .map((id) => PASSIVE_BY_ID.get(id))
    .filter((p): p is Passive => p !== undefined);
  const chosenSet = new Set(passiveIds);
  const full = passiveIds.length >= PASSIVE_LIMIT;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PASSIVES.filter(
      (p) => !chosenSet.has(p.id) && p.name.toLowerCase().includes(q),
    ).slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, passiveIds]);

  return (
    <section className="passives">
      {showHeading && (
        <h3 className="detail__sub">
          Passive Skills · {passiveIds.length}/{PASSIVE_LIMIT}
        </h3>
      )}

      {chosen.length === 0 ? (
        <p className="coverage__note">
          No passives set — add up to {PASSIVE_LIMIT}.
        </p>
      ) : (
        <ul className="abil__learned">
          {chosen.map((p) => (
            <li key={p.id} className="abil__row">
              <span
                className="abil__dot"
                style={{ background: rankColor(p.rank) }}
                title={`Tier ${p.rank}`}
              />
              <span className="abil__name" title={p.description}>
                {p.name}
              </span>
              <span className="abil__meta abil__meta--pass">{p.description}</span>
              <button
                className="abil__remove"
                aria-label={`Remove ${p.name}`}
                onClick={() => togglePassive(instanceId, p.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? null : showAdd ? (
        <input
          className="search"
          type="search"
          autoFocus={addCollapsed}
          placeholder="Add a passive skill…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : (
        <button className="abil__addbtn" onClick={() => setShowAdd(true)}>
          + Add Passive
        </button>
      )}

      {matches.length > 0 && (
        <ul className="abil__results">
          {matches.map((p) => (
            <li key={p.id}>
              <button className="abil__add-row" onClick={() => togglePassive(instanceId, p.id)}>
                <span
                  className="abil__dot"
                  style={{ background: rankColor(p.rank) }}
                  title={`Tier ${p.rank}`}
                />
                <span className="abil__name" title={p.description}>
                  {p.name}
                </span>
                <span className="abil__meta abil__meta--pass">
                  {p.description.slice(0, 48)}
                </span>
                <span className="abil__plus">+ Add</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
