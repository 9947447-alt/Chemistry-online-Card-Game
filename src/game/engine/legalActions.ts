import { cardDefinitions } from "../data/cardDefinitions";
import { diyRecipes } from "../data/diyRecipes";
import type {
  GameAction,
  ResolveExperimentCounterattackAction,
} from "./actions";
import {
  getLegalCharacterSkillActions,
  validateCharacterSkillAction,
} from "./characterSkills";
import { analyzeDIYSelection } from "./diy";
import {
  validateExperimentCounterattackAction,
} from "./experimentCounterattack";
import {
  validateHandleStatusWithCard,
  validatePassAction,
  validatePassResponse,
  validatePassStatusHandling,
  validatePlayMainActionCard,
  validatePlayReferenceCard,
  validateRespondWithCard,
} from "./resolution";
import { isValidLaboratoryPreparationConfirmation } from "./turnFlow";
import type {
  CardDefinition,
  CardInstanceId,
  GameState,
  Player,
  PlayerId,
} from "./types";

const definitionsById = new Map<string, CardDefinition>(
  cardDefinitions.map((definition) => [definition.id, definition]),
);

function getPlayer(state: GameState, playerId: PlayerId): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}

function getOtherAlivePlayers(state: GameState, sourcePlayerId: PlayerId): Player[] {
  return state.players.filter(
    (player) => player.id !== sourcePlayerId && !player.eliminated,
  );
}

function getCombinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) {
    return [[]];
  }
  if (items.length < k) {
    return [];
  }
  if (items.length === k) {
    return [[...items]];
  }

  const [head, ...tail] = items;
  const withHead = getCombinations(tail, k - 1).map((combo) => [head, ...combo]);
  const withoutHead = getCombinations(tail, k);
  return [...withHead, ...withoutHead];
}

const registeredDiyComponentSizes: readonly number[] = Array.from(
  new Set(
    diyRecipes.map((recipe) =>
      recipe.requiredComponents.reduce((sum, req) => sum + req.count, 0),
    ),
  ),
).sort((a, b) => a - b);

export function validatePlayDiySelectionAction(
  state: GameState,
  playerId: PlayerId,
  componentCardInstanceIds: readonly CardInstanceId[],
  targetPlayerId?: PlayerId,
): boolean {
  const analysis = analyzeDIYSelection(
    state,
    playerId,
    componentCardInstanceIds,
    targetPlayerId,
  );
  return analysis.status === "EXECUTABLE";
}

export {
  validatePassAction,
  validatePlayReferenceCard as validatePlayReferenceCardAction,
  validatePlayMainActionCard as validatePlayCardAction,
  validateRespondWithCard as validateRespondWithCardAction,
  validatePassResponse as validatePassResponseAction,
  validateHandleStatusWithCard as validateHandleStatusWithCardAction,
  validatePassStatusHandling as validatePassStatusHandlingAction,
  validateExperimentCounterattackAction,
  validateCharacterSkillAction,
};

export function validateGameAction(state: GameState, action: GameAction): boolean {
  if (state.phase === "gameOver") {
    return false;
  }

  switch (action.type) {
    case "PASS_ACTION":
      return validatePassAction(state, action.playerId);
    case "PLAY_REFERENCE_CARD":
      return validatePlayReferenceCard(state, action.playerId, action.cardInstanceId);
    case "PLAY_CARD":
      return validatePlayMainActionCard(
        state,
        action.playerId,
        action.cardInstanceId,
        action.targetPlayerId,
      );
    case "ACTIVATE_CHARACTER_SKILL":
      return validateCharacterSkillAction(state, action);
    case "PLAY_DIY_SELECTION":
      return validatePlayDiySelectionAction(
        state,
        action.playerId,
        action.componentCardInstanceIds,
        action.targetPlayerId,
      );
    case "START_ACTIVE_DIY":
      return false;
    case "RESPOND_WITH_CARD":
      return validateRespondWithCard(state, action.playerId, action.cardInstanceId);
    case "PASS_RESPONSE":
      return validatePassResponse(state, action.playerId);
    case "HANDLE_STATUS_WITH_CARD":
      return validateHandleStatusWithCard(
        state,
        action.playerId,
        action.statusInstanceId,
        action.cardInstanceId,
      );
    case "PASS_STATUS_HANDLING":
      return validatePassStatusHandling(
        state,
        action.playerId,
        action.statusInstanceId,
      );
    case "RESOLVE_EXPERIMENT_COUNTERATTACK":
      return validateExperimentCounterattackAction(state, action);
    case "CONFIRM_LABORATORY_PREPARATION":
      return isValidLaboratoryPreparationConfirmation(
        state,
        action.playerId,
        [...action.keptCardInstanceIds],
      );
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}

export function getLegalActions(state: GameState, playerId: PlayerId): GameAction[] {
  if (state.phase === "gameOver" || state.phase === "preparationSelection") {
    return [];
  }

  const player = getPlayer(state, playerId);
  if (!player || player.eliminated) {
    return [];
  }

  if (state.phase === "mainAction") {
    if (state.activePlayerId !== playerId) {
      return [];
    }

    const legalActions: GameAction[] = [];

    if (validatePassAction(state, playerId)) {
      legalActions.push({ type: "PASS_ACTION", playerId });
    }

    const aliveOpponents = getOtherAlivePlayers(state, playerId);

    for (const cardInstanceId of player.hand) {
      const instance = state.cardInstances[cardInstanceId];
      const definition = instance ? definitionsById.get(instance.definitionId) : undefined;
      if (!definition) {
        continue;
      }

      if (definition.allowedTimings.includes("main-action")) {
        if (definition.id === "substance_o2") {
          if (validatePlayMainActionCard(state, playerId, cardInstanceId, playerId)) {
            legalActions.push({
              type: "PLAY_CARD",
              playerId,
              cardInstanceId,
              targetPlayerId: playerId,
            });
          }
        } else {
          for (const opponent of aliveOpponents) {
            if (validatePlayMainActionCard(state, playerId, cardInstanceId, opponent.id)) {
              legalActions.push({
                type: "PLAY_CARD",
                playerId,
                cardInstanceId,
                targetPlayerId: opponent.id,
              });
            }
          }
        }
      }

      if (validatePlayReferenceCard(state, playerId, cardInstanceId)) {
        legalActions.push({
          type: "PLAY_REFERENCE_CARD",
          playerId,
          cardInstanceId,
        });
      }
    }

    const skillActions = getLegalCharacterSkillActions(state, playerId);
    legalActions.push(...skillActions);

    if (!player.usedDIYThisCycle) {
      for (const size of registeredDiyComponentSizes) {
        if (size <= player.hand.length) {
          const combinations = getCombinations(player.hand, size);
          for (const combo of combinations) {
            if (validatePlayDiySelectionAction(state, playerId, combo, undefined)) {
              legalActions.push({
                type: "PLAY_DIY_SELECTION",
                playerId,
                componentCardInstanceIds: combo,
              });
            }

            for (const opponent of aliveOpponents) {
              if (validatePlayDiySelectionAction(state, playerId, combo, opponent.id)) {
                legalActions.push({
                  type: "PLAY_DIY_SELECTION",
                  playerId,
                  componentCardInstanceIds: combo,
                  targetPlayerId: opponent.id,
                });
              }
            }
          }
        }
      }
    }

    return legalActions;
  }

  if (state.phase === "responseWindow") {
    const expectedResponderId = state.pendingResponse?.responderId;
    if (expectedResponderId !== playerId) {
      return [];
    }

    const legalActions: GameAction[] = [];

    for (const cardInstanceId of player.hand) {
      if (validateRespondWithCard(state, playerId, cardInstanceId)) {
        legalActions.push({
          type: "RESPOND_WITH_CARD",
          playerId,
          cardInstanceId,
        });
      }
    }

    if (validatePassResponse(state, playerId)) {
      legalActions.push({ type: "PASS_RESPONSE", playerId });
    }

    return legalActions;
  }

  if (state.phase === "statusWindow" && state.activePlayerId === playerId) {
    const pending = state.pendingStatusHandling;
    if (!pending || pending.playerId !== playerId) {
      return [];
    }

    const legalActions: GameAction[] = [];

    for (const cardInstanceId of player.hand) {
      if (
        validateHandleStatusWithCard(
          state,
          playerId,
          pending.statusInstanceId,
          cardInstanceId,
        )
      ) {
        legalActions.push({
          type: "HANDLE_STATUS_WITH_CARD",
          playerId,
          statusInstanceId: pending.statusInstanceId,
          cardInstanceId,
        });
      }
    }

    if (validatePassStatusHandling(state, playerId, pending.statusInstanceId)) {
      legalActions.push({
        type: "PASS_STATUS_HANDLING",
        playerId,
        statusInstanceId: pending.statusInstanceId,
      });
    }

    return legalActions;
  }

  if (state.phase === "experimentCounterattackWindow") {
    const pending = state.pendingExperimentCounterattack;
    if (!pending || pending.responderPlayerId !== playerId) {
      return [];
    }

    const legalActions: GameAction[] = [];

    const recoverAction: ResolveExperimentCounterattackAction = {
      type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
      playerId,
      option: "recover",
    };
    if (validateExperimentCounterattackAction(state, recoverAction)) {
      legalActions.push(recoverAction);
    }

    for (const cardInstanceId of pending.legalPursuitCardInstanceIds) {
      const pursuitAction: ResolveExperimentCounterattackAction = {
        type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
        playerId,
        option: "acid-base-pursuit",
        cardInstanceId,
      };
      if (validateExperimentCounterattackAction(state, pursuitAction)) {
        legalActions.push(pursuitAction);
      }
    }

    return legalActions;
  }

  return [];
}
