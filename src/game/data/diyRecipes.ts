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
  result: "CO2_REMOVE_OWN_FIRE" | "SO2_APPLY_LEAK" | "H2O_REMOVE_OWN_FIRE" | "VIRTUAL_ATTACK";
  damageKind?: "acid" | "base";
  damageAmount?: number;
  displayName?: string;
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
    id: "diy_hcl_from_h_cl",
    name: "H+ + Cl- -> 稀 HCl",
    requiredComponents: [
      { definitionId: "ion_h", count: 1 },
      { definitionId: "ion_cl", count: 1 },
    ],
    requiresTarget: true,
    result: "VIRTUAL_ATTACK",
    damageKind: "acid",
    damageAmount: 1,
    displayName: "主动 DIY 生成的稀 HCl",
  },
  {
    id: "diy_h2so4_from_2h_so4",
    name: "2H+ + SO4^2- -> 稀 H2SO4",
    requiredComponents: [
      { definitionId: "ion_h", count: 2 },
      { definitionId: "ion_so4", count: 1 },
    ],
    requiresTarget: true,
    result: "VIRTUAL_ATTACK",
    damageKind: "acid",
    damageAmount: 1,
    displayName: "主动 DIY 生成的稀 H2SO4",
  },
  {
    id: "diy_naoh_from_na_oh",
    name: "Na+ + OH- -> 稀 NaOH",
    requiredComponents: [
      { definitionId: "ion_na", count: 1 },
      { definitionId: "ion_oh", count: 1 },
    ],
    requiresTarget: true,
    result: "VIRTUAL_ATTACK",
    damageKind: "base",
    damageAmount: 1,
    displayName: "主动 DIY 生成的稀 NaOH",
  },
  {
    id: "diy_koh_from_k_oh",
    name: "K+ + OH- -> 稀 KOH",
    requiredComponents: [
      { definitionId: "ion_k", count: 1 },
      { definitionId: "ion_oh", count: 1 },
    ],
    requiresTarget: true,
    result: "VIRTUAL_ATTACK",
    damageKind: "base",
    damageAmount: 1,
    displayName: "主动 DIY 生成的稀 KOH",
  },
  {
    id: "diy_limewater_from_ca_2oh",
    name: "Ca2+ + 2OH- -> 石灰水 Ca(OH)2",
    requiredComponents: [
      { definitionId: "ion_ca", count: 1 },
      { definitionId: "ion_oh", count: 2 },
    ],
    requiresTarget: true,
    result: "VIRTUAL_ATTACK",
    damageKind: "base",
    damageAmount: 1,
    displayName: "主动 DIY 生成的石灰水 Ca(OH)2",
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
