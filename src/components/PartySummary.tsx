import { ELEMENTS, TIERS, type Pal } from "../data/pals";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { bestCounter, partySummary, type CounterPick } from "../lib/sets";
import { partyMatchup, WEAK_TO } from "../lib/typechart";
import { useOwned } from "../hooks/useOwned";

export function PartySummary({
  pals,
  onAdd,
  full,
}: {
  pals: Pal[];
  onAdd: (name: string) => void;
  full: boolean;
}) {
  const { owned } = useOwned();
  const s = partySummary(pals);
  const missing = ELEMENTS.filter((e) => !s.elements.includes(e));
  const matchup = partyMatchup(pals);

  const topThreat = matchup.weakTo[0] ?? null;
  const exclude = new Set(pals.map((p) => p.name));
  const patch = topThreat
    ? {
        threat: topThreat.element,
        counters: WEAK_TO[topThreat.element],
        have: bestCounter(topThreat.element, matchup.cantCounter, exclude, owned),
        ideal: bestCounter(topThreat.element, matchup.cantCounter, exclude),
      }
    : null;

  return (
    <div className="coverage">
      <h3 className="detail__sub">Party Combat</h3>

      <div className="detail__stats">
        <Stat label="Total HP" value={s.totalHp} />
        <Stat label="Total ATK" value={s.totalAtk} />
        <Stat label="Total DEF" value={s.totalDef} />
      </div>

      <h4 className="coverage__minihead">Element coverage</h4>
      <div className="party__elements">
        {ELEMENTS.map((el) => {
          const on = s.elements.includes(el);
          return (
            <span
              key={el}
              className={`chip chip--element ${on ? "" : "party__el-off"}`}
              style={on ? { background: ELEMENT_COLOR[el] } : undefined}
            >
              {el}
            </span>
          );
        })}
      </div>
      {missing.length > 0 && pals.length > 0 && (
        <p className="coverage__note">Missing: {missing.join(", ")}.</p>
      )}

      <h4 className="coverage__minihead">Tier spread</h4>
      <div className="party__tiers">
        {TIERS.map((t) => (
          <span key={t} className="party__tier">
            <b style={{ color: TIER_COLOR[t] }}>{t}</b>
            <span>{s.tierCounts[t]}</span>
          </span>
        ))}
      </div>

      {pals.length > 0 && (
        <>
          <h4 className="coverage__minihead">Can't counter</h4>
          {matchup.cantCounter.length === 0 ? (
            <p className="matchup__ok">Party can hit every element super-effectively.</p>
          ) : (
            <>
              <div className="party__elements">
                {matchup.cantCounter.map((el) => (
                  <span
                    key={el}
                    className="chip chip--element"
                    style={{ background: ELEMENT_COLOR[el] }}
                  >
                    {el}
                  </span>
                ))}
              </div>
              <p className="coverage__note">
                No pal is strong against these element{matchup.cantCounter.length > 1 ? "s" : ""}.
              </p>
            </>
          )}

          <h4 className="coverage__minihead">Weak to</h4>
          {matchup.weakTo.length === 0 ? (
            <p className="matchup__ok">No shared elemental weakness.</p>
          ) : (
            <ul className="matchup__weak">
              {matchup.weakTo.map(({ element, count }) => (
                <li key={element}>
                  <span
                    className="chip chip--element"
                    style={{ background: ELEMENT_COLOR[element] }}
                  >
                    {element}
                  </span>
                  <span className="matchup__bar">
                    <span
                      className="matchup__bar-fill"
                      style={{
                        width: `${(count / pals.length) * 100}%`,
                        background: ELEMENT_COLOR[element],
                      }}
                    />
                  </span>
                  <b>
                    {count}/{pals.length}
                  </b>
                </li>
              ))}
            </ul>
          )}

          {patch && (
            <div className="suggest">
              <h4 className="coverage__minihead">Patch biggest weakness</h4>
              <p className="coverage__note">
                Weak to <strong style={{ color: ELEMENT_COLOR[patch.threat] }}>{patch.threat}</strong>{" "}
                — counter with a{" "}
                {patch.counters.map((c) => (
                  <strong key={c} style={{ color: ELEMENT_COLOR[c] }}>
                    {c}
                  </strong>
                ))}{" "}
                pal:
              </p>
              {full ? (
                <p className="coverage__note">Party full — remove a pal to add a counter.</p>
              ) : (
                <div className="suggest__fits">
                  <CounterRow label="Have" pick={patch.have} owned onAdd={onAdd} />
                  {patch.ideal && patch.ideal.pal.name !== patch.have?.pal.name && (
                    <CounterRow label="Ideal" pick={patch.ideal} onAdd={onAdd} />
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CounterRow({
  label,
  pick,
  owned,
  onAdd,
}: {
  label: string;
  pick: CounterPick | null;
  owned?: boolean;
  onAdd: (name: string) => void;
}) {
  return (
    <div className="fit fit--counter">
      <span className={`fit__label ${owned ? "fit__label--have" : "fit__label--ideal"}`}>
        {label}
      </span>
      {pick ? (
        <span className="fit__body">
          <button className="suggest__btn" onClick={() => onAdd(pick.pal.name)}>
            <img src={pick.pal.icon} alt="" loading="lazy" />
            {pick.pal.name}
            <b>Tier {pick.pal.tier}</b>
          </button>
          {pick.blindSpotsCovered.length > 0 && (
            <span className="fit__bonus" title="Also fills these offensive blind spots">
              + also covers {pick.blindSpotsCovered.join(", ")}
            </span>
          )}
        </span>
      ) : (
        <span className="fit__none">{owned ? "none obtained" : "—"}</span>
      )}
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
