import type {
  ChemicalSpecies,
  ChemicalSpeciesId,
  IonSpecies,
  NeutralElementalComponentSpecies,
} from "./types";

export const chemicalSpeciesList: readonly ChemicalSpecies[] = [
  {
    id: "species_c",
    kind: "neutral_elemental_component",
    formula: "C",
    charge: 0,
    nameZh: "碳单质组件",
    nameEn: "Carbon elemental component",
  },
  {
    id: "species_o",
    kind: "neutral_elemental_component",
    formula: "O",
    charge: 0,
    nameZh: "氧单质组件",
    nameEn: "Oxygen elemental component",
  },
  {
    id: "species_s",
    kind: "neutral_elemental_component",
    formula: "S",
    charge: 0,
    nameZh: "硫单质组件",
    nameEn: "Sulfur elemental component",
  },
  {
    id: "species_ion_h",
    kind: "ion",
    formula: "H+",
    charge: 1,
    nameZh: "氢离子",
    nameEn: "Hydrogen ion",
  },
  {
    id: "species_ion_na",
    kind: "ion",
    formula: "Na+",
    charge: 1,
    nameZh: "钠离子",
    nameEn: "Sodium ion",
  },
  {
    id: "species_ion_k",
    kind: "ion",
    formula: "K+",
    charge: 1,
    nameZh: "钾离子",
    nameEn: "Potassium ion",
  },
  {
    id: "species_ion_ca",
    kind: "ion",
    formula: "Ca2+",
    charge: 2,
    nameZh: "钙离子",
    nameEn: "Calcium ion",
  },
  {
    id: "species_ion_cl",
    kind: "ion",
    formula: "Cl-",
    charge: -1,
    nameZh: "氯离子",
    nameEn: "Chloride ion",
  },
  {
    id: "species_ion_oh",
    kind: "ion",
    formula: "OH-",
    charge: -1,
    nameZh: "氢氧根离子",
    nameEn: "Hydroxide ion",
  },
  {
    id: "species_ion_co3",
    kind: "ion",
    formula: "CO3^2-",
    charge: -2,
    nameZh: "碳酸根离子",
    nameEn: "Carbonate ion",
  },
  {
    id: "species_ion_so4",
    kind: "ion",
    formula: "SO4^2-",
    charge: -2,
    nameZh: "硫酸根离子",
    nameEn: "Sulfate ion",
  },
  {
    id: "species_ion_no3",
    kind: "ion",
    formula: "NO3-",
    charge: -1,
    nameZh: "硝酸根离子",
    nameEn: "Nitrate ion",
  },
  {
    id: "species_ion_nh4",
    kind: "ion",
    formula: "NH4+",
    charge: 1,
    nameZh: "铵根离子",
    nameEn: "Ammonium ion",
  },
] as const;

export const chemicalSpeciesMap: ReadonlyMap<ChemicalSpeciesId, ChemicalSpecies> =
  new Map(chemicalSpeciesList.map((entry) => [entry.id, entry]));

export function getChemicalSpecies(
  id: ChemicalSpeciesId | string,
): ChemicalSpecies | undefined {
  return chemicalSpeciesMap.get(id as ChemicalSpeciesId);
}

export function isNeutralElementalComponentSpecies(
  species: ChemicalSpecies,
): species is NeutralElementalComponentSpecies {
  return species.kind === "neutral_elemental_component";
}

export function isIonSpecies(species: ChemicalSpecies): species is IonSpecies {
  return species.kind === "ion";
}
