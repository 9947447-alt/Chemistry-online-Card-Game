import type { RadicalFormula, RadicalKnowledge } from "./types";

export const radicalKnowledgeList: readonly RadicalKnowledge[] = [
  {
    formula: "OH",
    nameZh: "氢氧根",
    nameEn: "Hydroxide",
    charge: -1,
  },
  {
    formula: "NO3",
    nameZh: "硝酸根",
    nameEn: "Nitrate",
    charge: -1,
  },
  {
    formula: "CO3",
    nameZh: "碳酸根",
    nameEn: "Carbonate",
    charge: -2,
  },
  {
    formula: "SO4",
    nameZh: "硫酸根",
    nameEn: "Sulfate",
    charge: -2,
  },
  {
    formula: "NH4",
    nameZh: "铵根",
    nameEn: "Ammonium",
    charge: 1,
  },
] as const;

export const radicalKnowledgeMap: ReadonlyMap<RadicalFormula, RadicalKnowledge> =
  new Map(radicalKnowledgeList.map((entry) => [entry.formula, entry]));

export function getRadicalKnowledge(
  formula: RadicalFormula | string,
): RadicalKnowledge | undefined {
  return radicalKnowledgeMap.get(formula as RadicalFormula);
}
