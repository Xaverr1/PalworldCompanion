// Decompress a Palworld `Level.sav` (or any `.sav`) to its raw GVAS bytes,
// mirroring scripts/extract-pals.py's decompress_sav_to_gvas.
//
// Compression is picked from the magic at offset 8:
//   PlM  -> Oodle (2026 "Tides of Terraria" update), decoded by ooz-wasm
//   PlZ  -> zlib (save type 0x32 is double-zlib), decoded by DecompressionStream
//   CNK  -> chunked wrapper; real header is at offset 12/20, payload at 24

const ascii = new TextDecoder("ascii");

/**
 * zlib-inflate matching Python's `zlib.decompress` — tolerant of both the
 * single stream Steam writes and the *concatenated* zlib members Xbox/WGS saves
 * use (Palworld chunks the compressed data ~128 KB at a time; native
 * DecompressionStream stops at the first member and rejects the rest). pako
 * reports bytes consumed per member, so we loop until the input is exhausted.
 * Loaded on demand so it only ships when someone actually imports a save.
 */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const pako = await import("pako");
  const parts: Uint8Array[] = [];
  let off = 0;
  let total = 0;
  while (off < data.length) {
    while (off < data.length && data[off] === 0) off++; // inter-chunk padding
    if (off >= data.length) break;
    const inf = new pako.Inflate();
    inf.push(data.subarray(off));
    if (inf.err) {
      if (parts.length) break; // trailing junk after real members — keep them
      throw new Error(`Couldn't decompress the save (zlib: ${inf.msg}).`);
    }
    const res = inf.result as Uint8Array;
    if (!res || res.length === 0) break;
    parts.push(res);
    total += res.length;
    const consumed = (inf as unknown as { strm: { total_in: number } }).strm.total_in;
    if (consumed <= 0) break;
    off += consumed;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export async function decompressSave(
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  if (data.length < 12) throw new Error("File is too small to be a save.");
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

  let uncompressedLen = dv.getUint32(0, true);
  let magic = ascii.decode(data.subarray(8, 11));
  let saveType = data[11];
  let offset = 12;

  if (magic === "CNK") {
    uncompressedLen = dv.getUint32(12, true);
    magic = ascii.decode(data.subarray(20, 23));
    saveType = data[23];
    offset = 24;
  }

  const payload = data.subarray(offset);

  if (magic === "PlM") {
    // Single-file embedded-WASM Oodle decoder; loaded on demand so it only
    // compiles when someone actually imports a save.
    const { decompress } = await import("ooz-wasm");
    return decompress(payload, uncompressedLen);
  }

  if (magic === "PlZ") {
    let out = await inflate(payload);
    if (saveType === 0x32) out = await inflate(out); // double-zlib
    return out;
  }

  throw new Error(
    `Unrecognized save format "${magic}" (expected PlM, PlZ, or CNK).`,
  );
}
