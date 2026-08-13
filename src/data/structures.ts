import structuresJson from "./structures.json";

/** The nine in-game construction tabs, in build-menu order. */
export const BUILD_CATEGORIES = [
  "Production",
  "Food",
  "Infrastructure",
  "Storage",
  "Foundations",
  "Defenses",
  "Lighting",
  "Furniture",
  "Other",
] as const;
export type BuildCategory = (typeof BUILD_CATEGORIES)[number];

/** One material line in a structure's build recipe. */
export interface MaterialCost {
  /** Material slug, keys into MATERIALS. */
  slug: string;
  qty: number;
}

/** A placeable base structure and what it costs to build. */
export interface Structure {
  /** paldb.cc page slug, e.g. "Wooden_Chest". Unique id. */
  slug: string;
  /** Display name, e.g. "Wooden Chest". */
  name: string;
  category: BuildCategory;
  /** In-game grouping within the category, e.g. "Refinement". */
  subcategory: string;
  icon: string;
  materials: MaterialCost[];
}

/** A craftable/raw material referenced by a recipe. */
export interface Material {
  name: string;
  icon: string;
}

const data = structuresJson as {
  structures: Structure[];
  materials: Record<string, Material>;
};

export const STRUCTURES: Structure[] = data.structures;
export const MATERIALS: Record<string, Material> = data.materials;

const BY_SLUG = new Map(STRUCTURES.map((s) => [s.slug, s]));
export const structureBySlug = (slug: string): Structure | undefined =>
  BY_SLUG.get(slug);
