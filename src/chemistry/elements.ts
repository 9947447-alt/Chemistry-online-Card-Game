import type { ElementKnowledge, ElementSymbol } from "./types";

export const elementKnowledgeList: readonly ElementKnowledge[] = [
  {
    symbol: "H",
    nameEn: "Hydrogen",
    nameZh: "氢",
    commonValences: [1],
  },
  {
    symbol: "Na",
    nameEn: "Sodium",
    nameZh: "钠",
    commonValences: [1],
  },
  {
    symbol: "K",
    nameEn: "Potassium",
    nameZh: "钾",
    commonValences: [1],
  },
  {
    symbol: "Cu",
    nameEn: "Copper",
    nameZh: "铜",
    commonValences: [1, 2],
  },
  {
    symbol: "Ag",
    nameEn: "Silver",
    nameZh: "银",
    commonValences: [1],
  },
  {
    symbol: "Mg",
    nameEn: "Magnesium",
    nameZh: "镁",
    commonValences: [2],
  },
  {
    symbol: "Ca",
    nameEn: "Calcium",
    nameZh: "钙",
    commonValences: [2],
  },
  {
    symbol: "Ba",
    nameEn: "Barium",
    nameZh: "钡",
    commonValences: [2],
  },
  {
    symbol: "Zn",
    nameEn: "Zinc",
    nameZh: "锌",
    commonValences: [2],
  },
  {
    symbol: "Al",
    nameEn: "Aluminium",
    nameZh: "铝",
    commonValences: [3],
  },
  {
    symbol: "Mn",
    nameEn: "Manganese",
    nameZh: "锰",
    commonValences: [2, 4, 6, 7],
  },
  {
    symbol: "Fe",
    nameEn: "Iron",
    nameZh: "铁",
    commonValences: [2, 3],
  },
  {
    symbol: "F",
    nameEn: "Fluorine",
    nameZh: "氟",
    commonValences: [-1],
  },
  {
    symbol: "Cl",
    nameEn: "Chlorine",
    nameZh: "氯",
    commonValences: [-1, 1, 5, 7],
  },
  {
    symbol: "Br",
    nameEn: "Bromine",
    nameZh: "溴",
    commonValences: [-1],
  },
  {
    symbol: "O",
    nameEn: "Oxygen",
    nameZh: "氧",
    commonValences: [-2],
  },
  {
    symbol: "S",
    nameEn: "Sulfur",
    nameZh: "硫",
    commonValences: [-2, 4, 6],
  },
  {
    symbol: "N",
    nameEn: "Nitrogen",
    nameZh: "氮",
    commonValences: [-3, 2, 3, 4, 5],
  },
  {
    symbol: "P",
    nameEn: "Phosphorus",
    nameZh: "磷",
    commonValences: [-3, 3, 5],
  },
  {
    symbol: "C",
    nameEn: "Carbon",
    nameZh: "碳",
    commonValences: [2, 4],
  },
  {
    symbol: "Si",
    nameEn: "Silicon",
    nameZh: "硅",
    commonValences: [4],
  },
] as const;

export const elementKnowledgeMap: ReadonlyMap<ElementSymbol, ElementKnowledge> =
  new Map(elementKnowledgeList.map((entry) => [entry.symbol, entry]));

export function getElementKnowledge(
  symbol: ElementSymbol | string,
): ElementKnowledge | undefined {
  return elementKnowledgeMap.get(symbol as ElementSymbol);
}
