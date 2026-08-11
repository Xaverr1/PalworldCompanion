import type { WorkType } from "../data/pals";

// Base-aware so it works under a subpath deploy (e.g. GitHub Pages).
const B = import.meta.env.BASE_URL;

/** In-game work-suitability icons, served from public/work/. */
export const WORK_ICON: Record<WorkType, string> = {
  Kindling: `${B}work/kindling.webp`,
  Watering: `${B}work/watering.webp`,
  Planting: `${B}work/planting.webp`,
  "Generating Electricity": `${B}work/generating-electricity.webp`,
  Handiwork: `${B}work/handiwork.webp`,
  Gathering: `${B}work/gathering.webp`,
  Lumbering: `${B}work/lumbering.webp`,
  Mining: `${B}work/mining.webp`,
  "Medicine Production": `${B}work/medicine.webp`,
  Cooling: `${B}work/cooling.webp`,
  Transporting: `${B}work/transporting.webp`,
  Farming: `${B}work/farming.webp`,
};
