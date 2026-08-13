import { MATERIALS, structureBySlug } from "../data/structures";
import type { QueueItem } from "../hooks/useBuildQueue";

export interface MaterialTotal {
  slug: string;
  name: string;
  icon: string;
  total: number;
}

/**
 * Sum the raw materials a build queue requires. Each structure contributes
 * `queueQty × recipeQty` of every material it lists; materials are summed as
 * listed (no craft-tree expansion of intermediates). Sorted by total desc.
 */
export function aggregateMaterials(queue: QueueItem[]): MaterialTotal[] {
  const totals = new Map<string, number>();
  for (const item of queue) {
    const structure = structureBySlug(item.slug);
    if (!structure) continue;
    for (const mat of structure.materials) {
      totals.set(mat.slug, (totals.get(mat.slug) ?? 0) + mat.qty * item.qty);
    }
  }
  return [...totals.entries()]
    .map(([slug, total]) => ({
      slug,
      total,
      name: MATERIALS[slug]?.name ?? slug.replace(/_/g, " "),
      icon: MATERIALS[slug]?.icon ?? "",
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
