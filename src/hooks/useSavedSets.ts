import { useCallback, useEffect, useState } from "react";
import {
  SET_LIMIT,
  createSet,
  type PalSet,
  type SetKind,
} from "../lib/sets";

const STORAGE_KEY = "pwc.sets.v1";

function load(): PalSet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PalSet[]) : [];
  } catch {
    return [];
  }
}

/** localStorage-backed collection of saved base/party sets. */
export function useSavedSets() {
  const [sets, setSets] = useState<PalSet[]>(load);

  // Persist on every change.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  }, [sets]);

  const patch = useCallback((id: string, fn: (s: PalSet) => PalSet) => {
    setSets((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));
  }, []);

  const addSet = useCallback((kind: SetKind, name: string) => {
    const set = createSet(kind, name.trim() || `New ${kind}`);
    setSets((prev) => [...prev, set]);
    return set.id;
  }, []);

  const removeSet = useCallback((id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const renameSet = useCallback(
    (id: string, name: string) =>
      patch(id, (s) => ({ ...s, name, updatedAt: Date.now() })),
    [patch],
  );

  const addMember = useCallback(
    (id: string, palName: string) =>
      patch(id, (s) => {
        if (s.members.includes(palName)) return s;
        if (s.members.length >= SET_LIMIT[s.kind]) return s;
        return { ...s, members: [...s.members, palName], updatedAt: Date.now() };
      }),
    [patch],
  );

  const removeMember = useCallback(
    (id: string, palName: string) =>
      patch(id, (s) => ({
        ...s,
        members: s.members.filter((m) => m !== palName),
        updatedAt: Date.now(),
      })),
    [patch],
  );

  return { sets, addSet, removeSet, renameSet, addMember, removeMember };
}
