# Importing your pals from a Palworld save

**The easy way (no setup):** in the app, click **Import Pals** and pick your
`Level.sav` directly. It's decompressed and parsed entirely in your browser
(Oodle via `ooz-wasm`, GVAS via `src/lib/saveParse.ts`) — nothing is uploaded,
and it works on any OS. This script is only needed as a fallback.

---

`extract-pals.py` reads a Palworld `Level.sav` and writes a small
`pals-export.json` that the companion also accepts via **Import Pals**. It
populates every obtained pal with its real level and IVs. (The in-app path
above does the same thing without Python.)

## Why this needs setup

Since the 2026 "Tides of Terraria" update, saves are **Oodle-compressed**
(magic `PlM1`) instead of zlib (`PlZ`). Two extra pieces are needed on top of
[`palworld-save-tools`](https://github.com/cheahjs/palworld-save-tools):

1. **`libooz.dll`** — an open-source Oodle decompressor
   ([zao/ooz](https://github.com/zao/ooz)). We keep a copy in `scripts/tools/`
   (git-ignored; no explicit upstream license, so it's fetched, not committed).
2. **A character-format patch** for `palworld-save-tools` — the new update
   changed the pal struct, so the stock v0.24.0 parser errors with
   `Warning: EOF not reached`. The patched files come from
   [palworld-hostfix-toolkit](https://github.com/quadrantbs/palworld-hostfix-toolkit)
   (`patched_palworld_save_tools/`, based on MIT v0.24.0) — overlay them onto
   the installed package.

## One-time setup

```bash
pip install palworld-save-tools==0.24.0
# then overlay the patched palsav.py + rawdata/*.py over the installed package
# (find it with: pip show palworld-save-tools), and make sure
# scripts/tools/libooz.dll exists (fetch from zao/ooz v0.2.4 if missing).
```

## Extract

```bash
# point this at libooz.dll
export PALWORLD_OOZ_DLL_PATH="scripts/tools/libooz.dll"

python scripts/extract-pals.py \
  "C:/Users/<you>/AppData/Local/Pal/Saved/SaveGames/<steam-id>/<world-id>/Level.sav"
```

That writes `scripts/pals-export.json` (git-ignored — it's your data). Then in
the app: **Import Pals → pick `pals-export.json`**. It replaces your obtained
list; your wishlist is left alone.

## Notes

- Alpha/predator variants (`BOSS_…`) import as their base species.
- Caught humans (soldiers, traders) are skipped — they aren't pals.
- Only zlib write-back is supported by these tools; this workflow is **read-only**
  and never touches your save.
