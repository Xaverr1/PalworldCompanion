// Save / export / import of all locally-stored companion data.

const KEYS = [
  "pwc.owned.v2",
  "pwc.wishlist.v1",
  "pwc.sets.v1",
  "pwc.loadouts.v2",
  "pwc.upgrades.v2",
  "pwc.partyAssign.v1",
] as const;

export function exportData(): string {
  const data: Record<string, unknown> = {};
  for (const key of KEYS) {
    const raw = localStorage.getItem(key);
    if (raw != null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        /* skip corrupt entry */
      }
    }
  }
  return JSON.stringify(
    {
      app: "palworld-companion",
      version: 2,
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2,
  );
}

/** Trigger a browser download of the current save. */
export function downloadBackup(): void {
  const blob = new Blob([exportData()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `palworld-companion-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Restore a save produced by exportData. Only known keys are written.
 * Throws if the file is not a recognizable backup. Caller should reload.
 */
export function importData(text: string): void {
  const parsed = JSON.parse(text);
  const data = (parsed && parsed.data) ?? parsed;
  if (!data || typeof data !== "object") {
    throw new Error("Not a valid companion save file.");
  }
  const known = new Set<string>(KEYS);
  let wrote = 0;
  for (const [key, value] of Object.entries(data)) {
    if (known.has(key)) {
      localStorage.setItem(key, JSON.stringify(value));
      wrote++;
    }
  }
  if (wrote === 0) throw new Error("No companion data found in that file.");
}
