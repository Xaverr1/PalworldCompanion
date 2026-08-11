import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const OWNED_KEY = "pwc.owned.v1";
const WISH_KEY = "pwc.wishlist.v1";

function load(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function toggleIn(set: Set<string>, name: string): Set<string> {
  const next = new Set(set);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  return next;
}

interface OwnedApi {
  owned: Set<string>;
  isOwned: (name: string) => boolean;
  toggle: (name: string) => void;
  count: number;
  wished: Set<string>;
  isWished: (name: string) => boolean;
  toggleWish: (name: string) => void;
  wishCount: number;
}

const OwnedContext = createContext<OwnedApi | null>(null);

/** Tracks obtained and wishlisted pals; both persisted to localStorage. */
export function OwnedProvider({ children }: { children: ReactNode }) {
  const [owned, setOwned] = useState<Set<string>>(() => load(OWNED_KEY));
  const [wished, setWished] = useState<Set<string>>(() => load(WISH_KEY));

  useEffect(() => {
    localStorage.setItem(OWNED_KEY, JSON.stringify([...owned]));
  }, [owned]);
  useEffect(() => {
    localStorage.setItem(WISH_KEY, JSON.stringify([...wished]));
  }, [wished]);

  const toggle = useCallback((name: string) => {
    // Obtaining a pal clears it from the wishlist.
    setOwned((prev) => toggleIn(prev, name));
    setWished((prev) => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }, []);

  const toggleWish = useCallback((name: string) => {
    setWished((prev) => toggleIn(prev, name));
  }, []);

  const value = useMemo<OwnedApi>(
    () => ({
      owned,
      isOwned: (n) => owned.has(n),
      toggle,
      count: owned.size,
      wished,
      isWished: (n) => wished.has(n),
      toggleWish,
      wishCount: wished.size,
    }),
    [owned, wished, toggle, toggleWish],
  );

  return <OwnedContext.Provider value={value}>{children}</OwnedContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook co-located by design
export function useOwned(): OwnedApi {
  const ctx = useContext(OwnedContext);
  if (!ctx) throw new Error("useOwned must be used within an OwnedProvider");
  return ctx;
}
