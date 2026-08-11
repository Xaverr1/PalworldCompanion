import type { Pal, WorkType } from "../data/pals";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { WORK_ICON } from "../lib/work";
import { useOwned } from "../hooks/useOwned";

/** A pal's work suitabilities, highest level first. */
function sortedWorks(pal: Pal): [WorkType, number][] {
  return (Object.entries(pal.works) as [WorkType, number][]).sort(
    (a, b) => b[1] - a[1],
  );
}

export function PalCard({ pal, onSelect }: { pal: Pal; onSelect: () => void }) {
  const { isOwned, toggle, isWished, toggleWish } = useOwned();
  const owned = isOwned(pal.name);
  const wished = isWished(pal.name);

  return (
    <article
      className={`pal-card ${owned ? "is-owned" : ""} ${wished ? "is-wished" : ""}`}
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
            className={`check-toggle ${owned ? "is-on" : ""}`}
            aria-pressed={owned}
            title={owned ? "Obtained — click to unmark" : "Mark as obtained"}
            onClick={(e) => {
              e.stopPropagation();
              toggle(pal.name);
            }}
          >
            {owned ? "✓" : ""}
          </button>
          <button
            className={`wish-toggle ${wished ? "is-on" : ""}`}
            aria-pressed={wished}
            title={wished ? "On wishlist — click to remove" : "Add to wishlist"}
            onClick={(e) => {
              e.stopPropagation();
              toggleWish(pal.name);
            }}
          >
            {wished ? "★" : "☆"}
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
        {sortedWorks(pal).map(([work, lvl]) => (
          <li key={work} className="workicon" title={`${work} · Lv ${lvl}`}>
            <img src={WORK_ICON[work]} alt={work} loading="lazy" />
            <span className="workicon__lvl">{lvl}</span>
          </li>
        ))}
        {sortedWorks(pal).length === 0 && (
          <li className="muted">No work suitability</li>
        )}
      </ul>

      <p className="pal-card__skill" title={pal.partnerSkill.desc}>
        <span className="pal-card__skill-name">{pal.partnerSkill.name}</span>
      </p>
    </article>
  );
}
