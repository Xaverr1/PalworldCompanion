import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "pwc.owned.v1";

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

interface OwnedApi {
  owned: Set<string>;
  isOwned: (name: string) => boolean;
  toggle: (name: string) => void;
  count: number;
}

const OwnedContext = createContext<OwnedApi | null>(null);

/** Tracks which pals the player has obtained; persisted to localStorage. */
export function OwnedProvider({ children }: { children: ReactNode }) {
  const [owned, setOwned] = useState<Set<string>>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...owned]));
  }, [owned]);

  const toggle = useCallback((name: string) => {
    setOwned((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const value = useMemo<OwnedApi>(
    () => ({ owned, isOwned: (n) => owned.has(n), toggle, count: owned.size }),
    [owned, toggle],
  );

  return <OwnedContext.Provider value={value}>{children}</OwnedContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook co-located by design
export function useOwned(): OwnedApi {
  const ctx = useContext(OwnedContext);
  if (!ctx) throw new Error("useOwned must be used within an OwnedProvider");
  return ctx;
}
