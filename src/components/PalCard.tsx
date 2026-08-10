import type { Pal } from "../data/pals";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { useOwned } from "../hooks/useOwned";

/** Top work suitabilities to surface on the card, highest level first. */
function topWorks(pal: Pal) {
  return Object.entries(pal.works)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
}

export function PalCard({ pal, onSelect }: { pal: Pal; onSelect: () => void }) {
  const { isOwned, toggle } = useOwned();
  const owned = isOwned(pal.name);

  return (
    <article
      className={`pal-card ${owned ? "is-owned" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="pal-card__head">
        <span className="pal-card__dexwrap">
          <button
            className={`own-toggle ${owned ? "is-on" : ""}`}
            aria-pressed={owned}
            title={owned ? "Obtained — click to unmark" : "Mark as obtained"}
            onClick={(e) => {
              e.stopPropagation();
              toggle(pal.name);
            }}
          >
            {owned ? "★" : "☆"}
          </button>
          <span className="pal-card__dex">
            {pal.paldex ? `#${pal.paldex}` : "Collab"}
          </span>
        </span>
        <span
          className="pal-card__tier"
          style={{ background: TIER_COLOR[pal.tier] }}
          title={`Combat tier ${pal.tier} (${pal.combatPctl}th percentile)`}
        >
          {pal.tier}
        </span>
      </div>

      <img className="pal-card__icon" src={pal.icon} alt="" loading="lazy" />
      <h2 className="pal-card__name">{pal.name}</h2>

      <div className="pal-card__elements">
        {pal.elements.map((el) => (
          <span
            key={el}
            className="chip chip--element"
            style={{ background: ELEMENT_COLOR[el] }}
          >
            {el}
          </span>
        ))}
      </div>

      <dl className="pal-card__stats">
        <div>
          <dt>HP</dt>
          <dd>{pal.hp}</dd>
        </div>
        <div>
          <dt>ATK</dt>
          <dd>{pal.atk}</dd>
        </div>
        <div>
          <dt>DEF</dt>
          <dd>{pal.def}</dd>
        </div>
      </dl>

      <ul className="pal-card__works">
        {topWorks(pal).map(([work, lvl]) => (
          <li key={work}>
            <span>{work}</span>
            <b>{lvl}</b>
          </li>
        ))}
        {topWorks(pal).length === 0 && <li className="muted">No work suitability</li>}
      </ul>

      <p className="pal-card__skill" title={pal.partnerSkill.desc}>
        <span className="pal-card__skill-name">{pal.partnerSkill.name}</span>
      </p>
    </article>
  );
}
