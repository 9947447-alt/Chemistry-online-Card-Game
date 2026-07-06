import type { CardDefinitionId } from "../engine/types";

export type ComponentRequirement = {
  definitionId: CardDefinitionId;
  count: number;
};

export type DIYRecipe = {
  id: string;
  name: string;
  requiredComponents: ComponentRequirement[];
  requiresTarget: boolean;
  result: "CO2_REMOVE_OWN_FIRE" | "SO2_APPLY_LEAK" | "H2O_REMOVE_OWN_FIRE";
};

export const diyRecipes = [
  {
    id: "diy_co2_from_c_o_o",
    name: "C + O + O -> CO2",
    requiredComponents: [
      { definitionId: "element_c", count: 1 },
      { definitionId: "element_o", count: 2 },
    ],
    requiresTarget: false,
    result: "CO2_REMOVE_OWN_FIRE",
  },
  {
    id: "diy_h2o_from_h_oh",
    name: "H+ + OH- -> H2O",
    requiredComponents: [
      { definitionId: "ion_h", count: 1 },
      { definitionId: "ion_oh", count: 1 },
    ],
    requiresTarget: false,
    result: "H2O_REMOVE_OWN_FIRE",
  },
  {
    id: "diy_so2_from_s_o_o",
    name: "S + O + O -> SO2",
    requiredComponents: [
      { definitionId: "element_s", count: 1 },
      { definitionId: "element_o", count: 2 },
    ],
    requiresTarget: true,
    result: "SO2_APPLY_LEAK",
  },
] satisfies DIYRecipe[];
