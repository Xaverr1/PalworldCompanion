import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pwc.partyAssign.v1";

// setId -> species -> chosen owned-pal instance id.
type Store = Record<string, Record<string, string>>;

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

/** Which owned instance is assigned to each species slot of a party set. */
export function usePartyAssignments() {
  const [store, setStore] = useState<Store>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  const getAssigned = useCallback(
    (setId: string, species: string): string | undefined => store[setId]?.[species],
    [store],
  );

  const assign = useCallback((setId: string, species: string, instanceId: string) => {
    setStore((prev) => ({
      ...prev,
      [setId]: { ...(prev[setId] ?? {}), [species]: instanceId },
    }));
  }, []);

  return { getAssigned, assign };
}
