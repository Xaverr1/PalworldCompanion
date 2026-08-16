// Xbox / Microsoft Store save support. Game Pass stores Palworld saves in the
// Windows Gaming Services (WGS) "container" format instead of a single
// Level.sav: a `containers.index` maps container names to GUID-named folders,
// each holding one blob file whose bytes ARE a standard Palworld `.sav`
// (CNK-wrapped PlZ/PlM) — so once we find the right blob, the normal
// decompress + parse pipeline handles it unchanged.
//
// This module only decodes `containers.index` and picks out the level saves;
// blob resolution + decompression lives in saveImport.ts.

/** One entry from containers.index. */
export interface XboxContainer {
  /** Full container name, e.g. "1235CA…-Level-01" or "…-Slot1-Level-01". */
  name: string;
  /** 32-hex uppercase folder GUID holding this container's blob. */
  folder: string;
  /** Last-modified time (epoch ms). */
  modified: number;
  /** Blob size in bytes as recorded in the index. */
  size: number;
}

/** A selectable world-level save (the thing a player would import). */
export interface XboxSaveOption {
  /** World id (the container-name prefix before "-…Level-01"). */
  world: string;
  /** True for a rolling Slot1/2/3 backup rather than the live save. */
  isBackup: boolean;
  /** Backup slot number, when isBackup. */
  slot?: number;
  folder: string;
  modified: number;
  size: number;
}

const utf16 = new TextDecoder("utf-16le");
// FILETIME (100ns ticks since 1601) → Unix epoch ms.
const FILETIME_EPOCH_MS = 11644473600000n;

/**
 * Decode a WGS `containers.index`. Layout (little-endian):
 *   header: u32 version, u64 count, str moniker, u64 mtime, u32 flags,
 *           str storeGuid, u64 pad
 *   each entry: str name, str cloudName, str etag, u32 seq, u8 state,
 *               guid(16) folder, u64 mtime, u64 pad, u64 size
 * where str = u32 char-count then that many UTF-16LE code units, and the folder
 * guid is a .NET Guid (first three groups little-endian) → its "N" hex string.
 */
export function parseContainersIndex(buf: Uint8Array): XboxContainer[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 0;
  const u32 = () => {
    const v = dv.getUint32(p, true);
    p += 4;
    return v;
  };
  const u64 = () => {
    const v = dv.getBigUint64(p, true);
    p += 8;
    return v;
  };
  const str = () => {
    const n = u32();
    const s = utf16.decode(buf.subarray(p, p + n * 2));
    p += n * 2;
    return s;
  };
  const guidN = () => {
    const g = buf.subarray(p, p + 16);
    p += 16;
    const h = (i: number) => g[i].toString(16).padStart(2, "0");
    return [h(3), h(2), h(1), h(0), h(5), h(4), h(7), h(6), h(8), h(9), h(10), h(11), h(12), h(13), h(14), h(15)]
      .join("")
      .toUpperCase();
  };
  const toEpochMs = (ft: bigint) => Number(ft / 10000n - FILETIME_EPOCH_MS);

  const version = u32();
  if (version !== 14) {
    // Only v14 (current WGS) is validated; bail rather than misread.
    throw new Error(`Unsupported Xbox save index version ${version}.`);
  }
  const count = Number(u64());
  str(); // package moniker
  u64(); // index mtime
  u32(); // flags
  str(); // store guid string
  u64(); // pad

  const out: XboxContainer[] = [];
  for (let i = 0; i < count && p + 8 <= buf.length; i++) {
    str(); // raw name
    const name = str(); // clean name
    str(); // etag
    u32(); // sequence
    p += 1; // state (u8)
    const folder = guidN();
    const modified = toEpochMs(u64());
    u64(); // pad
    const size = Number(u64());
    out.push({ name, folder, modified, size });
  }
  return out;
}

// "<world>-Level-01" (live) or "<world>-Slot<n>-Level-01" (backup).
const LEVEL_RE = /^(.*?)-(?:Slot(\d+)-)?Level-01$/;

/**
 * The world-level saves from a parsed index, live saves first and newest first.
 * These are the candidates a player imports; other containers (LevelMeta,
 * Players, WorldOption, LocalData) are ignored.
 */
export function xboxLevelSaves(containers: XboxContainer[]): XboxSaveOption[] {
  const out: XboxSaveOption[] = [];
  for (const c of containers) {
    const m = LEVEL_RE.exec(c.name);
    if (!m) continue;
    out.push({
      world: m[1],
      isBackup: m[2] !== undefined,
      ...(m[2] !== undefined ? { slot: Number(m[2]) } : {}),
      folder: c.folder,
      modified: c.modified,
      size: c.size,
    });
  }
  out.sort((a, b) => Number(a.isBackup) - Number(b.isBackup) || b.modified - a.modified);
  return out;
}
