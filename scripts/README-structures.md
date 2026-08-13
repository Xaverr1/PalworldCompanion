# Building the structures dataset

`build-structures.mjs` scrapes buildable base structures and their material
costs from [paldb.cc](https://paldb.cc) into `src/data/structures.json`, which
the **Build** tab consumes. paldb.cc is the same source the app already uses for
every pal/item icon URL.

## Run

```bash
node scripts/build-structures.mjs
```

- Reads the nine in-game construction category pages (Production, Food,
  Infrastructure, Storage, Foundations, Defenses, Lighting, Furniture, Other) to
  enumerate every structure, then fetches each structure page to parse its build
  recipe.
- Raw HTML is cached under `scripts/.cache/` (git-ignored). The first run makes
  ~470 live requests (throttled ~150 ms apart, a few minutes); re-runs are
  instant. **Delete `scripts/.cache/` to force a fresh pull** after a game
  update.
- The script logs any structure with no parseable recipe. A clean run reports
  zero.

## Output shape

```jsonc
{
  "structures": [
    {
      "slug": "Wooden_Chest",      // paldb page slug + unique id
      "name": "Wooden Chest",
      "category": "Storage",        // one of the nine build tabs
      "subcategory": "Chests",      // in-game grouping within the tab
      "icon": "https://cdn.paldb.cc/.../T_icon_buildObject_ItemChest.webp",
      "materials": [{ "slug": "Wood", "qty": 15 }, { "slug": "Stone", "qty": 5 }]
    }
  ],
  "materials": {                    // index: material slug -> display name + icon
    "Wood": { "name": "Wood", "icon": "https://cdn.paldb.cc/.../T_itemicon_Material_Wood.webp" }
  }
}
```

Materials are recorded exactly as each recipe lists them (no craft-tree
expansion of intermediates like Nails or Ingots).
