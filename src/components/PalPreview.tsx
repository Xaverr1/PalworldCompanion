import { useEffect, useState } from "react";
import type { Pal } from "../data/pals";
import { TIER_COLOR } from "../lib/elements";
import { scaledStats } from "../lib/stats";
import { MAX_LEVEL, useOwned } from "../hooks/useOwned";
import { Habitat } from "./PalDetail";
import { WorkPillsSlim } from "./PalInstanceDetail";
import { ElementBadges } from "./ElementBadges";

/**
 * Browse-tab detail popup: the Palbox card layout, but as a generic species
 * preview — no owned instance. Shows default stats scaled to an adjustable
 * level (slider + entry), with the obtained/wishlist toggles kept for Browse.
 */
export function PalPreview({ pal, onClose }: { pal: Pal; onClose: () => void }) {
  const { isOwned, toggle, countOf, isWished, toggleWish } = useOwned();
  const [level, setLevel] = useState(1);

  const s = scaledStats(pal, level);
  const isMount = pal.partnerSkill.tags.includes("mount");
  const owned = isOwned(pal.name);
  const ownedCount = countOf(pal.name);
  const wished = isWished(pal.name);

  const clampLevel = (v: number) =>
    setLevel(Math.min(MAX_LEVEL, Math.max(1, Math.round(v) || 1)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal__panel pid"
        role="dialog"
        aria-modal="true"
        aria-label={pal.name}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {/* Header: portrait (tier + level + mount) beside identity + stats */}
        <header className="pid__head">
          <div className="pid__portrait">
            <span
              className="pid__tier"
              style={{ background: TIER_COLOR[pal.tier] }}
              title={`Combat tier ${pal.tier} (${pal.combatPctl}th percentile)`}
            >
              {pal.tier}
            </span>
            <span className="pid__lv">Lv {level}</span>
            <img src={pal.icon} alt="" />
            {isMount && <span className="pid__mount">Mount</span>}
          </div>

          <div className="pid__id">
            <div className="pid__dexrow">
              <button
                className={`check-toggle ${owned ? "is-on" : ""}`}
                aria-pressed={owned}
                title={owned ? "Obtained — click to unmark" : "Mark as obtained"}
                onClick={() => toggle(pal.name)}
              >
                {owned ? "✓" : ""}
              </button>
              {ownedCount > 1 && <span className="own-count">×{ownedCount}</span>}
              <button
                className={`wish-toggle ${wished ? "is-on" : ""}`}
                aria-pressed={wished}
                title={wished ? "On wishlist — click to remove" : "Add to wishlist"}
                onClick={() => toggleWish(pal.name)}
              >
                {wished ? "★" : "☆"}
              </button>
              <span className="pid__dex">
                {pal.paldex ? `#${pal.paldex}` : "Collab"}
              </span>
            </div>

            <div className="pid__name pid__name--static">{pal.name}</div>

            <div className="pid__elements">
              <ElementBadges elements={pal.elements} />
            </div>

            <div className="pid__level">
              <label className="owninst__lvl">
                Lv
                <input
                  type="number"
                  min={1}
                  max={MAX_LEVEL}
                  value={level}
                  onChange={(e) => clampLevel(Number(e.target.value))}
                />
              </label>
              <input
                type="range"
                min={1}
                max={MAX_LEVEL}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="owninst__slider"
                aria-label={`Preview level for ${pal.name}`}
              />
            </div>

            <dl className="pid__stats">
              <div><dt>HP</dt><dd>{s.hp.toLocaleString()}</dd></div>
              <div><dt>Attack</dt><dd>{s.atk.toLocaleString()}</dd></div>
              <div><dt>Defense</dt><dd>{s.def.toLocaleString()}</dd></div>
              <div><dt>Food</dt><dd>{pal.food}</dd></div>
            </dl>
          </div>
        </header>

        {/* Partner skill — wide, single row */}
        <section className="pid__partner">
          <span className="pid__partnerlabel">
            Partner Skill · <span className="detail__skill">{pal.partnerSkill.name}</span>
          </span>
          <span className="pid__partnerdesc">{pal.partnerSkill.desc}</span>
        </section>

        {/* Work suitability (slim) */}
        <section>
          <h3 className="detail__sub">Work Suitability</h3>
          <WorkPillsSlim pal={pal} />
        </section>

        {/* Where to find (collapsible) */}
        <Habitat pal={pal} collapsible />
      </div>
    </div>
  );
}
