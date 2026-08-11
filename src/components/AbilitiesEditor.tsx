import { useMemo, useState } from "react";
import { ELEMENTS, type Element } from "../data/pals";
import { SKILLS, SKILL_BY_ID, type Skill } from "../data/skills";
import { ELEMENT_COLOR } from "../lib/elements";
import { EQUIP_LIMIT, useLoadouts } from "../hooks/useLoadouts";

export function AbilitiesEditor({ instanceId }: { instanceId: string }) {
  const { getLoadout, toggleLearned, toggleEquipped } = useLoadouts();
  const loadout = getLoadout(instanceId);
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<Element | "">("");

  const learnedSet = new Set(loadout.learned);
  const equippedSet = new Set(loadout.equipped);
  const learnedSkills = loadout.learned
    .map((id) => SKILL_BY_ID.get(id))
    .filter((s): s is Skill => s !== undefined)
    .sort((a, b) => b.power - a.power);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !element) return [];
    return SKILLS.filter(
      (s) =>
        !learnedSet.has(s.id) &&
        (!element || s.element === element) &&
        (!q || s.name.toLowerCase().includes(q)),
    ).slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, element, loadout.learned]);

  const atEquipLimit = loadout.equipped.length >= EQUIP_LIMIT;

  return (
    <section className="abilities">
      <h3 className="detail__sub">
        Active Abilities · equipped {loadout.equipped.length}/{EQUIP_LIMIT}
      </h3>

      {learnedSkills.length === 0 ? (
        <p className="coverage__note">
          No abilities learned yet — search below to add the moves this pal has.
        </p>
      ) : (
        <ul className="abil__learned">
          {learnedSkills.map((s) => {
            const equipped = equippedSet.has(s.id);
            const equipDisabled = !equipped && atEquipLimit;
            return (
              <li key={s.id} className={equipped ? "abil__row abil__row--eq" : "abil__row"}>
                <button
                  className={`abil__equip ${equipped ? "is-on" : ""}`}
                  disabled={equipDisabled}
                  title={
                    equipped
                      ? "Equipped — click to unequip"
                      : equipDisabled
                        ? `Max ${EQUIP_LIMIT} equipped`
                        : "Equip"
                  }
                  onClick={() => toggleEquipped(instanceId, s.id)}
                >
                  {equipped ? "★" : "☆"}
                </button>
                <span
                  className="abil__dot"
                  style={{ background: ELEMENT_COLOR[s.element] }}
                  title={s.element}
                />
                <span className="abil__name" title={s.description}>
                  {s.name}
                </span>
                <span className="abil__meta">
                  {s.category} · {s.power}
                </span>
                <button
                  className="abil__remove"
                  aria-label={`Forget ${s.name}`}
                  onClick={() => toggleLearned(instanceId, s.id)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="abil__add">
        <input
          className="search"
          type="search"
          placeholder="Add a learned ability…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={element} onChange={(e) => setElement(e.target.value as Element | "")}>
          <option value="">Any element</option>
          {ELEMENTS.map((el) => (
            <option key={el} value={el}>
              {el}
            </option>
          ))}
        </select>
      </div>

      {matches.length > 0 && (
        <ul className="abil__results">
          {matches.map((s) => (
            <li key={s.id}>
              <button className="abil__add-row" onClick={() => toggleLearned(instanceId, s.id)}>
                <span
                  className="abil__dot"
                  style={{ background: ELEMENT_COLOR[s.element] }}
                  title={s.element}
                />
                <span className="abil__name">{s.name}</span>
                <span className="abil__meta">
                  {s.category} · {s.power}
                </span>
                <span className="abil__plus">+ Learn</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
