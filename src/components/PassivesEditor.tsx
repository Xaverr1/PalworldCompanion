import { useMemo, useState } from "react";
import { PASSIVES, PASSIVE_BY_ID, type Passive } from "../data/passives";
import { PASSIVE_LIMIT, useLoadouts } from "../hooks/useLoadouts";

/** Colour a passive by tier: gold for top, green good, red detrimental. */
function rankClass(rank: number): string {
  if (rank < 0) return "pass--bad";
  if (rank >= 4) return "pass--gold";
  if (rank >= 3) return "pass--good";
  return "pass--ok";
}

export function PassivesEditor({ instanceId }: { instanceId: string }) {
  const { getLoadout, togglePassive } = useLoadouts();
  const [query, setQuery] = useState("");
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
      <h3 className="detail__sub">
        Passive Skills · {passiveIds.length}/{PASSIVE_LIMIT}
      </h3>

      {chosen.length === 0 ? (
        <p className="coverage__note">
          No passives set — search below to add up to {PASSIVE_LIMIT}.
        </p>
      ) : (
        <ul className="pass__list">
          {chosen.map((p) => (
            <li key={p.id} className={`pass__row ${rankClass(p.rank)}`}>
              <span className="pass__name" title={p.description}>
                {p.name}
              </span>
              <span className="pass__desc">{p.description}</span>
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

      {!full && (
        <input
          className="search"
          type="search"
          placeholder="Add a passive skill…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {matches.length > 0 && (
        <ul className="abil__results">
          {matches.map((p) => (
            <li key={p.id}>
              <button className="abil__add-row" onClick={() => togglePassive(instanceId, p.id)}>
                <span className={`pass__dot ${rankClass(p.rank)}`} />
                <span className="abil__name" title={p.description}>
                  {p.name}
                </span>
                <span className="abil__meta">{p.description.slice(0, 40)}</span>
                <span className="abil__plus">+ Add</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
