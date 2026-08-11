import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Keyed by owned-pal instance id (v2). Migration from v1 (species-keyed)
// happens in lib/migrate.ts at startup.
const STORAGE_KEY = "pwc.loadouts.v2";

/** Max active abilities a pal can have equipped at once (Palworld limit). */
export const EQUIP_LIMIT = 3;

export interface Loadout {
  /** Skill ids the player has taught this pal. */
  learned: string[];
  /** Skill ids currently equipped (subset of learned, up to EQUIP_LIMIT). */
  equipped: string[];
}

type Store = Record<string, Loadout>;

const EMPTY: Loadout = { learned: [], equipped: [] };

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

interface LoadoutsApi {
  getLoadout: (instanceId: string) => Loadout;
  toggleLearned: (instanceId: string, skillId: string) => void;
  toggleEquipped: (instanceId: string, skillId: string) => void;
}

const LoadoutsContext = createContext<LoadoutsApi | null>(null);

/** Per-instance active-ability loadouts (learned + equipped), persisted locally. */
export function LoadoutProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  const patch = useCallback(
    (instanceId: string, fn: (l: Loadout) => Loadout) => {
      setStore((prev) => {
        const next = fn(prev[instanceId] ?? EMPTY);
        // Drop empty loadouts so the store stays tidy.
        if (next.learned.length === 0 && next.equipped.length === 0) {
          if (!prev[instanceId]) return prev;
          const copy = { ...prev };
          delete copy[instanceId];
          return copy;
        }
        return { ...prev, [instanceId]: next };
      });
    },
    [],
  );

  const toggleLearned = useCallback(
    (instanceId: string, skillId: string) =>
      patch(instanceId, (l) => {
        if (l.learned.includes(skillId)) {
          // Unlearning also unequips.
          return {
            learned: l.learned.filter((id) => id !== skillId),
            equipped: l.equipped.filter((id) => id !== skillId),
          };
        }
        return { ...l, learned: [...l.learned, skillId] };
      }),
    [patch],
  );

  const toggleEquipped = useCallback(
    (instanceId: string, skillId: string) =>
      patch(instanceId, (l) => {
        if (l.equipped.includes(skillId)) {
          return { ...l, equipped: l.equipped.filter((id) => id !== skillId) };
        }
        if (!l.learned.includes(skillId) || l.equipped.length >= EQUIP_LIMIT) return l;
        return { ...l, equipped: [...l.equipped, skillId] };
      }),
    [patch],
  );

  const value = useMemo<LoadoutsApi>(
    () => ({
      getLoadout: (instanceId) => store[instanceId] ?? EMPTY,
      toggleLearned,
      toggleEquipped,
    }),
    [store, toggleLearned, toggleEquipped],
  );

  return <LoadoutsContext.Provider value={value}>{children}</LoadoutsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook co-located by design
export function useLoadouts(): LoadoutsApi {
  const ctx = useContext(LoadoutsContext);
  if (!ctx) throw new Error("useLoadouts must be used within a LoadoutProvider");
  return ctx;
}
