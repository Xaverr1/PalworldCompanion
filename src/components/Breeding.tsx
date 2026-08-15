import { useEffect, useMemo, useState } from "react";
import { PALS } from "../data/pals";
import { PASSIVES, PASSIVE_BY_ID } from "../data/passives";
import { breedChild } from "../lib/breeding";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { useOwned, type OwnedPal } from "../hooks/useOwned";
import { useLoadouts } from "../hooks/useLoadouts";
import { PASSIVE_LIMIT } from "../hooks/useLoadouts";
import { useBreedingPlans, type BreedPlan } from "../hooks/useBreedingPlans";

const PAL_BY_CODE = new Map(PALS.map((p) => [p.code, p]));
const NAME_TO_CODE = new Map(PALS.map((p) => [p.name, p.code]));

/** In-game passive tier colour: teal top, gold 2nd, gray 3rd, red negative. */
function passiveColor(rank: number): string {
  if (rank < 0) return "#e0533a";
  if (rank >= 4) return "#14b8a6";
  if (rank >= 3) return "#f0b429";
  return "#9ca3af";
}
const uniq = (xs: string[]) => [...new Set(xs)];

/** A resolved parent: an owned instance with its species + carried passives. */
interface Source {
  instanceId: string;
  inst: OwnedPal;
  code: string;
  passives: string[];
  gender?: string;
}
/** One cross in the chain: its computed child + the pooled/kept passives. */
interface Step {
  resultIndex: number;
  rightIndex: number;
  childCode: string | null;
  pool: string[];
  carried: string[];
}

export function Breeding() {
  const { instances } = useOwned();
  const { getLoadout } = useLoadouts();
  const {
    plans,
    addPlan,
    removePlan,
    renamePlan,
    setTarget,
    addSource,
    setSource,
    removeSource,
    setCarry,
  } = useBreedingPlans();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picking, setPicking] = useState<
    { kind: "parent"; index: number | "add" } | { kind: "target" } | null
  >(null);

  const active = plans.find((p) => p.id === activeId) ?? plans[0] ?? null;

  const passivesOf = (instanceId: string) =>
    getLoadout(instanceId).passives.filter((id) => PASSIVE_BY_ID.has(id));

  // Resolve the plan's parent chain into species + carried-passive flow.
  const { sources, steps, finalCode, finalCarried } = useMemo(() => {
    if (!active) return { sources: [] as Source[], steps: [] as Step[], finalCode: null, finalCarried: [] as string[] };
    const src: Source[] = [];
    for (const id of active.sources ?? []) {
      const inst = instances.find((i) => i.id === id);
      if (!inst) continue;
      src.push({
        instanceId: id,
        inst,
        code: NAME_TO_CODE.get(inst.species) ?? "",
        passives: passivesOf(id),
        gender: inst.gender,
      });
    }
    const autoCarry = (pool: string[]) =>
      (active.target
        ? pool.filter((p) => active.target!.passives.includes(p))
        : pool
      ).slice(0, PASSIVE_LIMIT);

    const st: Step[] = [];
    for (let i = 1; i < src.length; i++) {
      const leftCode = i === 1 ? src[0].code : st[i - 2].childCode;
      const leftPassives = i === 1 ? src[0].passives : st[i - 2].carried;
      const right = src[i];
      const pool = uniq([...leftPassives, ...right.passives]);
      const override = active.carry[i - 1];
      const carried = override ? override.filter((p) => pool.includes(p)) : autoCarry(pool);
      st.push({
        resultIndex: i - 1,
        rightIndex: i,
        childCode: leftCode && right.code ? breedChild(leftCode, right.code) : null,
        pool,
        carried,
      });
    }
    const last = st[st.length - 1];
    return { sources: src, steps: st, finalCode: last?.childCode ?? null, finalCarried: last?.carried ?? [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, instances, getLoadout]);

  function handleDelete(id: string) {
    removePlan(id);
    if (activeId === id) setActiveId(null);
  }

  const targetMet =
    active?.target &&
    finalCode === active.target.code &&
    active.target.passives.every((p) => finalCarried.includes(p));

  return (
    <div className="breed">
      <div className="breed__bar">
        <div className="breed__tabs">
          {plans.map((p) => (
            <button
              key={p.id}
              className={`breed__tab ${p.id === active?.id ? "is-active" : ""}`}
              onClick={() => setActiveId(p.id)}
            >
              {p.target && (
                <img src={PAL_BY_CODE.get(p.target.code)?.icon} alt="" />
              )}
              <span>{p.name}</span>
            </button>
          ))}
          <button
            className="breed__tab breed__tab--new"
            onClick={() => setActiveId(addPlan(`Plan ${plans.length + 1}`))}
          >
            + Plan
          </button>
        </div>
        {active && (
          <div className="breed__baractions">
            <input
              className="pp__name"
              value={active.name}
              aria-label="Plan name"
              onChange={(e) => renamePlan(active.id, e.target.value)}
            />
            <button className="btn btn--danger" onClick={() => handleDelete(active.id)}>
              Delete
            </button>
          </div>
        )}
      </div>

      {!active ? (
        <p className="empty">
          Create a plan, then build a breeding chain from the pals you own —
          each cross carries passives down toward your goal.
        </p>
      ) : (
        <div className="breed__plan">
          <TargetBanner plan={active} onEdit={() => setPicking({ kind: "target" })} met={!!targetMet} />

          {sources.length === 0 && (
            <p className="coverage__note">
              Add two parents to start the chain. Pick pals from your Palbox —
              their passives come along.
            </p>
          )}

          <div className="breed__chain">
            {sources[0] && (
              <ParentCard
                s={sources[0]}
                target={active.target}
                onChange={() => setPicking({ kind: "parent", index: 0 })}
                onRemove={() => removeSource(active.id, 0)}
              />
            )}
            {steps.map((step) => (
              <div key={step.resultIndex} className="breed__gen">
                <div className="breed__op">+</div>
                <ParentCard
                  s={sources[step.rightIndex]}
                  target={active.target}
                  onChange={() => setPicking({ kind: "parent", index: step.rightIndex })}
                  onRemove={() => removeSource(active.id, step.rightIndex)}
                />
                <div className="breed__op">=</div>
                <ResultCard
                  step={step}
                  target={active.target}
                  isFinal={step.resultIndex === steps.length - 1}
                  onToggle={(pid) => {
                    const next = step.carried.includes(pid)
                      ? step.carried.filter((x) => x !== pid)
                      : step.carried.length < PASSIVE_LIMIT
                        ? [...step.carried, pid]
                        : step.carried;
                    setCarry(active.id, step.resultIndex, next);
                  }}
                />
              </div>
            ))}
          </div>

          <button className="btn breed__add" onClick={() => setPicking({ kind: "parent", index: "add" })}>
            + Add parent
          </button>
        </div>
      )}

      {picking?.kind === "parent" && active && (
        <InstancePicker
          instances={instances}
          passivesOf={passivesOf}
          target={active.target}
          onPick={(instanceId) => {
            if (picking.index === "add") addSource(active.id, instanceId);
            else setSource(active.id, picking.index, instanceId);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}

      {picking?.kind === "target" && active && (
        <TargetEditor
          plan={active}
          onSave={(t) => {
            setTarget(active.id, t);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

// ---- Passive chip ----------------------------------------------------------
function PassiveChip({
  id,
  on = true,
  wanted = false,
  onClick,
}: {
  id: string;
  on?: boolean;
  wanted?: boolean;
  onClick?: () => void;
}) {
  const p = PASSIVE_BY_ID.get(id);
  if (!p) return null;
  const color = passiveColor(p.rank);
  return (
    <button
      type="button"
      className={`pchip ${on ? "is-on" : "is-off"} ${wanted ? "is-wanted" : ""} ${onClick ? "" : "pchip--static"}`}
      style={{ borderColor: color }}
      title={p.description}
      onClick={onClick}
      disabled={!onClick}
    >
      <i style={{ background: color }} />
      {wanted && <span className="pchip__star">★</span>}
      {p.name}
    </button>
  );
}

// ---- Parent (owned source) card --------------------------------------------
function ParentCard({
  s,
  target,
  onChange,
  onRemove,
}: {
  s: Source;
  target?: BreedPlan["target"];
  onChange: () => void;
  onRemove: () => void;
}) {
  const pal = PAL_BY_CODE.get(s.code);
  return (
    <div className="bx-card bx-card--parent">
      {pal && (
        <span className="bnode__tier" style={{ background: TIER_COLOR[pal.tier] }}>
          {pal.tier}
        </span>
      )}
      <img className="bx-card__icon" src={pal?.icon} alt="" loading="lazy" />
      <div className="bx-card__body">
        <div className="bx-card__name">
          {pal?.name ?? s.code}
          {s.gender === "Male" && <span className="pid__gender is-on is-male bx-g">♂</span>}
          {s.gender === "Female" && <span className="pid__gender is-on is-female bx-g">♀</span>}
        </div>
        <div className="pchips">
          {s.passives.length === 0 ? (
            <span className="party__abil-empty">no passives</span>
          ) : (
            s.passives.map((pid) => (
              <PassiveChip key={pid} id={pid} wanted={target?.passives.includes(pid)} />
            ))
          )}
        </div>
      </div>
      <div className="bx-card__actions">
        <button className="btn btn--sm" onClick={onChange}>Change</button>
        <button className="bx-remove" aria-label="Remove parent" onClick={onRemove}>×</button>
      </div>
    </div>
  );
}

// ---- Result (bred child) card ----------------------------------------------
function ResultCard({
  step,
  target,
  isFinal,
  onToggle,
}: {
  step: Step;
  target?: BreedPlan["target"];
  isFinal: boolean;
  onToggle: (passiveId: string) => void;
}) {
  const pal = step.childCode ? PAL_BY_CODE.get(step.childCode) : undefined;
  const speciesMatch = isFinal && target && step.childCode === target.code;
  const missing = isFinal && target ? target.passives.filter((p) => !step.carried.includes(p)) : [];

  return (
    <div className={`bx-card bx-card--result ${isFinal ? "is-final" : ""}`}>
      {pal && (
        <span className="bnode__tier" style={{ background: TIER_COLOR[pal.tier] }}>
          {pal.tier}
        </span>
      )}
      <img className="bx-card__icon" src={pal?.icon} alt="" loading="lazy" />
      <div className="bx-card__body">
        <div className="bx-card__name">
          {pal?.name ?? "—"}
          {pal && (
            <span className="bx-els">
              {pal.elements.map((el) => (
                <i key={el} className="picker__dot" style={{ background: ELEMENT_COLOR[el] }} title={el} />
              ))}
            </span>
          )}
          {isFinal && target && (
            <span className={`bx-match ${speciesMatch ? "is-ok" : "is-no"}`}>
              {speciesMatch ? "✓ target species" : "✗ not target species"}
            </span>
          )}
        </div>
        <div className="bx-pool">
          <span className="bx-pool__label">carry {step.carried.length}/{PASSIVE_LIMIT}:</span>
          {step.pool.length === 0 ? (
            <span className="party__abil-empty">no passives in pool</span>
          ) : (
            step.pool.map((pid) => (
              <PassiveChip
                key={pid}
                id={pid}
                on={step.carried.includes(pid)}
                wanted={target?.passives.includes(pid)}
                onClick={() => onToggle(pid)}
              />
            ))
          )}
        </div>
        {isFinal && target && missing.length > 0 && (
          <div className="bx-missing">
            Missing: {missing.map((p) => PASSIVE_BY_ID.get(p)?.name ?? p).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Target banner ---------------------------------------------------------
function TargetBanner({ plan, onEdit, met }: { plan: BreedPlan; onEdit: () => void; met: boolean }) {
  const t = plan.target;
  const pal = t ? PAL_BY_CODE.get(t.code) : undefined;
  return (
    <div className={`bx-target ${met ? "is-met" : ""}`}>
      {t ? (
        <>
          <span className="bx-target__label">Goal</span>
          <img className="bx-target__icon" src={pal?.icon} alt="" />
          <strong>{pal?.name ?? t.code}</strong>
          <div className="pchips">
            {t.passives.map((pid) => (
              <PassiveChip key={pid} id={pid} />
            ))}
          </div>
          {met && <span className="bx-target__met">✓ reached</span>}
          <button className="btn btn--sm" onClick={onEdit}>Edit goal</button>
        </>
      ) : (
        <button className="btn btn--sm" onClick={onEdit}>+ Set goal (species + traits)</button>
      )}
    </div>
  );
}

// ---- Instance picker (choose an owned pal, passives shown) ------------------
function InstancePicker({
  instances,
  passivesOf,
  target,
  onPick,
  onClose,
}: {
  instances: OwnedPal[];
  passivesOf: (id: string) => string[];
  target?: BreedPlan["target"];
  onPick: (instanceId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const rows = instances
    .map((i) => ({ i, passives: passivesOf(i.id) }))
    .filter(({ i }) => !q || i.species.toLowerCase().includes(q) || (i.nickname ?? "").toLowerCase().includes(q))
    // pals carrying a wanted trait first
    .sort((a, b) => {
      const aw = target ? a.passives.filter((p) => target.passives.includes(p)).length : 0;
      const bw = target ? b.passives.filter((p) => target.passives.includes(p)).length : 0;
      return bw - aw || a.i.species.localeCompare(b.i.species);
    });

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__panel picker" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="detail__sub">Choose a parent from your Palbox</h3>
        {instances.length === 0 && (
          <p className="coverage__note">No owned pals yet — import your save first.</p>
        )}
        <input
          className="search"
          type="search"
          autoFocus
          placeholder="Search your pals…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="picker__list">
          {rows.map(({ i, passives }) => {
            const pal = PAL_BY_CODE.get(NAME_TO_CODE.get(i.species) ?? "");
            return (
              <li key={i.id}>
                <button className="breedpick__row" onClick={() => onPick(i.id)}>
                  <img src={pal?.icon} alt="" loading="lazy" style={{ width: 30, height: 30 }} />
                  <span className="breedpick__name">
                    {i.nickname || i.species}
                    {i.gender === "Male" && <span className="pid__gender is-on is-male bx-g">♂</span>}
                    {i.gender === "Female" && <span className="pid__gender is-on is-female bx-g">♀</span>}
                  </span>
                  <span className="pchips">
                    {passives.map((pid) => (
                      <PassiveChip key={pid} id={pid} wanted={target?.passives.includes(pid)} />
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ---- Target editor (species + up to 4 passives) ----------------------------
function TargetEditor({
  plan,
  onSave,
  onClose,
}: {
  plan: BreedPlan;
  onSave: (t: BreedPlan["target"]) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(plan.target?.code ?? "");
  const [passives, setPassives] = useState<string[]>(plan.target?.passives ?? []);
  const [speciesQ, setSpeciesQ] = useState("");
  const [passiveQ, setPassiveQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sq = speciesQ.trim().toLowerCase();
  const species = sq
    ? PALS.filter((p) => p.name.toLowerCase().includes(sq)).slice(0, 30)
    : [];
  const pq = passiveQ.trim().toLowerCase();
  const passiveMatches = pq
    ? PASSIVES.filter((p) => !passives.includes(p.id) && p.name.toLowerCase().includes(pq)).slice(0, 20)
    : [];

  const chosenPal = PAL_BY_CODE.get(code);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="detail__sub">Breeding goal</h3>

        <label className="bx-field">Target species</label>
        {chosenPal ? (
          <div className="bx-chosen">
            <img src={chosenPal.icon} alt="" />
            <strong>{chosenPal.name}</strong>
            <button className="btn btn--sm" onClick={() => setCode("")}>Change</button>
          </div>
        ) : (
          <>
            <input
              className="search"
              type="search"
              autoFocus
              placeholder="Search species…"
              value={speciesQ}
              onChange={(e) => setSpeciesQ(e.target.value)}
            />
            <ul className="picker__list bx-shortlist">
              {species.map((p) => (
                <li key={p.code}>
                  <button className="picker__row" onClick={() => { setCode(p.code); setSpeciesQ(""); }}>
                    <img src={p.icon} alt="" loading="lazy" />
                    <span className="picker__name">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <label className="bx-field">Desired passives ({passives.length}/{PASSIVE_LIMIT})</label>
        <div className="pchips">
          {passives.map((pid) => (
            <PassiveChip key={pid} id={pid} onClick={() => setPassives(passives.filter((x) => x !== pid))} />
          ))}
          {passives.length === 0 && <span className="party__abil-empty">none yet</span>}
        </div>
        {passives.length < PASSIVE_LIMIT && (
          <input
            className="search"
            type="search"
            placeholder="Add a passive…"
            value={passiveQ}
            onChange={(e) => setPassiveQ(e.target.value)}
          />
        )}
        {passiveMatches.length > 0 && (
          <ul className="abil__results">
            {passiveMatches.map((p) => (
              <li key={p.id}>
                <button
                  className="abil__add-row"
                  onClick={() => { setPassives([...passives, p.id]); setPassiveQ(""); }}
                >
                  <span className="abil__dot" style={{ background: passiveColor(p.rank) }} />
                  <span className="abil__name">{p.name}</span>
                  <span className="abil__plus">+ Add</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="pid__foot">
          <button className="btn" onClick={() => onSave(undefined)}>Clear goal</button>
          <button
            className="btn btn--accent"
            disabled={!code}
            onClick={() => code && onSave({ code, passives })}
          >
            Save goal
          </button>
        </div>
      </div>
    </div>
  );
}
