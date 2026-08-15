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
/** Max passive skills a pal can have (Palworld limit). */
export const PASSIVE_LIMIT = 4;

export interface Loadout {
  /** Skill ids the player has taught this pal. */
  learned: string[];
  /** Skill ids currently equipped (subset of learned, up to EQUIP_LIMIT). */
  equipped: string[];
  /** Passive skill ids on this pal (up to PASSIVE_LIMIT). */
  passives: string[];
}

type Store = Record<string, Loadout>;

/** Normalize a stored loadout so older records without `passives` still work. */
function normalize(l: Partial<Loadout> | undefined): Loadout {
  return {
    learned: l?.learned ?? [],
    equipped: l?.equipped ?? [],
    passives: l?.passives ?? [],
  };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

/** One instance's loadout to seed on import, keyed by owned-instance id. */
export interface LoadoutSeed extends Loadout {
  id: string;
}

interface LoadoutsApi {
  getLoadout: (instanceId: string) => Loadout;
  toggleLearned: (instanceId: string, skillId: string) => void;
  toggleEquipped: (instanceId: string, skillId: string) => void;
  togglePassive: (instanceId: string, passiveId: string) => void;
  /** Replace the whole store (used by save import). */
  importLoadouts: (seeds: LoadoutSeed[]) => void;
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
        const next = fn(normalize(prev[instanceId]));
        // Drop empty loadouts so the store stays tidy.
        if (
          next.learned.length === 0 &&
          next.equipped.length === 0 &&
          next.passives.length === 0
        ) {
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
            ...l,
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

  const togglePassive = useCallback(
    (instanceId: string, passiveId: string) =>
      patch(instanceId, (l) => {
        if (l.passives.includes(passiveId)) {
          return { ...l, passives: l.passives.filter((id) => id !== passiveId) };
        }
        if (l.passives.length >= PASSIVE_LIMIT) return l;
        return { ...l, passives: [...l.passives, passiveId] };
      }),
    [patch],
  );

  const importLoadouts = useCallback((seeds: LoadoutSeed[]) => {
    const next: Store = {};
    for (const s of seeds) {
      if (s.learned.length || s.equipped.length || s.passives.length) {
        next[s.id] = {
          learned: s.learned,
          equipped: s.equipped,
          passives: s.passives,
        };
      }
    }
    setStore(next);
  }, []);

  const value = useMemo<LoadoutsApi>(
    () => ({
      getLoadout: (instanceId) => normalize(store[instanceId]),
      toggleLearned,
      toggleEquipped,
      togglePassive,
      importLoadouts,
    }),
    [store, toggleLearned, toggleEquipped, togglePassive, importLoadouts],
  );

  return <LoadoutsContext.Provider value={value}>{children}</LoadoutsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook co-located by design
export function useLoadouts(): LoadoutsApi {
  const ctx = useContext(LoadoutsContext);
  if (!ctx) throw new Error("useLoadouts must be used within a LoadoutProvider");
  return ctx;
}
