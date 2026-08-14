// Decompress a Palworld `Level.sav` (or any `.sav`) to its raw GVAS bytes,
// mirroring scripts/extract-pals.py's decompress_sav_to_gvas.
//
// Compression is picked from the magic at offset 8:
//   PlM  -> Oodle (2026 "Tides of Terraria" update), decoded by ooz-wasm
//   PlZ  -> zlib (save type 0x32 is double-zlib), decoded by DecompressionStream
//   CNK  -> chunked wrapper; real header is at offset 12/20, payload at 24

const ascii = new TextDecoder("ascii");

/** zlib-inflate (RFC 1950), matching Python's zlib.decompress. */
async function inflate(
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const ds = new DecompressionStream("deflate");
  const out = new Response(ds.readable).arrayBuffer();
  const writer = ds.writable.getWriter();
  await writer.write(data);
  await writer.close();
  return new Uint8Array(await out);
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
