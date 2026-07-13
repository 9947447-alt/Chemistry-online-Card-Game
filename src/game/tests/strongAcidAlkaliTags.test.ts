import { describe, expect, it } from "vitest";
import { cardDefinitions } from "../data/cardDefinitions";
import { diyRecipes } from "../data/diyRecipes";
import type { CardDefinition } from "../engine/types";

const definitionsById = new Map<string, CardDefinition>(
  cardDefinitions.map((definition) => [definition.id, definition]),
);
const allCardDefinitions: readonly CardDefinition[] = cardDefinitions;

function getDefinition(id: string): CardDefinition {
  const definition = definitionsById.get(id);

  if (!definition) {
    throw new Error(`Missing card definition: ${id}`);
  }

  return definition;
}

describe("Phase 8C-0A entity strong acid and strong alkali tags", () => {
  it.each([
    ["substance_hcl_dilute", "acid", "strong-acid"],
    ["substance_h2so4_dilute", "acid", "strong-acid"],
    ["substance_naoh_dilute", "base", "strong-alkali"],
    ["substance_koh_dilute", "base", "strong-alkali"],
    ["substance_caoh2_limewater", "base", "strong-alkali"],
  ] as const)("gives %s both %s and %s", (definitionId, existingTag, strongTag) => {
    expect(getDefinition(definitionId).tags).toEqual(
      expect.arrayContaining([existingTag, strongTag]),
    );
  });

  it("limits strong-acid to the two frozen entity definitions", () => {
    expect(
      allCardDefinitions
        .filter((definition) => definition.tags.includes("strong-acid"))
        .map((definition) => definition.id),
    ).toEqual(["substance_hcl_dilute", "substance_h2so4_dilute"]);
  });

  it("limits strong-alkali to the three frozen entity definitions", () => {
    expect(
      allCardDefinitions
        .filter((definition) => definition.tags.includes("strong-alkali"))
        .map((definition) => definition.id),
    ).toEqual([
      "substance_naoh_dilute",
      "substance_koh_dilute",
      "substance_caoh2_limewater",
    ]);
  });

  it("excludes ions and elements from both entity substance tags", () => {
    const ionAndElementDefinitions = allCardDefinitions.filter(
      (definition) => definition.type === "ion" || definition.type === "element",
    );

    expect(ionAndElementDefinitions.length).toBeGreaterThan(0);
    for (const definition of ionAndElementDefinitions) {
      expect(definition.tags, definition.id).not.toContain("strong-acid");
      expect(definition.tags, definition.id).not.toContain("strong-alkali");
    }

    expect(getDefinition("ion_h").tags).not.toContain("strong-acid");
    expect(getDefinition("ion_oh").tags).not.toContain("strong-alkali");
  });

  it("excludes named non-mapped cards from both entity substance tags", () => {
    for (const definitionId of [
      "substance_h2o",
      "substance_o2",
      "substance_co2",
      "substance_so2",
      "substance_na2co3",
      "event_lab_fire",
    ]) {
      const definition = getDefinition(definitionId);

      expect(definition.tags, definition.id).not.toContain("strong-acid");
      expect(definition.tags, definition.id).not.toContain("strong-alkali");
    }
  });

  it("keeps same-named virtual DIY attacks independent from entity definition tags", () => {
    const virtualAttackRecipes = diyRecipes.filter(
      (recipe) => recipe.result === "VIRTUAL_ATTACK",
    );

    expect(
      virtualAttackRecipes.map((recipe) => [recipe.id, recipe.damageKind]),
    ).toEqual([
      ["diy_hcl_from_h_cl", "acid"],
      ["diy_h2so4_from_2h_so4", "acid"],
      ["diy_naoh_from_na_oh", "base"],
      ["diy_koh_from_k_oh", "base"],
      ["diy_limewater_from_ca_2oh", "base"],
    ]);

    for (const recipe of virtualAttackRecipes) {
      expect(Object.hasOwn(recipe, "tags"), recipe.id).toBe(false);
      expect(Object.hasOwn(recipe, "resultDefinitionId"), recipe.id).toBe(false);
    }
  });
});
