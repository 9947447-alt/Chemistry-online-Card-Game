import { describe, expect, it } from "vitest";
import {
  chemicalSpeciesList,
  chemicalSpeciesMap,
  elementKnowledgeList,
  elementKnowledgeMap,
  getChemicalSpecies,
  getElementKnowledge,
  getRadicalKnowledge,
  isIonSpecies,
  isNeutralElementalComponentSpecies,
  radicalKnowledgeList,
  radicalKnowledgeMap,
} from "./index";

describe("Phase 18C: Junior Chemistry Data Foundation", () => {
  describe("Element Knowledge Registry (Freeze Section 3.1)", () => {
    it("contains exactly 21 elements", () => {
      expect(elementKnowledgeList).toHaveLength(21);
      expect(elementKnowledgeMap.size).toBe(21);
    });

    it("has unique element symbols", () => {
      const symbols = elementKnowledgeList.map((e) => e.symbol);
      const uniqueSymbols = new Set(symbols);
      expect(uniqueSymbols.size).toBe(21);
    });

    it("matches authoritative element definitions and common valences", () => {
      const expectedElements = [
        { symbol: "H", nameEn: "Hydrogen", nameZh: "氢", commonValences: [1] },
        { symbol: "Na", nameEn: "Sodium", nameZh: "钠", commonValences: [1] },
        { symbol: "K", nameEn: "Potassium", nameZh: "钾", commonValences: [1] },
        { symbol: "Cu", nameEn: "Copper", nameZh: "铜", commonValences: [1, 2] },
        { symbol: "Ag", nameEn: "Silver", nameZh: "银", commonValences: [1] },
        { symbol: "Mg", nameEn: "Magnesium", nameZh: "镁", commonValences: [2] },
        { symbol: "Ca", nameEn: "Calcium", nameZh: "钙", commonValences: [2] },
        { symbol: "Ba", nameEn: "Barium", nameZh: "钡", commonValences: [2] },
        { symbol: "Zn", nameEn: "Zinc", nameZh: "锌", commonValences: [2] },
        { symbol: "Al", nameEn: "Aluminium", nameZh: "铝", commonValences: [3] },
        {
          symbol: "Mn",
          nameEn: "Manganese",
          nameZh: "锰",
          commonValences: [2, 4, 6, 7],
        },
        { symbol: "Fe", nameEn: "Iron", nameZh: "铁", commonValences: [2, 3] },
        { symbol: "F", nameEn: "Fluorine", nameZh: "氟", commonValences: [-1] },
        {
          symbol: "Cl",
          nameEn: "Chlorine",
          nameZh: "氯",
          commonValences: [-1, 1, 5, 7],
        },
        { symbol: "Br", nameEn: "Bromine", nameZh: "溴", commonValences: [-1] },
        { symbol: "O", nameEn: "Oxygen", nameZh: "氧", commonValences: [-2] },
        { symbol: "S", nameEn: "Sulfur", nameZh: "硫", commonValences: [-2, 4, 6] },
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
        { symbol: "C", nameEn: "Carbon", nameZh: "碳", commonValences: [2, 4] },
        { symbol: "Si", nameEn: "Silicon", nameZh: "硅", commonValences: [4] },
      ];

      expect(elementKnowledgeList).toEqual(expectedElements);

      for (const item of expectedElements) {
        const found = getElementKnowledge(item.symbol);
        expect(found).toBeDefined();
        expect(found).toEqual(item);
      }
    });

    it("returns undefined for unknown element symbols", () => {
      expect(getElementKnowledge("Xx")).toBeUndefined();
      expect(getElementKnowledge("Gold")).toBeUndefined();
      expect(getElementKnowledge("")).toBeUndefined();
    });
  });

  describe("Radical Knowledge Registry (Freeze Section 3.2)", () => {
    it("contains exactly 5 radicals", () => {
      expect(radicalKnowledgeList).toHaveLength(5);
      expect(radicalKnowledgeMap.size).toBe(5);
    });

    it("has unique radical formulas", () => {
      const formulas = radicalKnowledgeList.map((r) => r.formula);
      const uniqueFormulas = new Set(formulas);
      expect(uniqueFormulas.size).toBe(5);
    });

    it("matches authoritative radical definitions and charges", () => {
      const expectedRadicals = [
        { formula: "OH", nameZh: "氢氧根", nameEn: "Hydroxide", charge: -1 },
        { formula: "NO3", nameZh: "硝酸根", nameEn: "Nitrate", charge: -1 },
        { formula: "CO3", nameZh: "碳酸根", nameEn: "Carbonate", charge: -2 },
        { formula: "SO4", nameZh: "硫酸根", nameEn: "Sulfate", charge: -2 },
        { formula: "NH4", nameZh: "铵根", nameEn: "Ammonium", charge: 1 },
      ];

      expect(radicalKnowledgeList).toEqual(expectedRadicals);

      for (const item of expectedRadicals) {
        const found = getRadicalKnowledge(item.formula);
        expect(found).toBeDefined();
        expect(found).toEqual(item);
      }
    });

    it("returns undefined for unknown radical formulas", () => {
      expect(getRadicalKnowledge("PO4")).toBeUndefined();
      expect(getRadicalKnowledge("HCO3")).toBeUndefined();
      expect(getRadicalKnowledge("")).toBeUndefined();
    });
  });

  describe("Chemical Species Registry Seed (Freeze Section 3.3)", () => {
    it("contains exactly 13 explicit species", () => {
      expect(chemicalSpeciesList).toHaveLength(13);
      expect(chemicalSpeciesMap.size).toBe(13);
    });

    it("has unique species IDs", () => {
      const ids = chemicalSpeciesList.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(13);
    });

    it("matches authoritative neutral elemental component species", () => {
      const neutralComponents = chemicalSpeciesList.filter(
        isNeutralElementalComponentSpecies,
      );
      expect(neutralComponents).toHaveLength(3);

      expect(getChemicalSpecies("species_c")).toEqual({
        id: "species_c",
        kind: "neutral_elemental_component",
        formula: "C",
        charge: 0,
        nameZh: "碳单质组件",
        nameEn: "Carbon elemental component",
      });

      expect(getChemicalSpecies("species_o")).toEqual({
        id: "species_o",
        kind: "neutral_elemental_component",
        formula: "O",
        charge: 0,
        nameZh: "氧单质组件",
        nameEn: "Oxygen elemental component",
      });

      expect(getChemicalSpecies("species_s")).toEqual({
        id: "species_s",
        kind: "neutral_elemental_component",
        formula: "S",
        charge: 0,
        nameZh: "硫单质组件",
        nameEn: "Sulfur elemental component",
      });
    });

    it("strictly differentiates species_o (O elemental component) from O2 gas substance", () => {
      const speciesO = getChemicalSpecies("species_o");
      expect(speciesO).toBeDefined();
      expect(speciesO?.formula).toBe("O");
      expect(speciesO?.charge).toBe(0);
      expect(speciesO?.formula).not.toBe("O2");
    });

    it("matches authoritative explicit ion species", () => {
      const ions = chemicalSpeciesList.filter(isIonSpecies);
      expect(ions).toHaveLength(10);

      const expectedIons = [
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
      ];

      for (const expected of expectedIons) {
        const found = getChemicalSpecies(expected.id);
        expect(found).toBeDefined();
        expect(found).toEqual(expected);
      }
    });

    it("returns undefined for unknown species IDs", () => {
      expect(getChemicalSpecies("species_fe")).toBeUndefined();
      expect(getChemicalSpecies("species_ion_fe2")).toBeUndefined();
      expect(getChemicalSpecies("species_ion_fe3")).toBeUndefined();
      expect(getChemicalSpecies("species_ion_cu2")).toBeUndefined();
      expect(getChemicalSpecies("species_ion_mg2")).toBeUndefined();
      expect(getChemicalSpecies("species_ion_al3")).toBeUndefined();
      expect(getChemicalSpecies("species_ion_f")).toBeUndefined();
      expect(getChemicalSpecies("species_ion_br")).toBeUndefined();
    });
  });

  describe("Four-Dimensional Isolation Guardrails (Freeze Section 4 & 5)", () => {
    it("ensures unapproved species are NOT synthesized from commonValences", () => {
      // Element knowledge contains Fe (+2, +3), Cu (+1, +2), Al (+3), etc.
      const feKnowledge = getElementKnowledge("Fe");
      expect(feKnowledge?.commonValences).toEqual([2, 3]);

      // But species registry must NOT contain unapproved ion species
      const allSpeciesIds = new Set(chemicalSpeciesList.map((s) => s.id));
      expect(allSpeciesIds.has("species_ion_fe2" as any)).toBe(false);
      expect(allSpeciesIds.has("species_ion_fe3" as any)).toBe(false);
      expect(allSpeciesIds.has("species_ion_cu" as any)).toBe(false);
      expect(allSpeciesIds.has("species_ion_cu2" as any)).toBe(false);
      expect(allSpeciesIds.has("species_ion_mg" as any)).toBe(false);
      expect(allSpeciesIds.has("species_ion_mg2" as any)).toBe(false);
      expect(allSpeciesIds.has("species_ion_al3" as any)).toBe(false);
      expect(allSpeciesIds.has("species_ion_ag" as any)).toBe(false);
      expect(allSpeciesIds.has("species_ion_ba2" as any)).toBe(false);
      expect(allSpeciesIds.has("species_ion_f" as any)).toBe(false);
      expect(allSpeciesIds.has("species_ion_br" as any)).toBe(false);
    });

    it("ensures NO3- and NH4+ exist in Chemistry registry as explicit species", () => {
      // NO3- and NH4+ are in Layer 1 Chemistry Species
      const no3 = getChemicalSpecies("species_ion_no3");
      expect(no3).toBeDefined();
      expect(no3).toEqual({
        id: "species_ion_no3",
        kind: "ion",
        formula: "NO3-",
        charge: -1,
        nameZh: "硝酸根离子",
        nameEn: "Nitrate ion",
      });

      const nh4 = getChemicalSpecies("species_ion_nh4");
      expect(nh4).toBeDefined();
      expect(nh4).toEqual({
        id: "species_ion_nh4",
        kind: "ion",
        formula: "NH4+",
        charge: 1,
        nameZh: "铵根离子",
        nameEn: "Ammonium ion",
      });
    });

    it("ensures all chemistry registries initialize and query independently", () => {
      // Elements can be queried
      expect(elementKnowledgeList.length).toBe(21);
      expect(getElementKnowledge("H")).toBeDefined();
      expect(getElementKnowledge("Si")).toBeDefined();

      // Radicals can be queried
      expect(radicalKnowledgeList.length).toBe(5);
      expect(getRadicalKnowledge("OH")).toBeDefined();
      expect(getRadicalKnowledge("NH4")).toBeDefined();

      // Species can be queried
      expect(chemicalSpeciesList.length).toBe(13);
      expect(getChemicalSpecies("species_c")).toBeDefined();
      expect(getChemicalSpecies("species_ion_nh4")).toBeDefined();
    });
  });
});
