import { cardDefinitionsById } from "../data/cardDefinitions";
import { diyRecipes } from "../data/diyRecipes";
import { createDIYDamageContext } from "./damageContext";
import type {
  CardDefinitionId,
  CardInstanceId,
  DamageEffect,
  DIYExecutableOutcome,
  DIYSelectionAnalysis,
  GameState,
  Player,
  PlayerId,
  PlayerStatus,
} from "./types";
import { advanceTurnFromReducer, type ShuffleFunction } from "./turnFlow";
import { appendEvent } from "./logEvents";

import {
  addStatusIfMissing,
  getPlayer,
  moveCardFromHandToDiscard,
  replacePlayer,
} from "./resolution";

function removeOwnFire(state: GameState, playerId: PlayerId): GameState {
  const p = getPlayer(state, playerId);
  return p ? replacePlayer(state, playerId, { ...p, statuses: p.statuses.filter((s) => s.statusId !== "FIRE") }) : state;
}

function markDIYUsed(state: GameState, playerId: PlayerId): GameState {
  const p = getPlayer(state, playerId);
  return p ? replacePlayer(state, playerId, { ...p, usedDIYThisCycle: true }) : state;
}

function discardComponents(state: GameState, componentCardInstanceIds: CardInstanceId[]): GameState | undefined {
  let s: GameState | undefined = state;
  for (const id of componentCardInstanceIds) {
    if (!s) return undefined;
    s = moveCardFromHandToDiscard(s, id);
  }
  return s;
}

export function analyzeDIYSelection(
  state: GameState,
  playerId: PlayerId,
  componentCardInstanceIds: readonly CardInstanceId[],
  targetPlayerId?: PlayerId,
): DIYSelectionAnalysis {
  const player = getPlayer(state, playerId);

  const seenIds = new Set<CardInstanceId>();
  const duplicateIds = new Set<CardInstanceId>();
  for (const id of componentCardInstanceIds) {
    if (seenIds.has(id)) {
      duplicateIds.add(id);
    } else {
      seenIds.add(id);
    }
  }

  const invalidCardInstanceIds: CardInstanceId[] = [];
  const recordedInvalid = new Set<CardInstanceId>();
  const recordInvalid = (id: CardInstanceId) => {
    if (!recordedInvalid.has(id)) {
      recordedInvalid.add(id);
      invalidCardInstanceIds.push(id);
    }
  };

  for (const id of componentCardInstanceIds) {
    if (duplicateIds.has(id)) {
      recordInvalid(id);
    }
    const instance = state.cardInstances[id];
    if (!instance) {
      recordInvalid(id);
      continue;
    }
    if (!player || !player.hand.includes(id)) {
      recordInvalid(id);
      continue;
    }
    const definition = cardDefinitionsById.get(instance.definitionId);
    if (!definition || !definition.allowedTimings.includes("diy-component")) {
      recordInvalid(id);
    }
  }

  if (invalidCardInstanceIds.length > 0) {
    return {
      status: "INVALID_SELECTION",
      invalidCardInstanceIds,
    };
  }

  const actualCounts = new Map<CardDefinitionId, number>();
  for (const cardId of componentCardInstanceIds) {
    const defId = state.cardInstances[cardId]!.definitionId;
    actualCounts.set(defId, (actualCounts.get(defId) ?? 0) + 1);
  }

  const matchingRecipes = diyRecipes.filter((recipe) => {
    if (actualCounts.size !== recipe.requiredComponents.length) {
      return false;
    }
    return recipe.requiredComponents.every(
      (req) => actualCounts.get(req.definitionId) === req.count,
    );
  });

  if (matchingRecipes.length === 0) {
    return { status: "NO_RECIPE_MATCH" };
  }

  if (matchingRecipes.length > 1) {
    throw new Error(
      `Registry invariant violation: multiple DIY recipes match the same component signature: ${matchingRecipes.map((r) => r.id).join(", ")}`,
    );
  }

  const matchedRecipe = matchingRecipes[0]!;

  if (matchedRecipe.result === "VIRTUAL_ATTACK") {
    const hasValidDamageKind =
      matchedRecipe.damageKind === "acid" || matchedRecipe.damageKind === "base";
    const hasValidDamageAmount =
      Number.isFinite(matchedRecipe.damageAmount) && matchedRecipe.damageAmount > 0;
    const hasDisplayName =
      typeof matchedRecipe.displayName === "string" && matchedRecipe.displayName.length > 0;

    if (!hasValidDamageKind || !hasValidDamageAmount || !hasDisplayName) {
      throw new Error(
        `Registry invariant violation: VIRTUAL_ATTACK DIY recipe ${matchedRecipe.id} has invalid attack metadata`,
      );
    }
  }

  if (!player || player.eliminated || state.activePlayerId !== playerId) {
    return {
      status: "MATCHED_NOT_EXECUTABLE",
      recipeId: matchedRecipe.id,
      blockerCode: "NOT_ACTIVE_PLAYER",
    };
  }

  if (state.phase !== "mainAction") {
    return {
      status: "MATCHED_NOT_EXECUTABLE",
      recipeId: matchedRecipe.id,
      blockerCode: "INVALID_PHASE",
    };
  }

  if (player.usedDIYThisCycle) {
    return {
      status: "MATCHED_NOT_EXECUTABLE",
      recipeId: matchedRecipe.id,
      blockerCode: "DIY_ALREADY_USED_THIS_CYCLE",
    };
  }

  if (
    matchedRecipe.result === "CO2_REMOVE_OWN_FIRE" ||
    matchedRecipe.result === "H2O_REMOVE_OWN_FIRE"
  ) {
    if (targetPlayerId !== undefined) {
      return {
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: matchedRecipe.id,
        blockerCode: "UNEXPECTED_TARGET",
      };
    }
    const hasFire = player.statuses.some((status) => status.statusId === "FIRE");
    if (!hasFire) {
      return {
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: matchedRecipe.id,
        blockerCode: "OWN_FIRE_REQUIRED",
      };
    }
    return {
      status: "EXECUTABLE",
      recipeId: matchedRecipe.id,
      outcome: { kind: matchedRecipe.result },
    };
  }

  if (matchedRecipe.result === "SO2_APPLY_LEAK") {
    if (targetPlayerId === undefined) {
      return {
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: matchedRecipe.id,
        blockerCode: "TARGET_PLAYER_REQUIRED",
      };
    }
    const target = state.players.find((p) => p.id === targetPlayerId);
    if (!target || target.id === player.id || target.eliminated) {
      return {
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: matchedRecipe.id,
        blockerCode: "TARGET_PLAYER_INVALID",
      };
    }
    return {
      status: "EXECUTABLE",
      recipeId: matchedRecipe.id,
      outcome: {
        kind: "SO2_APPLY_LEAK",
        targetPlayerId: target.id,
      },
    };
  }

  if (matchedRecipe.result === "VIRTUAL_ATTACK") {
    if (targetPlayerId === undefined) {
      return {
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: matchedRecipe.id,
        blockerCode: "TARGET_PLAYER_REQUIRED",
      };
    }
    const target = state.players.find((p) => p.id === targetPlayerId);
    if (!target || target.id === player.id || target.eliminated) {
      return {
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: matchedRecipe.id,
        blockerCode: "TARGET_PLAYER_INVALID",
      };
    }
    return {
      status: "EXECUTABLE",
      recipeId: matchedRecipe.id,
      outcome: {
        kind: "VIRTUAL_ATTACK",
        targetPlayerId: target.id,
        damageKind: matchedRecipe.damageKind,
        damageAmount: matchedRecipe.damageAmount,
      },
    };
  }

  return {
    status: "NO_RECIPE_MATCH",
  };
}

function executeValidatedDIYOutcome(
  state: GameState,
  playerId: PlayerId,
  recipeId: string,
  componentCardInstanceIds: CardInstanceId[],
  outcome: DIYExecutableOutcome,
  shuffle: ShuffleFunction,
): GameState {
  const withComponentsDiscarded = discardComponents(state, componentCardInstanceIds);
  if (!withComponentsDiscarded) {
    return state;
  }

  if (outcome.kind === "CO2_REMOVE_OWN_FIRE" || outcome.kind === "H2O_REMOVE_OWN_FIRE") {
    const withFireRemoved = removeOwnFire(withComponentsDiscarded, playerId);
    const resolved = appendEvent(
      markDIYUsed(withFireRemoved, playerId),
      {
        eventKey: outcome.kind === "CO2_REMOVE_OWN_FIRE" ? "diy_co2_remove_fire" : "diy_h2o_remove_fire",
        params: { playerId },
      },
    );
    return advanceTurnFromReducer(resolved, shuffle);
  }

  if (outcome.kind === "VIRTUAL_ATTACK") {
    const sourceEffect: DamageEffect = {
      type: "DAMAGE",
      context: createDIYDamageContext({
        sourcePlayerId: playerId,
        recipeId,
        targetPlayerId: outcome.targetPlayerId,
        baseAmount: outcome.damageAmount,
        damageKind: outcome.damageKind,
      }),
    };

    return appendEvent(
      {
        ...markDIYUsed(withComponentsDiscarded, playerId),
        phase: "responseWindow",
        pendingResponse: {
          responderId: outcome.targetPlayerId,
          sourceEffect,
          chainDepth: 1,
          effectsAfterPass: [sourceEffect],
        },
      },
      {
        eventKey: "diy_virtual_attack",
        params: {
          playerId,
          recipeId,
          targetId: outcome.targetPlayerId,
          damageKind: outcome.damageKind,
          amount: outcome.damageAmount,
        },
      },
    );
  }

  if (outcome.kind === "SO2_APPLY_LEAK") {
    const withStatus = addStatusIfMissing(
      withComponentsDiscarded,
      outcome.targetPlayerId,
      playerId,
      "SO2_LEAK",
    );
    const resolved = appendEvent(
      markDIYUsed(withStatus, playerId),
      {
        eventKey: "diy_so2_apply_leak",
        params: { actorId: playerId, targetId: outcome.targetPlayerId },
      },
    );

    return advanceTurnFromReducer(resolved, shuffle);
  }

  return state;
}

export function playDIYSelection(
  state: GameState,
  playerId: PlayerId,
  componentCardInstanceIds: CardInstanceId[],
  targetPlayerId: PlayerId | undefined,
  shuffle: ShuffleFunction,
): GameState {
  const analysis = analyzeDIYSelection(state, playerId, componentCardInstanceIds, targetPlayerId);

  if (analysis.status !== "EXECUTABLE") {
    return state;
  }

  return executeValidatedDIYOutcome(
    state,
    playerId,
    analysis.recipeId,
    componentCardInstanceIds,
    analysis.outcome,
    shuffle,
  );
}

export function startActiveDIY(
  state: GameState,
  playerId: PlayerId,
  recipeId: string,
  componentCardInstanceIds: CardInstanceId[],
  targetPlayerId: PlayerId | undefined,
  shuffle: ShuffleFunction,
): GameState {
  const analysis = analyzeDIYSelection(state, playerId, componentCardInstanceIds, targetPlayerId);

  if (analysis.status !== "EXECUTABLE") {
    return state;
  }

  if (analysis.recipeId !== recipeId) {
    return state;
  }

  return executeValidatedDIYOutcome(
    state,
    playerId,
    analysis.recipeId,
    componentCardInstanceIds,
    analysis.outcome,
    shuffle,
  );
}
