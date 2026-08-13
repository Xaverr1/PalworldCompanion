#!/usr/bin/env python3
"""
Extract your captured pals from a Palworld Level.sav into a small companion
import file (scripts/pals-export.json, a few KB) that the web app can load.

Handles both save compressions: PlZ (zlib) and the newer PlM (Oodle, from the
2026 "Tides of Terraria" update). PlM needs libooz.dll (github.com/zao/ooz) and
the character-format patch for palworld-save-tools — see scripts/README-save.md.

Setup (one time):
    pip install palworld-save-tools
    # then apply the PlM patch + fetch libooz (see README-save.md)

Usage:
    python scripts/extract-pals.py "<path-to>/Level.sav"

Env:
    PALWORLD_OOZ_DLL_PATH   path to libooz.dll (required only for PlM saves)
"""
import ctypes
import json
import os
import sys
import zlib
from datetime import datetime, timezone
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
    dll = os.environ.get("PALWORLD_OOZ_DLL_PATH")
    if not dll or not Path(dll).exists():
        sys.exit(
            "This save uses Oodle (PlM) compression. Set PALWORLD_OOZ_DLL_PATH "
            "to a libooz.dll (from github.com/zao/ooz)."
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


def _b(prop):
    """Unwrap a Byte/Int/Enum/Name property to its scalar value, or None."""
    if not isinstance(prop, dict):
        return None
    v = prop.get("value")
    if isinstance(v, dict):
        return v.get("value")
    return v


def _names(prop):
    """Unwrap an ArrayProperty of names/enums to a list of strings."""
    try:
        return list(prop["value"]["values"])
    except (KeyError, TypeError):
        return []


def extract_pal(param: dict):
    code = _b(param.get("CharacterID"))
    if not code:
        return None
    gender = _b(param.get("Gender"))
    if isinstance(gender, str):
        gender = gender.split("::")[-1]  # EPalGenderType::Male -> Male
    return {
        "code": code,
        "level": _b(param.get("Level")) or 1,
        "rank": _b(param.get("Rank")) or 1,
        "gender": gender,
        "ivs": {
            "hp": _b(param.get("Talent_HP")) or 0,
            "shot": _b(param.get("Talent_Shot")) or 0,
            "defense": _b(param.get("Talent_Defense")) or 0,
        },
        "abilities": [w.split("::")[-1] for w in _names(param.get("EquipWaza"))],
        "passives": _names(param.get("PassiveSkillList")),
    }


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python extract-pals.py <Level.sav>")
    sav_path = Path(sys.argv[1])
    if not sav_path.exists():
        sys.exit(f"File not found: {sav_path}")

    print(f"Reading {sav_path} ({sav_path.stat().st_size / 1e6:.1f} MB)…")
    gvas = GvasFile.read(
        decompress_sav_to_gvas(sav_path.read_bytes()),
        PALWORLD_TYPE_HINTS,
        PALWORLD_CUSTOM_PROPERTIES,
    )
    char_map = gvas.properties["worldSaveData"]["value"]["CharacterSaveParameterMap"]["value"]

    pals = []
    players = 0
    for entry in char_map:
        try:
            param = entry["value"]["RawData"]["value"]["object"]["SaveParameter"]["value"]
        except (KeyError, TypeError):
            continue
        if param.get("IsPlayer", {}).get("value"):
            players += 1
            continue
        pal = extract_pal(param)
        if pal:
            pals.append(pal)

    out = Path(__file__).with_name("pals-export.json")
    out.write_text(
        json.dumps(
            {
                "app": "palworld-companion",
                "kind": "save-pals",
                "version": 1,
                "exportedAt": datetime.now(timezone.utc).isoformat(),
                "count": len(pals),
                "pals": pals,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Extracted {len(pals)} pals (skipped {players} player entries).")
    print(f"Wrote {out} — load it in the companion via 'Import save pals'.")


if __name__ == "__main__":
    main()
