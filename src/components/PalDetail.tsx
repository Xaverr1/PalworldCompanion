import { useEffect } from "react";
import { WORK_TYPES, type Pal } from "../data/pals";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { useOwned } from "../hooks/useOwned";
import { AbilitiesEditor } from "./AbilitiesEditor";

export function PalDetail({ pal, onClose }: { pal: Pal; onClose: () => void }) {
  const { isOwned, toggle } = useOwned();
  const owned = isOwned(pal.name);
  // Close on Escape.
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
        aria-label={pal.name}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <header className="detail__head">
          <img className="detail__icon" src={pal.icon} alt="" />
          <div>
            <span className="detail__dex">
              {pal.paldex ? `#${pal.paldex}` : "Terraria Collab"}
            </span>
            <h2 className="detail__name">{pal.name}</h2>
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
            <button
              className={`own-btn ${owned ? "is-on" : ""}`}
              aria-pressed={owned}
              onClick={() => toggle(pal.name)}
            >
              {owned ? "★ Obtained" : "☆ Mark obtained"}
            </button>
          </div>
        </header>

        <section className="detail__stats">
          <Stat label="HP" value={pal.hp} />
          <Stat label="Attack" value={pal.atk} />
          <Stat label="Defense" value={pal.def} />
          <Stat label="Food" value={pal.food} />
        </section>

        <section>
          <h3 className="detail__sub">Work Suitability</h3>
          <ul className="worklist">
            {WORK_TYPES.map((w) => {
              const lvl = pal.works[w] ?? 0;
              return (
                <li key={w} className={lvl ? "" : "worklist__off"}>
                  <span>{w}</span>
                  <span className="worklist__bar">
                    <span
                      className="worklist__fill"
                      style={{ width: `${(lvl / 10) * 100}%` }}
                    />
                  </span>
                  <b>{lvl || "—"}</b>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="detail__sub">
            Partner Skill · <span className="detail__skill">{pal.partnerSkill.name}</span>
          </h3>
          <p className="detail__desc">{pal.partnerSkill.desc}</p>
          <div className="detail__tags">
            {pal.partnerSkill.tags.map((t) => (
              <span key={t} className="chip chip--tag">
                {t}
              </span>
            ))}
          </div>
        </section>

        {pal.ranch && pal.ranch.length > 0 && (
          <section>
            <h3 className="detail__sub">Ranch Produce</h3>
            <div className="ranch">
              {pal.ranch.map((item) => (
                <span key={item.slug} className="ranch__item">
                  <img src={item.icon} alt="" />
                  {item.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {owned ? (
          <AbilitiesEditor palName={pal.name} />
        ) : (
          <section>
            <h3 className="detail__sub">Active Abilities</h3>
            <p className="coverage__note">
              Mark this pal as obtained to record its learned and equipped abilities.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="detail__stat">
      <span className="detail__stat-label">{label}</span>
      <span className="detail__stat-value">{value}</span>
    </div>
  );
}
