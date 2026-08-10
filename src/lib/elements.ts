import type { Element } from "../data/pals";

/** Signature color per element, used for badges and accents. */
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

export const TIER_COLOR: Record<string, string> = {
  S: "#f0592f",
  A: "#f0a020",
  B: "#4caf50",
  C: "#2f9bf0",
  F: "#9aa0a6",
};
