import type { Element } from "../data/pals";

/** Signature color per element, used for coverage chips, dots, and accents. */
export const ELEMENT_COLOR: Record<Element, string> = {
  Neutral: "#9aa0a6",
  Fire: "#f0592f",
  Water: "#2f9bf0",
  Grass: "#4caf50",
  Electric: "#f0c020",
  Ice: "#4fd0d8",
  Ground: "#b5793b",
  Dark: "#8b5cf6",
  Dragon: "#d5497f",
};

// In-game element type icons, hotlinked from paldb's CDN (same source the pal
// icons use). The numeric suffix is paldb's element ordering, verified per type.
const EL_BASE = "https://cdn.paldb.cc/image/Pal/Texture/UI/Main_Menu";
export const ELEMENT_ICON: Record<Element, string> = {
  Neutral: `${EL_BASE}/T_prt_palstatus_element_00.webp`,
  Fire: `${EL_BASE}/T_prt_palstatus_element_01.webp`,
  Water: `${EL_BASE}/T_prt_palstatus_element_02.webp`,
  Electric: `${EL_BASE}/T_prt_palstatus_element_03.webp`,
  Grass: `${EL_BASE}/T_prt_palstatus_element_04.webp`,
  Dark: `${EL_BASE}/T_prt_palstatus_element_05.webp`,
  Dragon: `${EL_BASE}/T_prt_palstatus_element_06.webp`,
  Ground: `${EL_BASE}/T_prt_palstatus_element_07.webp`,
  Ice: `${EL_BASE}/T_prt_palstatus_element_08.webp`,
};

export const TIER_COLOR: Record<string, string> = {
  S: "#f0592f",
  A: "#f0a020",
  B: "#4caf50",
  C: "#2f9bf0",
  F: "#9aa0a6",
};
