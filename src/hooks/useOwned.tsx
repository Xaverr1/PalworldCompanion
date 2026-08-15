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

/** Per-stat IVs ("talents"), each 0–100, imported from a save. */
export interface OwnedIVs {
  hp: number;
  shot: number;
  defense: number;
}

/** One obtained pal instance — a specific pal the player owns. */
export interface OwnedPal {
  id: string;
  species: string;
  level: number;
  /** Real IVs, present only for save-imported pals. */
  ivs?: OwnedIVs;
  /** Player-given name from the save, if any. */
  nickname?: string;
  /** "Male" / "Female" from the save, if known. */
  gender?: string;
}

/** A pal to import from a save: species name + level, plus optional metadata. */
export interface ImportPal {
  species: string;
  level: number;
  ivs?: OwnedIVs;
  nickname?: string;
  gender?: string;
  /** Skill ids to seed as learned + equipped (from EquipWaza). */
  abilities?: string[];
  /** Passive skill ids to seed. */
  passives?: string[];
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
  setNickname: (id: string, nickname: string) => void;
  setGender: (id: string, gender: string) => void;
  /** Replace all obtained instances (used by save import); returns the new instances. */
  importInstances: (pals: ImportPal[]) => OwnedPal[];
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

  const importInstances = useCallback((pals: ImportPal[]): OwnedPal[] => {
    const created = pals.map((p) => ({
      id: newId(),
      species: p.species,
      level: clampLevel(p.level),
      ...(p.ivs ? { ivs: p.ivs } : {}),
      ...(p.nickname ? { nickname: p.nickname } : {}),
      ...(p.gender ? { gender: p.gender } : {}),
    }));
    setInstances(created);
    return created;
  }, []);

  const setLevel = useCallback((id: string, level: number) => {
    setInstances((prev) =>
      prev.map((i) => (i.id === id ? { ...i, level: clampLevel(level) } : i)),
    );
  }, []);

  const setNickname = useCallback((id: string, nickname: string) => {
    const name = nickname.trim();
    setInstances((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, nickname: name || undefined } : i,
      ),
    );
  }, []);

  const setGender = useCallback((id: string, gender: string) => {
    setInstances((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, gender: gender || undefined } : i,
      ),
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
      setNickname,
      setGender,
      importInstances,
      wished,
      isWished: (n) => wished.has(n),
      toggleWish,
      wishCount: wished.size,
    }),
    [owned, instances, wished, toggle, addInstance, removeInstance, setLevel, setNickname, setGender, importInstances, toggleWish],
  );

  return <OwnedContext.Provider value={value}>{children}</OwnedContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook co-located by design
export function useOwned(): OwnedApi {
  const ctx = useContext(OwnedContext);
  if (!ctx) throw new Error("useOwned must be used within an OwnedProvider");
  return ctx;
}
