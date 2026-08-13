#!/usr/bin/env python3
"""
Pull a small, shareable sample of your captured pals out of a Palworld
Level.sav, so the companion's importer can be built against the real schema
instead of guesses. UIDs/GUIDs are redacted; the output is a few pals only.

Requires the community parser (does the hard decompress + GVAS parsing):
    pip install palworld-save-tools

Usage (Git Bash or PowerShell):
    python scripts/sample-save.py "C:/Users/<you>/AppData/Local/Pal/Saved/SaveGames/<steamid>/<worldid>/Level.sav"
    python scripts/sample-save.py <path-to-Level.sav> 12   # optional: how many pals

Writes scripts/sample-pals.json next to this file. Open it, glance it over,
then paste its contents back to me.
"""
import ctypes
import json
import os
import sys
import zlib
from pathlib import Path

try:
    from palworld_save_tools.gvas import GvasFile
    from palworld_save_tools.paltypes import (
        PALWORLD_CUSTOM_PROPERTIES,
        PALWORLD_TYPE_HINTS,
    )
except ImportError:
    sys.exit("Missing dependency. Run:  pip install palworld-save-tools")


def _ooz_decompress(compressed: bytes, uncompressed_len: int) -> bytes:
    """Decompress an Oodle (PlM) payload via libooz.dll (github.com/zao/ooz)."""
    dll = os.environ.get("PALWORLD_OOZ_DLL_PATH")
    if not dll or not Path(dll).exists():
        sys.exit(
            "This save uses the newer Oodle (PlM) compression. Set "
            "PALWORLD_OOZ_DLL_PATH to a libooz.dll (from github.com/zao/ooz)."
        )
    lib = ctypes.CDLL(dll)
    lib.Ooz_Decompress.argtypes = [
        ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_size_t,
        ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_size_t,
        ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int,
    ]
    lib.Ooz_Decompress.restype = ctypes.c_int
    out = ctypes.create_string_buffer(uncompressed_len + 64)
    r = lib.Ooz_Decompress(
        compressed, len(compressed), out, uncompressed_len,
        0, 0, 0, None, 0, None, None, None, 0, 0,
    )
    if r != uncompressed_len:
        raise Exception(f"Ooz_Decompress returned {r}, expected {uncompressed_len}")
    return out.raw[:uncompressed_len]


def decompress_sav_to_gvas(data: bytes) -> bytes:
    """Decompress a .sav to raw GVAS bytes. Handles PlZ (zlib) and PlM (Oodle)."""
    uncompressed_len = int.from_bytes(data[0:4], "little")
    magic = data[8:11]
    save_type = data[11]
    offset = 12
    if magic == b"CNK":
        uncompressed_len = int.from_bytes(data[12:16], "little")
        magic = data[20:23]
        save_type = data[23]
        offset = 24
    payload = data[offset:]
    if magic == b"PlM":
        return _ooz_decompress(payload, uncompressed_len)
    if magic == b"PlZ":
        out = zlib.decompress(payload)
        if save_type == 0x32:
            out = zlib.decompress(out)
        return out
    sys.exit(f"Unrecognized save magic {magic!r} (expected PlZ or PlM).")


def redact(o):
    """Blank out anything that looks like a player/world UID or GUID."""
    if isinstance(o, dict):
        return {
            k: ("<redacted>" if ("uid" in k.lower() or "guid" in k.lower()) else redact(v))
            for k, v in o.items()
        }
    if isinstance(o, list):
        return [redact(x) for x in o]
    return o


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python sample-save.py <Level.sav> [count]")
    sav_path = Path(sys.argv[1])
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 8

    if not sav_path.exists():
        sys.exit(f"File not found: {sav_path}")

    print(f"Reading {sav_path} ({sav_path.stat().st_size / 1e6:.1f} MB)…")
    raw = sav_path.read_bytes()
    gvas_data = decompress_sav_to_gvas(raw)
    gvas = GvasFile.read(gvas_data, PALWORLD_TYPE_HINTS, PALWORLD_CUSTOM_PROPERTIES)

    world = gvas.properties["worldSaveData"]["value"]
    char_map = world["CharacterSaveParameterMap"]["value"]
    print(f"CharacterSaveParameterMap entries: {len(char_map)}")

    samples = []
    skipped_players = 0
    for entry in char_map:
        try:
            param = entry["value"]["RawData"]["value"]["object"]["SaveParameter"]["value"]
        except (KeyError, TypeError):
            continue
        # The human player character(s) also live in this map — skip them.
        if param.get("IsPlayer", {}).get("value"):
            skipped_players += 1
            continue
        if "CharacterID" not in param:
            continue
        samples.append(param)
        if len(samples) >= count:
            break

    if not samples:
        # Nothing matched the expected nesting — dump one raw entry so we can
        # see the actual structure and adjust.
        print("No pals matched the expected path; dumping one raw entry instead.")
        sample_out = {"total": len(char_map), "raw_entry": redact(char_map[0])}
    else:
        print(f"Collected {len(samples)} pals (skipped {skipped_players} player entries).")
        sample_out = {"total": len(char_map), "pals": redact(samples)}

    out = Path(__file__).with_name("sample-pals.json")
    out.write_text(json.dumps(sample_out, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {out}. Review it, then paste its contents back.")


if __name__ == "__main__":
    main()
