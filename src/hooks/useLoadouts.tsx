import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "pwc.loadouts.v1";

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
  getLoadout: (palName: string) => Loadout;
  toggleLearned: (palName: string, skillId: string) => void;
  toggleEquipped: (palName: string, skillId: string) => void;
}

const LoadoutsContext = createContext<LoadoutsApi | null>(null);

/** Per-pal active-ability loadouts (learned + equipped), persisted locally. */
export function LoadoutProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  const patch = useCallback(
    (palName: string, fn: (l: Loadout) => Loadout) => {
      setStore((prev) => {
        const next = fn(prev[palName] ?? EMPTY);
        // Drop empty loadouts so the store stays tidy.
        if (next.learned.length === 0 && next.equipped.length === 0) {
          if (!prev[palName]) return prev;
          const copy = { ...prev };
          delete copy[palName];
          return copy;
        }
        return { ...prev, [palName]: next };
      });
    },
    [],
  );

  const toggleLearned = useCallback(
    (palName: string, skillId: string) =>
      patch(palName, (l) => {
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
    (palName: string, skillId: string) =>
      patch(palName, (l) => {
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
      getLoadout: (palName) => store[palName] ?? EMPTY,
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
