export type ElementSymbol =
  | "H"
  | "Na"
  | "K"
  | "Cu"
  | "Ag"
  | "Mg"
  | "Ca"
  | "Ba"
  | "Zn"
  | "Al"
  | "Mn"
  | "Fe"
  | "F"
  | "Cl"
  | "Br"
  | "O"
  | "S"
  | "N"
  | "P"
  | "C"
  | "Si";

export interface ElementKnowledge {
  readonly symbol: ElementSymbol;
  readonly nameZh: string;
  readonly nameEn: string;
  readonly commonValences: readonly number[];
}

export type RadicalFormula = "OH" | "NO3" | "CO3" | "SO4" | "NH4";

export interface RadicalKnowledge {
  readonly formula: RadicalFormula;
  readonly nameZh: string;
  readonly nameEn: string;
  readonly charge: number;
}

export type NeutralElementalComponentSpeciesId =
  | "species_c"
  | "species_o"
  | "species_s";

export type IonSpeciesId =
  | "species_ion_h"
  | "species_ion_na"
  | "species_ion_k"
  | "species_ion_ca"
  | "species_ion_cl"
  | "species_ion_oh"
  | "species_ion_co3"
  | "species_ion_so4"
  | "species_ion_no3"
  | "species_ion_nh4";

export type ChemicalSpeciesId =
  | NeutralElementalComponentSpeciesId
  | IonSpeciesId;

export type ChemicalSpeciesKind = "neutral_elemental_component" | "ion";

export interface NeutralElementalComponentSpecies {
  readonly id: NeutralElementalComponentSpeciesId;
  readonly kind: "neutral_elemental_component";
  readonly formula: "C" | "O" | "S";
  readonly charge: 0;
  readonly nameZh: string;
  readonly nameEn: string;
}

export interface IonSpecies {
  readonly id: IonSpeciesId;
  readonly kind: "ion";
  readonly formula: string;
  readonly charge: number;
  readonly nameZh: string;
  readonly nameEn: string;
}

export type ChemicalSpecies =
  | NeutralElementalComponentSpecies
  | IonSpecies;
