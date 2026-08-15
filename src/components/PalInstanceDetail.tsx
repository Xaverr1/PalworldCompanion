import { useEffect, useState } from "react";
import { WORK_TYPES, type Pal } from "../data/pals";
import { SKILL_BY_ID } from "../data/skills";
import { PASSIVE_BY_ID } from "../data/passives";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { WORK_ICON } from "../lib/work";
import { scaledStats } from "../lib/stats";
import { condenserStatBonus } from "../lib/upgrades";
import { MAX_STARS, useOwned, type OwnedPal } from "../hooks/useOwned";
import { useLoadouts } from "../hooks/useLoadouts";
import { AbilitiesEditor } from "./AbilitiesEditor";
import { PassivesEditor } from "./PassivesEditor";
import { Habitat } from "./PalDetail";

/** Passive tier colour, mirrored from PassivesEditor. */
function passiveColor(rank: number): string {
  if (rank < 0) return "#e0533a"; // negative
  if (rank >= 4) return "#14b8a6"; // top tier — teal
  if (rank >= 3) return "#f0b429"; // 2nd tier — gold
  return "#9ca3af"; // 3rd tier — gray
}

/** Rich single-pal detail card: one owned instance + its species reference. */
export function PalInstanceDetail({
  instance,
  pal,
  ordinal,
  onClose,
}: {
  instance: OwnedPal;
  pal: Pal;
  ordinal: number;
  onClose: () => void;
}) {
  const { setStars, setNickname, setGender, removeInstance, isWished, toggleWish } =
    useOwned();
  const { getLoadout } = useLoadouts();
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [passivesOpen, setPassivesOpen] = useState(false);

  const stars = instance.stars ?? 0;
  const s = scaledStats(pal, instance.level, {
    ...(instance.ivs ? { talents: instance.ivs } : {}),
    condenser: condenserStatBonus(stars),
  });
  const isMount = pal.partnerSkill.tags.includes("mount");
  const wished = isWished(pal.name);

  const loadout = getLoadout(instance.id);
  const equipped = loadout.equipped
    .map((id) => SKILL_BY_ID.get(id))
    .filter((sk): sk is NonNullable<typeof sk> => sk !== undefined);
  const passives = loadout.passives
    .map((id) => PASSIVE_BY_ID.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

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
        aria-label={instance.nickname || pal.name}
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
            <span className="pid__lv">Lv {instance.level}</span>
            <img src={pal.icon} alt="" />
            <div
              className="pid__stars"
              role="group"
              aria-label={`Condenser: ${stars} of ${MAX_STARS} stars`}
            >
              {Array.from({ length: MAX_STARS }).map((_, i) => {
                const n = i + 1;
                return (
                  <button
                    key={n}
                    className={`pid__star ${n <= stars ? "is-on" : ""}`}
                    title={`${stars}★ condenser — click to set`}
                    onClick={() => setStars(instance.id, stars === n ? n - 1 : n)}
                  >
                    {n <= stars ? "★" : "☆"}
                  </button>
                );
              })}
            </div>
            {isMount && <span className="pid__mount">Mount</span>}
          </div>

          <div className="pid__id">
            <div className="pid__dexrow">
              <span className="check-toggle is-on" title="In your Palbox" aria-hidden>
                ✓
              </span>
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
                {ordinal > 0 && <span className="pid__ord"> #{ordinal}</span>}
              </span>
              <span className="pid__genders" role="group" aria-label="Gender">
                {(["Male", "Female"] as const).map((g) => (
                  <button
                    key={g}
                    className={`pid__gender ${instance.gender === g ? "is-on" : ""} ${
                      g === "Male" ? "is-male" : "is-female"
                    }`}
                    title={g}
                    onClick={() => setGender(instance.id, instance.gender === g ? "" : g)}
                  >
                    {g === "Male" ? "♂" : "♀"}
                  </button>
                ))}
              </span>
            </div>

            <input
              className="pid__name"
              value={instance.nickname ?? ""}
              placeholder={pal.name}
              aria-label="Nickname"
              onChange={(e) => setNickname(instance.id, e.target.value)}
            />
            {instance.nickname && <div className="pid__species">{pal.name}</div>}

            <div className="pid__elements">
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

            <dl className="pid__stats">
              <div><dt>HP</dt><dd>{s.hp.toLocaleString()}</dd></div>
              <div><dt>Attack</dt><dd>{s.atk.toLocaleString()}</dd></div>
              <div><dt>Defense</dt><dd>{s.def.toLocaleString()}</dd></div>
              <div><dt>Food</dt><dd>{pal.food}</dd></div>
            </dl>
            {instance.ivs && (
              <div className="pid__ivs">
                IVs · HP {instance.ivs.hp} / Shot {instance.ivs.shot} / Def{" "}
                {instance.ivs.defense}
              </div>
            )}
          </div>
        </header>

        {/* Partner skill — wide, single row */}
        <section className="pid__partner">
          <span className="pid__partnerlabel">
            Partner Skill · <span className="detail__skill">{pal.partnerSkill.name}</span>
          </span>
          <span className="pid__partnerdesc">{pal.partnerSkill.desc}</span>
        </section>

        {/* Active skills — equipped shown, collapsible editor */}
        <section className="pid__skills">
          <button
            className="collapse-head"
            aria-expanded={skillsOpen}
            onClick={() => setSkillsOpen((o) => !o)}
          >
            {skillsOpen ? "▾" : "▸"} Skills
            {!skillsOpen && (
              <span className="pid__skillchips">
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
            )}
          </button>
          {skillsOpen && (
            <AbilitiesEditor instanceId={instance.id} showHeading={false} addCollapsed />
          )}
        </section>

        {/* Passive skills — same format as active, tier-coloured */}
        <section className="pid__skills">
          <button
            className="collapse-head"
            aria-expanded={passivesOpen}
            onClick={() => setPassivesOpen((o) => !o)}
          >
            {passivesOpen ? "▾" : "▸"} Passives
            {!passivesOpen && (
              <span className="pid__skillchips">
                {passives.length === 0 ? (
                  <span className="party__abil-empty">none set</span>
                ) : (
                  passives.map((p) => (
                    <span
                      key={p.id}
                      className="abil-chip"
                      style={{ borderColor: passiveColor(p.rank) }}
                      title={p.description}
                    >
                      <i style={{ background: passiveColor(p.rank) }} />
                      {p.name}
                    </span>
                  ))
                )}
              </span>
            )}
          </button>
          {passivesOpen && (
            <PassivesEditor instanceId={instance.id} showHeading={false} addCollapsed />
          )}
        </section>

        {/* Work suitability (slim) */}
        <section>
          <h3 className="detail__sub">Work Suitability</h3>
          <WorkPillsSlim pal={pal} />
        </section>

        {/* Where to find (collapsible) */}
        <Habitat pal={pal} collapsible />

        <div className="pid__foot">
          <button
            className="btn btn--danger"
            onClick={() => {
              removeInstance(instance.id);
              onClose();
            }}
          >
            Remove from Palbox
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compact work-suitability pills (less padding than the Browse card). */
function WorkPillsSlim({ pal }: { pal: Pal }) {
  const works = WORK_TYPES.map((w) => [w, pal.works[w] ?? 0] as const)
    .filter(([, lvl]) => lvl > 0)
    .sort((a, b) => b[1] - a[1]);
  if (works.length === 0)
    return <p className="coverage__note">No work suitability.</p>;
  return (
    <ul className="workpills workpills--slim">
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
