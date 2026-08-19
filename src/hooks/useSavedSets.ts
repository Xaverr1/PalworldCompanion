import { useCallback, useEffect, useState } from "react";
import type { WorkType } from "../data/pals";
import {
  SET_LIMIT,
  createSet,
  type HumanWorker,
  type PalSet,
  type SetKind,
} from "../lib/sets";

function newId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

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
        const workers = s.members.length + (s.humans?.length ?? 0);
        if (workers >= SET_LIMIT[s.kind]) return s;
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

  /** Overwrite a set's whole member list (used to migrate legacy rosters). */
  const replaceMembers = useCallback(
    (id: string, memberIds: string[]) =>
      patch(id, (s) => ({
        ...s,
        members: memberIds.slice(0, SET_LIMIT[s.kind]),
        updatedAt: Date.now(),
      })),
    [patch],
  );

  const patchHumans = useCallback(
    (id: string, fn: (humans: HumanWorker[]) => HumanWorker[]) =>
      patch(id, (s) => ({
        ...s,
        humans: fn(s.humans ?? []),
        updatedAt: Date.now(),
      })),
    [patch],
  );

  const addHuman = useCallback(
    (id: string) =>
      patch(id, (s) => {
        const workers = s.members.length + (s.humans?.length ?? 0);
        if (workers >= SET_LIMIT[s.kind]) return s;
        return {
          ...s,
          humans: [
            ...(s.humans ?? []),
            { id: newId(), level: 1, works: {}, name: "Human Worker" },
          ],
          updatedAt: Date.now(),
        };
      }),
    [patch],
  );

  const setHumanName = useCallback(
    (id: string, humanId: string, name: string) =>
      patchHumans(id, (humans) =>
        humans.map((h) => (h.id === humanId ? { ...h, name } : h)),
      ),
    [patchHumans],
  );

  const removeHuman = useCallback(
    (id: string, humanId: string) =>
      patchHumans(id, (humans) => humans.filter((h) => h.id !== humanId)),
    [patchHumans],
  );

  const setHumanLevel = useCallback(
    (id: string, humanId: string, level: number) =>
      patchHumans(id, (humans) =>
        humans.map((h) => (h.id === humanId ? { ...h, level } : h)),
      ),
    [patchHumans],
  );

  const setHumanWork = useCallback(
    (id: string, humanId: string, work: WorkType, level: number) =>
      patchHumans(id, (humans) =>
        humans.map((h) => {
          if (h.id !== humanId) return h;
          const works = { ...h.works };
          if (level > 0) works[work] = level;
          else delete works[work];
          return { ...h, works };
        }),
      ),
    [patchHumans],
  );

  return {
    sets,
    addSet,
    removeSet,
    renameSet,
    addMember,
    removeMember,
    replaceMembers,
    addHuman,
    setHumanName,
    removeHuman,
    setHumanLevel,
    setHumanWork,
  };
}
