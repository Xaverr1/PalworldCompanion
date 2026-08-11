import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const OWNED_KEY = "pwc.owned.v2";
const OWNED_KEY_V1 = "pwc.owned.v1";
const WISH_KEY = "pwc.wishlist.v1";

/** Palworld 1.0 level cap for pals. */
export const MAX_LEVEL = 80;
export const DEFAULT_LEVEL = 1;

/** One obtained pal instance — a specific pal the player owns. */
export interface OwnedPal {
  id: string;
  species: string;
  level: number;
}

function newId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(1, Math.round(n)));
}

function loadInstances(): OwnedPal[] {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    if (raw) return JSON.parse(raw) as OwnedPal[];
    // Migrate v1 (array of species names) → one instance each.
    const v1 = localStorage.getItem(OWNED_KEY_V1);
    if (v1) {
      return (JSON.parse(v1) as string[]).map((species) => ({
        id: newId(),
        species,
        level: DEFAULT_LEVEL,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

function loadWished(): Set<string> {
  try {
    const raw = localStorage.getItem(WISH_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

interface OwnedApi {
  // Species-level view (derived from instances).
  owned: Set<string>;
  isOwned: (name: string) => boolean;
  count: number;
  totalPals: number;
  toggle: (name: string) => void;
  // Instance-level.
  instances: OwnedPal[];
  instancesOf: (name: string) => OwnedPal[];
  countOf: (name: string) => number;
  addInstance: (name: string, level?: number) => void;
  removeInstance: (id: string) => void;
  setLevel: (id: string, level: number) => void;
  // Wishlist.
  wished: Set<string>;
  isWished: (name: string) => boolean;
  toggleWish: (name: string) => void;
  wishCount: number;
}

const OwnedContext = createContext<OwnedApi | null>(null);

/** Tracks obtained pal instances (with levels) and the wishlist. */
export function OwnedProvider({ children }: { children: ReactNode }) {
  const [instances, setInstances] = useState<OwnedPal[]>(loadInstances);
  const [wished, setWished] = useState<Set<string>>(loadWished);

  useEffect(() => {
    localStorage.setItem(OWNED_KEY, JSON.stringify(instances));
  }, [instances]);
  useEffect(() => {
    localStorage.setItem(WISH_KEY, JSON.stringify([...wished]));
  }, [wished]);

  const owned = useMemo(
    () => new Set(instances.map((i) => i.species)),
    [instances],
  );

  const addInstance = useCallback((name: string, level = DEFAULT_LEVEL) => {
    setInstances((prev) => [
      ...prev,
      { id: newId(), species: name, level: clampLevel(level) },
    ]);
    setWished((prev) => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }, []);

  const removeInstance = useCallback((id: string) => {
    setInstances((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const setLevel = useCallback((id: string, level: number) => {
    setInstances((prev) =>
      prev.map((i) => (i.id === id ? { ...i, level: clampLevel(level) } : i)),
    );
  }, []);

  // Card/quick toggle: add one if none owned, else remove all of the species.
  const toggle = useCallback(
    (name: string) => {
      setInstances((prev) => {
        if (prev.some((i) => i.species === name)) {
          return prev.filter((i) => i.species !== name);
        }
        return [...prev, { id: newId(), species: name, level: DEFAULT_LEVEL }];
      });
      setWished((prev) => {
        if (!prev.has(name)) return prev;
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    },
    [],
  );

  const toggleWish = useCallback((name: string) => {
    setWished((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const value = useMemo<OwnedApi>(
    () => ({
      owned,
      isOwned: (n) => owned.has(n),
      count: owned.size,
      totalPals: instances.length,
      toggle,
      instances,
      instancesOf: (n) => instances.filter((i) => i.species === n),
      countOf: (n) => instances.reduce((c, i) => (i.species === n ? c + 1 : c), 0),
      addInstance,
      removeInstance,
      setLevel,
      wished,
      isWished: (n) => wished.has(n),
      toggleWish,
      wishCount: wished.size,
    }),
    [owned, instances, wished, toggle, addInstance, removeInstance, setLevel, toggleWish],
  );

  return <OwnedContext.Provider value={value}>{children}</OwnedContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook co-located by design
export function useOwned(): OwnedApi {
  const ctx = useContext(OwnedContext);
  if (!ctx) throw new Error("useOwned must be used within an OwnedProvider");
  return ctx;
}
