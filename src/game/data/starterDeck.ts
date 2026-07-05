import type { CardDefinitionId } from "../engine/types";

export type StarterDeckEntry = {
  definitionId: CardDefinitionId;
  count: number;
};

export const starterDeck = [
  { definitionId: "element_o", count: 6 },
  { definitionId: "element_c", count: 3 },
  { definitionId: "element_s", count: 3 },
  { definitionId: "ion_h", count: 5 },
  { definitionId: "ion_oh", count: 5 },
  { definitionId: "ion_co3", count: 4 },
  { definitionId: "ion_cl", count: 4 },
  { definitionId: "ion_so4", count: 3 },
  { definitionId: "ion_na", count: 5 },
  { definitionId: "ion_k", count: 3 },
  { definitionId: "ion_ca", count: 2 },
  { definitionId: "substance_h2o", count: 3 },
  { definitionId: "substance_co2", count: 4 },
  { definitionId: "substance_so2", count: 4 },
  { definitionId: "substance_hcl_dilute", count: 3 },
  { definitionId: "substance_h2so4_dilute", count: 2 },
  { definitionId: "substance_naoh_dilute", count: 3 },
  { definitionId: "substance_koh_dilute", count: 2 },
  { definitionId: "substance_caoh2_limewater", count: 2 },
  { definitionId: "substance_na2co3", count: 2 },
  { definitionId: "event_lab_fire", count: 2 },
] satisfies StarterDeckEntry[];

export const starterDeckSize = starterDeck.reduce((total, entry) => total + entry.count, 0);
