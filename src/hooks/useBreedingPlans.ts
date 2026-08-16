import { useCallback, useEffect, useState } from "react";
import type { SourceRef } from "../lib/breedingPath";

const STORAGE_KEY = "pwc.breeding.v1";

export type { SourceRef };

/**
 * A parents-first trait-consolidation plan. Breeding is worked bottom-up as a
 * chain: result0 = sources[0] x sources[1], result1 = result0 x sources[2], …
 * Species are computed from the breeding data; `carry[i]` records which passives
 * the player intends to keep on result i (deterministic trait-pool planning).
 */
export interface BreedPlan {
  id: string;
  name: string;
  /** Optional goal: species code + the passive ids you want on the final pal. */
  target?: { code: string; passives: string[] };
  /**
   * Ordered chain parents, crossed left to right. Each is either an owned
   * instance or an unowned-species placeholder (a to-be-obtained step).
   */
  sources: SourceRef[];
  /** carry[i] = chosen passive ids (≤4) for the result after sources[i+1]. */
  carry: (string[] | null)[];
  createdAt: number;
  updatedAt: number;
}

function newId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

/** Coerce a stored source to a SourceRef, migrating the old bare-id shape. */
function normalizeSource(x: unknown): SourceRef | null {
  if (typeof x === "string") return { kind: "owned", instanceId: x }; // v1 shape
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (o.kind === "owned" && typeof o.instanceId === "string")
      return { kind: "owned", instanceId: o.instanceId };
    if (o.kind === "species" && typeof o.code === "string")
      return { kind: "species", code: o.code };
  }
  return null;
}

/** Coerce a stored value to a valid plan, tolerating older/partial shapes. */
function normalize(p: unknown): BreedPlan | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  const t = o.target as { code?: unknown; passives?: unknown } | undefined;
  const now = Date.now();
  return {
    id: o.id,
    name: typeof o.name === "string" ? o.name : "Plan",
    target:
      t && typeof t.code === "string"
        ? { code: t.code, passives: Array.isArray(t.passives) ? (t.passives as string[]) : [] }
        : undefined,
    sources: Array.isArray(o.sources)
      ? (o.sources as unknown[]).map(normalizeSource).filter((s): s is SourceRef => s !== null)
      : [],
    carry: Array.isArray(o.carry) ? (o.carry as (string[] | null)[]) : [],
    createdAt: typeof o.createdAt === "number" ? o.createdAt : now,
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : now,
  };
}

function load(): BreedPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalize).filter((p): p is BreedPlan => p !== null);
  } catch {
    return [];
  }
}

/** localStorage-backed parents-first breeding plans. */
export function useBreedingPlans() {
  const [plans, setPlans] = useState<BreedPlan[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  const patch = useCallback(
    (id: string, fn: (p: BreedPlan) => BreedPlan) =>
      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p)),
      ),
    [],
  );

  const addPlan = useCallback((name: string) => {
    const now = Date.now();
    const plan: BreedPlan = {
      id: newId(),
      name,
      sources: [],
      carry: [],
      createdAt: now,
      updatedAt: now,
    };
    setPlans((prev) => [...prev, plan]);
    return plan.id;
  }, []);

  const removePlan = useCallback(
    (id: string) => setPlans((prev) => prev.filter((p) => p.id !== id)),
    [],
  );

  const renamePlan = useCallback(
    (id: string, name: string) => patch(id, (p) => ({ ...p, name })),
    [patch],
  );

  const setTarget = useCallback(
    (id: string, target: BreedPlan["target"]) =>
      patch(id, (p) => ({ ...p, target })),
    [patch],
  );

  /** Append a parent (owned instance or unowned species) to the chain. */
  const addSource = useCallback(
    (id: string, source: SourceRef) =>
      patch(id, (p) => ({ ...p, sources: [...p.sources, source] })),
    [patch],
  );

  /** Replace the parent at `index`. */
  const setSource = useCallback(
    (id: string, index: number, source: SourceRef) =>
      patch(id, (p) => ({
        ...p,
        sources: p.sources.map((s, i) => (i === index ? source : s)),
      })),
    [patch],
  );

  /** Replace the whole chain at once (used by the auto-solver). */
  const setChain = useCallback(
    (id: string, sources: SourceRef[], carry: (string[] | null)[] = []) =>
      patch(id, (p) => ({ ...p, sources, carry })),
    [patch],
  );

  /** Remove the parent at `index` (carry overrides shift with it). */
  const removeSource = useCallback(
    (id: string, index: number) =>
      patch(id, (p) => ({
        ...p,
        sources: p.sources.filter((_, i) => i !== index),
        carry: p.carry.filter((_, i) => i !== Math.max(0, index - 1)),
      })),
    [patch],
  );

  /** Override which passives carry onto result `resultIndex` (0-based). */
  const setCarry = useCallback(
    (id: string, resultIndex: number, passives: string[] | null) =>
      patch(id, (p) => {
        const carry = [...p.carry];
        carry[resultIndex] = passives;
        return { ...p, carry };
      }),
    [patch],
  );

  return {
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
  };
}
