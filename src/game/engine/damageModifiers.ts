import { cardDefinitions } from "../data/cardDefinitions";
import { diyRecipes } from "../data/diyRecipes";
import type { DamageModifierSet, DamageModifierSource } from "./damage";
import type {
  CharacterSkillId,
  CardDefinition,
  DamageContext,
  DamageSource,
  GameState,
  Player,
  PlayerId,
} from "./types";

const definitionsById = new Map<string, CardDefinition>(
  cardDefinitions.map((definition) => [definition.id, definition]),
);
const diyRecipesById = new Map(diyRecipes.map((recipe) => [recipe.id, recipe]));

function getEligiblePlayer(state: GameState, playerId: PlayerId): Player | undefined {
  const player = state.players.find((candidate) => candidate.id === playerId);
  return player && !player.eliminated ? player : undefined;
}

function createSkillSource(
  sourcePlayerId: PlayerId,
  skillId: CharacterSkillId,
): DamageModifierSource {
  return {
    kind: "character-skill",
    sourcePlayerId,
    skillId,
  };
}

function isRealMatchingCardSource(state: GameState, source: DamageSource): boolean {
  if (source.kind !== "card") {
    return false;
  }

  const instance = state.cardInstances[source.cardInstanceId];
  return instance?.definitionId === source.cardDefinitionId;
}

function collectSourceModifier(
  state: GameState,
  context: DamageContext,
): Pick<DamageModifierSet, "setValue" | "increase"> {
  const source = context.source;

  if (source.kind === "status") {
    return {};
  }

  const attacker = getEligiblePlayer(state, source.sourcePlayerId);
  if (!attacker) {
    return {};
  }

  if (source.kind === "diy") {
    const recipe = diyRecipesById.get(source.recipeId);
    const isLegalDamageDIY = recipe?.result === "VIRTUAL_ATTACK";
    const isCurrentPendingDIY =
      state.phase === "responseWindow" &&
      state.pendingResponse?.sourceEffect.context === context;

    if (
      attacker.characterId === "chemistry_enthusiast" &&
      attacker.usedDIYThisCycle &&
      isLegalDamageDIY &&
      isCurrentPendingDIY
    ) {
      return {
        increase: {
          source: createSkillSource(attacker.id, "diy_experiment"),
          amount: 1,
        },
      };
    }

    return {};
  }

  if (source.kind !== "card" || !isRealMatchingCardSource(state, source)) {
    return {};
  }

  const definition = definitionsById.get(source.cardDefinitionId);
  if (!definition || definition.type !== "substance") {
    return {};
  }

  if (
    attacker.characterId === "acid_king" &&
    context.tags.includes("strong-acid") &&
    definition.tags.includes("strong-acid") &&
    !definition.tags.includes("harmful-gas")
  ) {
    return {
      setValue: {
        source: createSkillSource(attacker.id, "acid_corrosion"),
        amount: 3,
      },
    };
  }

  if (
    attacker.characterId === "caustic_soda_captain" &&
    context.tags.includes("strong-alkali") &&
    definition.tags.includes("strong-alkali")
  ) {
    return {
      increase: {
        source: createSkillSource(attacker.id, "strong_alkali_mastery"),
        amount: 1,
      },
    };
  }

  if (
    attacker.characterId === "sulfuric_acid_factory_director" &&
    source.cardDefinitionId === "substance_h2so4_dilute"
  ) {
    return {
      increase: {
        source: createSkillSource(attacker.id, "sulfuric_acid_process"),
        amount: 1,
      },
    };
  }

  return {};
}

function collectTargetModifier(
  state: GameState,
  context: DamageContext,
): Pick<DamageModifierSet, "immunity" | "reduction" | "minimum"> {
  const target = getEligiblePlayer(state, context.targetPlayerId);
  if (!target) {
    return {};
  }

  if (
    target.characterId === "caustic_soda_captain" &&
    context.tags.includes("base")
  ) {
    return {
      immunity: {
        source: createSkillSource(target.id, "strong_alkali_protection"),
      },
    };
  }

  if (target.characterId === "acid_king" && context.tags.includes("acid")) {
    const source = createSkillSource(target.id, "acid_resistant_layer");
    return {
      reduction: { source, amount: 1 },
      minimum: { source, amount: 1 },
    };
  }

  return {};
}

export function collectDamageModifiers(
  state: GameState,
  context: DamageContext,
): DamageModifierSet {
  return {
    ...collectSourceModifier(state, context),
    ...collectTargetModifier(state, context),
  };
}
