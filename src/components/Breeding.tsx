import { useEffect, useMemo, useState } from "react";
import { PALS } from "../data/pals";
import { PASSIVES, PASSIVE_BY_ID } from "../data/passives";
import { breedChild, isBreedable, parentPairsFor } from "../lib/breeding";
import {
  solveChain,
  obtainHint,
  progressingPartners,
  type ObtainHint,
  type SolveMode,
} from "../lib/breedingPath";
import { ELEMENT_COLOR, TIER_COLOR } from "../lib/elements";
import { useOwned, type OwnedPal } from "../hooks/useOwned";
import { useLoadouts } from "../hooks/useLoadouts";
import { PASSIVE_LIMIT } from "../hooks/useLoadouts";
import { useBreedingPlans, type BreedPlan, type SourceRef } from "../hooks/useBreedingPlans";

const PAL_BY_CODE = new Map(PALS.map((p) => [p.code, p]));
const NAME_TO_CODE = new Map(PALS.map((p) => [p.name, p.code]));
const nameOf = (code: string) => PAL_BY_CODE.get(code)?.name ?? code;

/** In-game passive tier colour: teal top, gold 2nd, gray 3rd, red negative. */
function passiveColor(rank: number): string {
  if (rank < 0) return "#e0533a";
  if (rank >= 4) return "#14b8a6";
  if (rank >= 3) return "#f0b429";
  return "#9ca3af";
}
const uniq = (xs: string[]) => [...new Set(xs)];

/** A resolved parent: an owned instance, or an unowned-species placeholder. */
interface Source {
  inst?: OwnedPal;
  code: string;
  passives: string[];
  gender?: string;
  unowned: boolean;
  /** How to obtain the species — only for unowned placeholders. */
  hint?: ObtainHint;
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
    setChain,
    removeSource,
    setCarry,
  } = useBreedingPlans();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [solveMode, setSolveMode] = useState<SolveMode>("traits");
  // Species whose full parent-pair list is shown in the side panel, if any.
  const [pairsFor, setPairsFor] = useState<string | null>(null);
  const [picking, setPicking] = useState<
    | { kind: "change"; index: number }
    | { kind: "add" }
    | { kind: "target" }
    | null
  >(null);

  const active = plans.find((p) => p.id === activeId) ?? plans[0] ?? null;

  const passivesOf = (instanceId: string) =>
    getLoadout(instanceId).passives.filter((id) => PASSIVE_BY_ID.has(id));

  // Species (codes) the player owns — the free leaves of any solve.
  const ownedSpecies = useMemo(
    () =>
      new Set(
        instances
          .map((i) => NAME_TO_CODE.get(i.species))
          .filter((c): c is string => !!c),
      ),
    [instances],
  );

  // Resolve the plan's parent chain into species + carried-passive flow.
  const { sources, steps, finalCode, finalCarried } = useMemo(() => {
    if (!active) return { sources: [] as Source[], steps: [] as Step[], finalCode: null, finalCarried: [] as string[] };

    // One-level obtain hint for an unowned species, from the current Palbox.
    const hintCache = new Map<string, ObtainHint>();
    const hintFor = (code: string): ObtainHint => {
      const cached = hintCache.get(code);
      if (cached) return cached;
      const h = obtainHint(code, ownedSpecies);
      hintCache.set(code, h);
      return h;
    };

    const src: Source[] = [];
    for (const ref of active.sources) {
      if (ref.kind === "owned") {
        const inst = instances.find((i) => i.id === ref.instanceId);
        if (!inst) continue;
        src.push({
          inst,
          code: NAME_TO_CODE.get(inst.species) ?? "",
          passives: passivesOf(inst.id),
          gender: inst.gender,
          unowned: false,
        });
      } else {
        src.push({ code: ref.code, passives: [], unowned: true, hint: hintFor(ref.code) });
      }
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
  }, [active, instances, getLoadout, ownedSpecies]);

  // The running species the next parent would cross with (for progress hints).
  const currentEndCode = steps.length ? finalCode : sources[0]?.code ?? null;

  /** Best owned instance of a species: most wanted passives, then highest level. */
  function pickInstance(species: string): string | null {
    const name = nameOf(species);
    const owned = instances.filter((i) => i.species === name);
    if (owned.length === 0) return null;
    const want = active?.target?.passives ?? [];
    const scored = owned
      .map((i) => ({ i, w: passivesOf(i.id).filter((p) => want.includes(p)).length }))
      .sort((a, b) => b.w - a.w || b.i.level - a.i.level);
    return scored[0].i.id;
  }

  function handleAutoSolve(mode: SolveMode) {
    if (!active?.target) return;
    setSolveMode(mode);
    const want = active.target.passives;
    // species code -> the wanted traits an owned instance of it can supply.
    const traitMap = new Map<string, Set<string>>();
    for (const i of instances) {
      const code = NAME_TO_CODE.get(i.species);
      if (!code) continue;
      const carried = passivesOf(i.id).filter((p) => want.includes(p));
      if (!carried.length) continue;
      const set = traitMap.get(code) ?? new Set<string>();
      carried.forEach((p) => set.add(p));
      traitMap.set(code, set);
    }
    const steps = solveChain(active.target.code, ownedSpecies, {
      mode,
      wanted: want,
      wantedTraitsOf: (code) => [...(traitMap.get(code) ?? [])],
    });
    const chain = steps.map((s): SourceRef => {
      if (s.owned) {
        const id = pickInstance(s.code);
        if (id) return { kind: "owned", instanceId: id };
      }
      return { kind: "species", code: s.code };
    });
    setChain(active.id, chain, []);
  }

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
          Create a plan, set a goal pal, and let the solver lay out a breeding
          chain from the pals you own — then tweak any step.
        </p>
      ) : (
        <div className="breed__work">
        <div className="breed__plan">
          <TargetBanner
            plan={active}
            onEdit={() => setPicking({ kind: "target" })}
            met={!!targetMet}
            onShowPairs={() => active.target && setPairsFor(active.target.code)}
          />

          {active.target && (
            <div className="breed__solve">
              <span className="breed__solve-label">
                {sources.length === 0 ? "Auto-solve:" : "Re-solve:"}
              </span>
              <div className="seg" role="group" aria-label="Solve mode">
                <button
                  className={`seg__btn ${solveMode === "traits" ? "is-on" : ""}`}
                  onClick={() => handleAutoSolve("traits")}
                  title="Route the goal's traits down the chain first (may be longer)"
                >
                  Prioritize traits
                </button>
                <button
                  className={`seg__btn ${solveMode === "shortest" ? "is-on" : ""}`}
                  onClick={() => handleAutoSolve("shortest")}
                  title="Fewest crosses to the target species (traits secondary)"
                >
                  Shortest path
                </button>
              </div>
              <span className="breed__solve-note">
                {solveMode === "traits"
                  ? "Consolidates your wanted traits, then steers to the species."
                  : "Fewest crosses to the species. Every step stays editable."}
              </span>
            </div>
          )}

          {sources.length === 0 && (
            <p className="coverage__note">
              {active.target
                ? "Auto-solve to lay out a path, or add parents by hand below."
                : "Set a goal to auto-solve, or add two parents to start a chain."}
            </p>
          )}

          <div className="breed__chain">
            {sources[0] && (
              <ParentCard
                s={sources[0]}
                target={active.target}
                onChange={() => setPicking({ kind: "change", index: 0 })}
                onRemove={() => removeSource(active.id, 0)}
                onShowPairs={() => sources[0].code && setPairsFor(sources[0].code)}
              />
            )}
            {steps.map((step) => (
              <div key={step.resultIndex} className="breed__gen">
                <div className="breed__op">+</div>
                <ParentCard
                  s={sources[step.rightIndex]}
                  target={active.target}
                  onChange={() => setPicking({ kind: "change", index: step.rightIndex })}
                  onRemove={() => removeSource(active.id, step.rightIndex)}
                  onShowPairs={() =>
                    sources[step.rightIndex].code && setPairsFor(sources[step.rightIndex].code)
                  }
                />
                <div className="breed__op">=</div>
                <ResultCard
                  step={step}
                  target={active.target}
                  isFinal={step.resultIndex === steps.length - 1}
                  onShowPairs={() => step.childCode && setPairsFor(step.childCode)}
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

          <button className="btn breed__add" onClick={() => setPicking({ kind: "add" })}>
            + Add parent
          </button>
        </div>
        {pairsFor && (
          <PairsPanel
            code={pairsFor}
            ownedSpecies={ownedSpecies}
            onSelect={setPairsFor}
            onClose={() => setPairsFor(null)}
          />
        )}
        </div>
      )}

      {picking?.kind === "change" && active && (
        <ParentPicker
          mode="change"
          currentSpecies={sources[picking.index]?.code ?? ""}
          instances={instances}
          passivesOf={passivesOf}
          target={active.target}
          // What this parent crosses with: the result just before it (or the
          // chain start for the second parent; null when changing the start).
          currentEnd={
            picking.index === 0
              ? null
              : picking.index === 1
                ? sources[0]?.code ?? null
                : steps[picking.index - 2]?.childCode ?? null
          }
          goal={active.target?.code ?? null}
          onPickOwned={(instanceId) => {
            setSource(active.id, picking.index, { kind: "owned", instanceId });
            setPicking(null);
          }}
          onPickSpecies={(code) => {
            setSource(active.id, picking.index, { kind: "species", code });
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}

      {picking?.kind === "add" && active && (
        <ParentPicker
          mode="add"
          instances={instances}
          passivesOf={passivesOf}
          target={active.target}
          currentEnd={currentEndCode}
          goal={active.target?.code ?? null}
          onPickOwned={(instanceId) => {
            addSource(active.id, { kind: "owned", instanceId });
            setPicking(null);
          }}
          onPickSpecies={(code) => {
            addSource(active.id, { kind: "species", code });
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
  const className = `pchip ${on ? "is-on" : "is-off"} ${wanted ? "is-wanted" : ""} ${onClick ? "" : "pchip--static"}`;
  const inner = (
    <>
      <i style={{ background: color }} />
      {wanted && <span className="pchip__star">★</span>}
      {p.name}
    </>
  );
  // Render as a plain span when static so chips can live inside picker rows
  // (which are themselves buttons) without nesting interactive elements.
  if (!onClick) {
    return (
      <span className={className} style={{ borderColor: color }} title={p.description}>
        {inner}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      style={{ borderColor: color }}
      title={p.description}
      onClick={onClick}
    >
      {inner}
    </button>
  );
}

/** Red "how to obtain" line under an unowned placeholder. */
function ObtainHintLine({ hint }: { hint: ObtainHint }) {
  if (hint.kind === "catch")
    return <div className="bx-hint">Not owned — catch in the wild</div>;
  const [a, b] = hint.parents;
  return (
    <div className="bx-hint">
      Not owned — breed {nameOf(a)} + {nameOf(b)}
    </div>
  );
}

// ---- Parent (owned source or unowned placeholder) card ---------------------
function ParentCard({
  s,
  target,
  onChange,
  onRemove,
  onShowPairs,
}: {
  s: Source;
  target?: BreedPlan["target"];
  onChange: () => void;
  onRemove: () => void;
  onShowPairs: () => void;
}) {
  const pal = PAL_BY_CODE.get(s.code);
  return (
    <div className={`bx-card bx-card--parent ${s.unowned ? "bx-card--unowned" : ""}`}>
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
        {s.unowned ? (
          s.hint && <ObtainHintLine hint={s.hint} />
        ) : (
          <div className="pchips">
            {s.passives.length === 0 ? (
              <span className="party__abil-empty">no passives</span>
            ) : (
              s.passives.map((pid) => (
                <PassiveChip key={pid} id={pid} wanted={target?.passives.includes(pid)} />
              ))
            )}
          </div>
        )}
      </div>
      <div className="bx-card__actions">
        <button className="btn btn--sm" onClick={onShowPairs}>All pairs</button>
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
  onShowPairs,
}: {
  step: Step;
  target?: BreedPlan["target"];
  isFinal: boolean;
  onToggle: (passiveId: string) => void;
  onShowPairs: () => void;
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
          {pal && (
            <button className="bx-linkbtn" onClick={onShowPairs}>all pairs</button>
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
function TargetBanner({
  plan,
  onEdit,
  met,
  onShowPairs,
}: {
  plan: BreedPlan;
  onEdit: () => void;
  met: boolean;
  onShowPairs: () => void;
}) {
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
          <button className="btn btn--sm" onClick={onShowPairs}>All pairs</button>
          <button className="btn btn--sm" onClick={onEdit}>Edit goal</button>
        </>
      ) : (
        <button className="btn btn--sm" onClick={onEdit}>+ Set goal (species + traits)</button>
      )}
    </div>
  );
}

// ---- Pairs / partners panel (right-side, independently scrolling) -----------
// Two universal (ownership-independent) reference views for a selected pal:
//  • "parents"  — every A + B pair that breeds INTO it (parentPairsFor).
//  • "partners" — every partner crossed WITH it, and the resulting child.
type PairsMode = "parents" | "partners";

function PairsPanel({
  code,
  ownedSpecies,
  onSelect,
  onClose,
}: {
  code: string;
  ownedSpecies: Set<string>;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<PairsMode>("parents");
  const [query, setQuery] = useState("");
  const pal = PAL_BY_CODE.get(code);
  const q = query.trim().toLowerCase();
  const hit = (c: string) => nameOf(c).toLowerCase().includes(q);

  const parents = useMemo(() => {
    const owns = (c: string) => (ownedSpecies.has(c) ? 1 : 0);
    return [...parentPairsFor(code)].sort((x, y) => {
      return (
        owns(y[0]) + owns(y[1]) - owns(x[0]) - owns(x[1]) ||
        nameOf(x[0]).localeCompare(nameOf(y[0])) ||
        nameOf(x[1]).localeCompare(nameOf(y[1]))
      );
    });
  }, [code, ownedSpecies]);

  const partners = useMemo(() => {
    const rows: { partner: string; child: string }[] = [];
    for (const p of PALS) {
      const child = breedChild(code, p.code);
      if (child) rows.push({ partner: p.code, child });
    }
    // Owned partners first (actionable), then group by resulting child.
    return rows.sort(
      (x, y) =>
        Number(ownedSpecies.has(y.partner)) - Number(ownedSpecies.has(x.partner)) ||
        nameOf(x.child).localeCompare(nameOf(y.child)) ||
        nameOf(x.partner).localeCompare(nameOf(y.partner)),
    );
  }, [code, ownedSpecies]);

  const parentsF = q ? parents.filter(([a, b]) => hit(a) || hit(b)) : parents;
  const partnersF = q ? partners.filter((r) => hit(r.partner) || hit(r.child)) : partners;
  const startable = parentsF.filter(([a, b]) => ownedSpecies.has(a) || ownedSpecies.has(b)).length;
  const ownedPartners = partnersF.filter((r) => ownedSpecies.has(r.partner)).length;

  return (
    <aside className="breed__pairs">
      <div className="breed__pairs-head">
        <div className="breed__pairs-headrow">
          <img src={pal?.icon} alt="" />
          <div className="breed__pairs-title">
            <h3 className="detail__sub">{nameOf(code)}</h3>
            <span className="breed__pairs-sub">
              {mode === "parents"
                ? `${parentsF.length} parent pair${parentsF.length === 1 ? "" : "s"}${
                    startable > 0 ? ` · ${startable} you can start` : ""
                  }`
                : `${partnersF.length} partner${partnersF.length === 1 ? "" : "s"}${
                    ownedPartners > 0 ? ` · ${ownedPartners} you own` : ""
                  }`}
            </span>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="seg breed__pairs-modes" role="group" aria-label="Pairs view">
          <button
            className={`seg__btn ${mode === "parents" ? "is-on" : ""}`}
            onClick={() => setMode("parents")}
          >
            Parent pairs
          </button>
          <button
            className={`seg__btn ${mode === "partners" ? "is-on" : ""}`}
            onClick={() => setMode("partners")}
          >
            Partners → child
          </button>
        </div>
        <input
          className="search breed__pairs-search"
          type="search"
          placeholder={mode === "parents" ? "Filter by parent…" : "Filter by partner or child…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {mode === "parents" ? (
        parentsF.length === 0 ? (
          <p className="coverage__note breed__pairs-empty">
            {q
              ? `No parent pairs match "${query.trim()}".`
              : `No breeding pair produces ${nameOf(code)} — it can only be caught.`}
          </p>
        ) : (
          <ul className="breed__pairs-list">
            {parentsF.map(([a, b], idx) => (
              <li key={idx} className="pair">
                <PairPal code={a} owned={ownedSpecies.has(a)} onSelect={onSelect} />
                <span className="pair__plus">+</span>
                <PairPal code={b} owned={ownedSpecies.has(b)} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        )
      ) : partnersF.length === 0 ? (
        <p className="coverage__note breed__pairs-empty">No partners match "{query.trim()}".</p>
      ) : (
        <ul className="breed__pairs-list">
          {partnersF.map(({ partner, child }, idx) => (
            <li key={idx} className="pair">
              <PairPal code={partner} owned={ownedSpecies.has(partner)} onSelect={onSelect} />
              <span className="pair__arrow">→</span>
              <PairPal code={child} owned={ownedSpecies.has(child)} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/** One pal chip in a pair row — click to explore how to breed it. */
function PairPal({
  code,
  owned,
  onSelect,
}: {
  code: string;
  owned: boolean;
  onSelect: (code: string) => void;
}) {
  const pal = PAL_BY_CODE.get(code);
  return (
    <button
      className={`pair__pal ${owned ? "is-owned" : ""}`}
      title={owned ? "You own this" : "Not owned — click to see how to breed it"}
      onClick={() => onSelect(code)}
    >
      <img src={pal?.icon} alt="" loading="lazy" />
      <span>{pal?.name ?? code}</span>
    </button>
  );
}

/** One owned instance row (icon, name/gender, passives). */
function InstanceRow({
  i,
  passives,
  target,
  onPick,
}: {
  i: OwnedPal;
  passives: string[];
  target?: BreedPlan["target"];
  onPick: () => void;
}) {
  const pal = PAL_BY_CODE.get(NAME_TO_CODE.get(i.species) ?? "");
  return (
    <button className="breedpick__row" onClick={onPick}>
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
  );
}

// ---- Parent picker: add or change a parent --------------------------------
// Two-step owned selection (species → instance) + a "not owned" section. In
// "change" mode it also lets you swap the slot's species entirely — owned pals
// that progress toward the goal, or a different unowned species — so a chain
// step is never locked to a species you don't own.
function ParentPicker({
  mode,
  currentSpecies,
  instances,
  passivesOf,
  target,
  currentEnd,
  goal,
  onPickOwned,
  onPickSpecies,
  onClose,
}: {
  mode: "add" | "change";
  currentSpecies?: string;
  instances: OwnedPal[];
  passivesOf: (id: string) => string[];
  target?: BreedPlan["target"];
  currentEnd: string | null;
  goal: string | null;
  onPickOwned: (instanceId: string) => void;
  onPickSpecies: (code: string) => void;
  onClose: () => void;
}) {
  const [species, setSpecies] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  // "Not owned" starts collapsed so the owned list gets the room.
  const [notOwnedOpen, setNotOwnedOpen] = useState(false);
  // Add mode: reveal all owned species, not just wanted-trait carriers.
  const [ownedAll, setOwnedAll] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const want = target?.passives ?? [];
  const constrained = !showAll && !!currentEnd && !!goal;

  // Instances of the slot's current species (change mode) — quick instance swap.
  const currentInstances = useMemo(() => {
    if (mode !== "change" || !currentSpecies) return [];
    const name = nameOf(currentSpecies);
    return instances
      .filter((i) => i.species === name)
      .map((i) => ({ i, passives: passivesOf(i.id) }))
      .sort((a, b) => {
        const aw = a.passives.filter((p) => want.includes(p)).length;
        const bw = b.passives.filter((p) => want.includes(p)).length;
        return bw - aw || b.i.level - a.i.level;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentSpecies, instances, want.join(","), passivesOf]);

  // Owned-species list. Add mode: species carrying a wanted trait. Change mode:
  // owned species that progress toward the goal (so you can re-path with fewer
  // leaves), nearest-first.
  const ownedSpeciesRows = useMemo(() => {
    const bySpecies = new Map<string, OwnedPal[]>();
    for (const i of instances) {
      const arr = bySpecies.get(i.species) ?? [];
      arr.push(i);
      bySpecies.set(i.species, arr);
    }
    let entries = [...bySpecies.entries()];
    if (mode === "change") {
      entries = entries.filter(([n]) => NAME_TO_CODE.get(n) !== currentSpecies);
      if (constrained) {
        const order = progressingPartners(currentEnd!, goal!);
        const rank = new Map(order.map((c, idx) => [c, idx]));
        entries = entries
          .filter(([n]) => rank.has(NAME_TO_CODE.get(n) ?? ""))
          .sort(
            (a, b) =>
              rank.get(NAME_TO_CODE.get(a[0]) ?? "")! - rank.get(NAME_TO_CODE.get(b[0]) ?? "")!,
          );
      } else {
        entries.sort((a, b) => a[0].localeCompare(b[0]));
      }
    } else {
      // Add mode: default to trait carriers, but "show all owned" reveals every
      // owned species (carriers still sorted first) so paths aren't blocked.
      const carries = (arr: OwnedPal[]) =>
        arr.some((i) => passivesOf(i.id).some((p) => want.includes(p)));
      if (want.length && !ownedAll) {
        entries = entries.filter(([, arr]) => carries(arr));
        entries.sort((a, b) => a[0].localeCompare(b[0]));
      } else {
        entries.sort(
          (a, b) => Number(carries(b[1])) - Number(carries(a[1])) || a[0].localeCompare(b[0]),
        );
      }
    }
    if (q) entries = entries.filter(([n]) => n.toLowerCase().includes(q));
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentSpecies, instances, want.join(","), q, passivesOf, constrained, currentEnd, goal, ownedAll]);

  // Dropdown 2: instances of the chosen species, wanted carriers first.
  const chosenInstances = useMemo(() => {
    if (!species) return [];
    return instances
      .filter((i) => i.species === species)
      .map((i) => ({ i, passives: passivesOf(i.id) }))
      .sort((a, b) => {
        const aw = a.passives.filter((p) => want.includes(p)).length;
        const bw = b.passives.filter((p) => want.includes(p)).length;
        return bw - aw || b.i.level - a.i.level;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species, instances, want.join(","), passivesOf]);

  // "Not owned" section: unowned species that progress toward the goal.
  const notOwnedRows = useMemo(() => {
    const ownedNames = new Set(instances.map((i) => i.species));
    const codes: string[] = constrained
      ? progressingPartners(currentEnd!, goal!)
      : PALS.filter((p) => isBreedable(p.code)).map((p) => p.code);
    const rows = codes
      .map((code) => PAL_BY_CODE.get(code))
      .filter(
        (p): p is NonNullable<typeof p> =>
          !!p && !ownedNames.has(p.name) && p.code !== currentSpecies && p.code !== goal,
      )
      .filter((p) => !q || p.name.toLowerCase().includes(q));
    // progressingPartners is already nearest-first; keep that order, else name.
    return constrained
      ? rows.slice(0, 60)
      : rows.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60);
  }, [instances, constrained, currentEnd, goal, currentSpecies, q]);

  // The child this partner would produce when crossed with the running chain end.
  const childOf = (partnerCode: string): string | null => {
    if (!currentEnd) return null;
    const child = breedChild(currentEnd, partnerCode);
    return child ? nameOf(child) : null;
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__panel picker" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Close">×</button>

        {species ? (
          <>
            <button className="btn btn--sm bx-back" onClick={() => setSpecies(null)}>← Species</button>
            <h3 className="detail__sub">Choose which {species} to use</h3>
            <ul className="picker__list">
              {chosenInstances.map(({ i, passives }) => (
                <li key={i.id}>
                  <InstanceRow i={i} passives={passives} target={target} onPick={() => onPickOwned(i.id)} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h3 className="detail__sub">
              {mode === "change" ? "Change this parent" : "Add a parent"}
            </h3>
            <input
              className="search"
              type="search"
              autoFocus
              placeholder="Search species…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {mode === "change" && currentInstances.length > 0 && (
              <>
                <div className="bx-field">Use another {nameOf(currentSpecies ?? "")}</div>
                <ul className="picker__list">
                  {currentInstances.map(({ i, passives }) => (
                    <li key={i.id}>
                      <InstanceRow i={i} passives={passives} target={target} onPick={() => onPickOwned(i.id)} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="bx-field bx-field--collapse">
              <span>
                {mode === "change"
                  ? "Swap to a species you own"
                  : `From your Palbox${want.length && !ownedAll ? " — carrying a wanted trait" : ""}`}
              </span>
              {mode === "add" && want.length > 0 && (
                <button className="bx-linkbtn" onClick={() => setOwnedAll((v) => !v)}>
                  {ownedAll ? "only trait carriers" : "show all owned"}
                </button>
              )}
            </div>
            {ownedSpeciesRows.length === 0 ? (
              <p className="coverage__note">
                {mode === "change"
                  ? "No other owned species progress toward the goal from here."
                  : want.length && !ownedAll
                    ? "No owned pals carry a wanted trait yet — try “show all owned”."
                    : "No owned pals — import your save first."}
              </p>
            ) : (
              <ul className="picker__list bx-shortlist">
                {ownedSpeciesRows.map(([n, arr]) => {
                  const pal = PAL_BY_CODE.get(NAME_TO_CODE.get(n) ?? "");
                  return (
                    <li key={n}>
                      <button className="breedpick__row" onClick={() => setSpecies(n)}>
                        <img src={pal?.icon} alt="" loading="lazy" style={{ width: 30, height: 30 }} />
                        <span className="breedpick__name">{n}</span>
                        {childOf(NAME_TO_CODE.get(n) ?? "") && (
                          <span className="bx-child">(→ {childOf(NAME_TO_CODE.get(n) ?? "")})</span>
                        )}
                        <span className="bx-count">×{arr.length}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="bx-field bx-field--collapse">
              <button
                className="bx-collapse"
                aria-expanded={notOwnedOpen}
                onClick={() => setNotOwnedOpen((v) => !v)}
              >
                <span className="bx-collapse__caret">{notOwnedOpen ? "▾" : "▸"}</span>
                {mode === "change" ? "Or a different species to breed" : "Not owned yet"}
                <span className="bx-count">{notOwnedRows.length}</span>
              </button>
              {notOwnedOpen && currentEnd && goal && (
                <button className="bx-linkbtn" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "only ones that progress" : "show all species"}
                </button>
              )}
            </div>
            {notOwnedOpen && (
              <ul className="picker__list bx-shortlist">
                {notOwnedRows.map((p) => (
                  <li key={p.code}>
                    <button className="breedpick__row bx-card--unowned" onClick={() => onPickSpecies(p.code)}>
                      <img src={p.icon} alt="" loading="lazy" style={{ width: 30, height: 30 }} />
                      <span className="breedpick__name">{p.name}</span>
                      {childOf(p.code) && <span className="bx-child">(→ {childOf(p.code)})</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
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
