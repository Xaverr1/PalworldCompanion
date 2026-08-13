import { useEffect, useState } from "react";
import { WORK_TYPES, type Pal } from "../data/pals";
import { SKILL_BY_ID } from "../data/skills";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { MAX_LEVEL, useOwned, type OwnedPal, type OwnedIVs } from "../hooks/useOwned";
import { useLoadouts } from "../hooks/useLoadouts";
import { WORK_ICON } from "../lib/work";
import { scaledStats } from "../lib/stats";
import { AbilitiesEditor } from "./AbilitiesEditor";
import { PassivesEditor } from "./PassivesEditor";

export function PalDetail({ pal, onClose }: { pal: Pal; onClose: () => void }) {
  const {
    isOwned,
    instancesOf,
    addInstance,
    removeInstance,
    setLevel,
    isWished,
    toggleWish,
  } = useOwned();
  const owned = isOwned(pal.name);
  const instances = instancesOf(pal.name);
  const wished = isWished(pal.name);
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
            <div className="detail__flags">
              <button
                className={`own-btn ${owned ? "is-on" : ""}`}
                onClick={() => addInstance(pal.name)}
              >
                {owned ? `✓ Obtained (${instances.length})` : "+ Add to obtained"}
              </button>
              <button
                className={`wish-btn ${wished ? "is-on" : ""}`}
                aria-pressed={wished}
                onClick={() => toggleWish(pal.name)}
              >
                {wished ? "★ Wishlisted" : "☆ Wishlist"}
              </button>
            </div>
          </div>
        </header>

        {instances.length > 0 && (
          <section>
            <h3 className="detail__sub">
              Your Pals · {instances.length}
              <button className="own-add" onClick={() => addInstance(pal.name)}>
                + Add another
              </button>
            </h3>
            <ul className="owninst">
              {instances.map((inst, i) => (
                <InstanceEditor
                  key={inst.id}
                  pal={pal}
                  instance={inst}
                  index={i}
                  onLevel={(lvl) => setLevel(inst.id, lvl)}
                  onRemove={() => removeInstance(inst.id)}
                />
              ))}
            </ul>
          </section>
        )}

        {instances.length === 0 && <BrowseStats pal={pal} />}

        <section>
          <h3 className="detail__sub">Work Suitability</h3>
          <WorkPills pal={pal} />
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

        {!owned && (
          <section>
            <h3 className="detail__sub">Active Abilities</h3>
            <p className="coverage__note">
              Add this pal to obtained to record each one's level and abilities.
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
      <span className="detail__stat-value">{value.toLocaleString()}</span>
    </div>
  );
}

/** Only the work types a pal can do, highest level first, as compact badges. */
function WorkPills({ pal }: { pal: Pal }) {
  const works = WORK_TYPES.map((w) => [w, pal.works[w] ?? 0] as const)
    .filter(([, lvl]) => lvl > 0)
    .sort((a, b) => b[1] - a[1]);

  if (works.length === 0) {
    return <p className="coverage__note">No work suitability.</p>;
  }
  return (
    <ul className="workpills">
      {works.map(([w, lvl]) => (
        <li key={w} className="workpill" title={`${w} · Lv ${lvl}`}>
          <img className="workpill__icon" src={WORK_ICON[w]} alt="" />
          <span className="workpill__name">{w}</span>
          <span className="workpill__lvl">{lvl}</span>
        </li>
      ))}
    </ul>
  );
}

/** HP/Attack/Defense scaled to `level`, plus the pal's fixed Food value. */
function StatBlock({ pal, level, ivs }: { pal: Pal; level: number; ivs?: OwnedIVs }) {
  const s = scaledStats(pal, level, ivs ? { talents: ivs } : undefined);
  return (
    <div className="detail__stats">
      <Stat label="HP" value={s.hp} />
      <Stat label="Attack" value={s.atk} />
      <Stat label="Defense" value={s.def} />
      <Stat label="Food" value={pal.food} />
    </div>
  );
}

/** Stats for a pal you don't own yet: pick a level to compare against. */
function BrowseStats({ pal }: { pal: Pal }) {
  const [level, setLevel] = useState(Math.min(50, MAX_LEVEL));
  return (
    <section>
      <h3 className="detail__sub detail__sub--row">
        <span>Stats</span>
        <label className="stats__lvl">
          Lv
          <input
            type="number"
            min={1}
            max={MAX_LEVEL}
            value={level}
            onChange={(e) =>
              setLevel(
                Math.min(MAX_LEVEL, Math.max(1, Math.round(Number(e.target.value)))),
              )
            }
          />
        </label>
      </h3>
      <StatBlock pal={pal} level={level} />
      <p className="stats__note">Baseline — 0 IV, no souls or condensing.</p>
    </section>
  );
}

/** One owned instance: level controls + its own collapsible abilities editor. */
function InstanceEditor({
  pal,
  instance,
  index,
  onLevel,
  onRemove,
}: {
  pal: Pal;
  instance: OwnedPal;
  index: number;
  onLevel: (level: number) => void;
  onRemove: () => void;
}) {
  const { getLoadout } = useLoadouts();
  const [open, setOpen] = useState(false);
  const equipped = getLoadout(instance.id)
    .equipped.map((id) => SKILL_BY_ID.get(id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  return (
    <li className="owninst-card">
      <div className="owninst__row">
        <span className="owninst__idx">#{index + 1}</span>
        <label className="owninst__lvl">
          Lv
          <input
            type="number"
            min={1}
            max={MAX_LEVEL}
            value={instance.level}
            onChange={(e) => onLevel(Number(e.target.value))}
          />
        </label>
        <input
          type="range"
          min={1}
          max={MAX_LEVEL}
          value={instance.level}
          onChange={(e) => onLevel(Number(e.target.value))}
          className="owninst__slider"
          aria-label={`Level of ${pal.name} #${index + 1}`}
        />
        <button
          className="owninst__remove"
          aria-label={`Remove this ${pal.name}`}
          onClick={onRemove}
        >
          ×
        </button>
      </div>

      <StatBlock pal={pal} level={instance.level} ivs={instance.ivs} />

      <button
        className="owninst__abiltoggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{open ? "▾" : "▸"} Abilities</span>
        <span className="owninst__abilchips">
          {equipped.length === 0 ? (
            <span className="party__abil-empty">none equipped</span>
          ) : (
            equipped.map((sk) => (
              <span
                key={sk.id}
                className="abil-chip"
                style={{ borderColor: ELEMENT_COLOR[sk.element] }}
              >
                <i style={{ background: ELEMENT_COLOR[sk.element] }} />
                {sk.name}
              </span>
            ))
          )}
        </span>
      </button>

      {open && (
        <>
          <AbilitiesEditor instanceId={instance.id} />
          <PassivesEditor instanceId={instance.id} />
        </>
      )}
    </li>
  );
}
