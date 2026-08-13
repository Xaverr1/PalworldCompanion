import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pwc.build.v1";

/** One queued structure and how many to build. */
export interface QueueItem {
  /** Structure slug (keys into STRUCTURES). */
  slug: string;
  qty: number;
}

function load(): QueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Ordered build queue of structures + quantities, persisted locally. */
export function useBuildQueue() {
  const [queue, setQueue] = useState<QueueItem[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

  /** Append a structure, or bump its quantity if already queued. */
  const add = useCallback((slug: string, qty = 1) => {
    setQueue((prev) => {
      const i = prev.findIndex((q) => q.slug === slug);
      if (i === -1) return [...prev, { slug, qty }];
      const next = [...prev];
      next[i] = { ...next[i], qty: next[i].qty + qty };
      return next;
    });
  }, []);

  /** Set an exact quantity; removes the item when n <= 0. */
  const setQty = useCallback((slug: string, n: number) => {
    setQueue((prev) => {
      if (n <= 0) return prev.filter((q) => q.slug !== slug);
      return prev.map((q) => (q.slug === slug ? { ...q, qty: n } : q));
    });
  }, []);

  const remove = useCallback((slug: string) => {
    setQueue((prev) => prev.filter((q) => q.slug !== slug));
  }, []);

  const clear = useCallback(() => setQueue([]), []);

  return { queue, add, setQty, remove, clear };
}
