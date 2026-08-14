import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pwc.parties.v1";

/** Palworld carries a 5-pal active party. */
export const PARTY_LIMIT = 5;

/** A saved party — an ordered list of owned pal *instance* ids. */
export interface Party {
  id: string;
  name: string;
  /** Owned instance ids (from useOwned), max PARTY_LIMIT. */
  members: string[];
  createdAt: number;
  updatedAt: number;
}

function newId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

function load(): Party[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Party[]) : [];
  } catch {
    return [];
  }
}

/** localStorage-backed collection of instance-based parties. */
export function useParties() {
  const [parties, setParties] = useState<Party[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parties));
  }, [parties]);

  const patch = useCallback((id: string, fn: (p: Party) => Party) => {
    setParties((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
  }, []);

  const addParty = useCallback((name?: string) => {
    const now = Date.now();
    const party: Party = {
      id: newId(),
      name: name?.trim() || "New party",
      members: [],
      createdAt: now,
      updatedAt: now,
    };
    setParties((prev) => [...prev, party]);
    return party.id;
  }, []);

  const removeParty = useCallback((id: string) => {
    setParties((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const renameParty = useCallback(
    (id: string, name: string) =>
      patch(id, (p) => ({ ...p, name, updatedAt: Date.now() })),
    [patch],
  );

  /** Add the instance if absent (and there's room), else remove it. */
  const toggleMember = useCallback(
    (id: string, instanceId: string) =>
      patch(id, (p) => {
        if (p.members.includes(instanceId)) {
          return {
            ...p,
            members: p.members.filter((m) => m !== instanceId),
            updatedAt: Date.now(),
          };
        }
        if (p.members.length >= PARTY_LIMIT) return p;
        return { ...p, members: [...p.members, instanceId], updatedAt: Date.now() };
      }),
    [patch],
  );

  const removeMember = useCallback(
    (id: string, instanceId: string) =>
      patch(id, (p) => ({
        ...p,
        members: p.members.filter((m) => m !== instanceId),
        updatedAt: Date.now(),
      })),
    [patch],
  );

  return { parties, addParty, removeParty, renameParty, toggleMember, removeMember };
}
