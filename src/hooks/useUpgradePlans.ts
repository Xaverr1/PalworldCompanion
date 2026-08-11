import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pwc.upgrades.v1";

export interface UpgradePlan {
  /** Pal Essence Condenser star target (0-4). */
  star: number;
  /** Statue-of-Power soul ranks (0-20) per stat. */
  hp: number;
  atk: number;
  def: number;
  work: number;
}

export const EMPTY_PLAN: UpgradePlan = { star: 0, hp: 0, atk: 0, def: 0, work: 0 };

function isEmpty(p: UpgradePlan): boolean {
  return p.star === 0 && p.hp === 0 && p.atk === 0 && p.def === 0 && p.work === 0;
}

function load(): Record<string, UpgradePlan> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, UpgradePlan>) : {};
  } catch {
    return {};
  }
}

/** Per-pal upgrade targets (condenser + soul ranks), persisted locally. */
export function useUpgradePlans() {
  const [store, setStore] = useState<Record<string, UpgradePlan>>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  const getPlan = useCallback(
    (palName: string): UpgradePlan => store[palName] ?? EMPTY_PLAN,
    [store],
  );

  const setPlan = useCallback((palName: string, patch: Partial<UpgradePlan>) => {
    setStore((prev) => {
      const next = { ...(prev[palName] ?? EMPTY_PLAN), ...patch };
      if (isEmpty(next)) {
        if (!prev[palName]) return prev;
        const copy = { ...prev };
        delete copy[palName];
        return copy;
      }
      return { ...prev, [palName]: next };
    });
  }, []);

  return { getPlan, setPlan };
}
