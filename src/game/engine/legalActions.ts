import { diyRecipes } from "../data/diyRecipes";
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
import type { GameAction, ResolveExperimentCounterattackAction } from "./actions";
import type { CardInstanceId, GameState, Player, PlayerId } from "./types";

function getPlayer(state: GameState, playerId: PlayerId): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}

function getOtherAlivePlayers(state: GameState, sourcePlayerId: PlayerId): Player[] {
  return state.players.filter(
    (player) => player.id !== sourcePlayerId && !player.eliminated,
  );
}

const registeredDiyComponentSizes = [...new Set(
  diyRecipes.map((recipe) =>
    recipe.requiredComponents.reduce((total, component) => total + component.count, 0),
  ),
)].sort((left, right) => left - right);

function getCombinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  if (items.length === k) return [[...items]];
  const [head, ...tail] = items;
  return [...getCombinations(tail, k - 1).map((c) => [head, ...c]), ...getCombinations(tail, k)];
}

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
  getLegalCharacterSkillActions,
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
    const candidateTargetPlayerIds = [
      undefined,
      ...state.players.filter((candidate) => !candidate.eliminated).map((candidate) => candidate.id),
    ];

    for (const cardInstanceId of player.hand) {
      for (const targetPlayerId of candidateTargetPlayerIds) {
        if (validatePlayMainActionCard(state, playerId, cardInstanceId, targetPlayerId)) {
          legalActions.push({
            type: "PLAY_CARD",
            playerId,
            cardInstanceId,
            ...(targetPlayerId === undefined ? {} : { targetPlayerId }),
          });
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
          for (const combo of getCombinations(player.hand, size)) {
            for (const target of [undefined, ...aliveOpponents]) {
              if (validatePlayDiySelectionAction(state, playerId, combo, target?.id)) {
                legalActions.push({
                  type: "PLAY_DIY_SELECTION",
                  playerId,
                  componentCardInstanceIds: combo,
                  ...(target ? { targetPlayerId: target.id } : {}),
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
    if (state.pendingResponse?.responderId !== playerId) return [];
    const legalActions: GameAction[] = [];
    for (const cardInstanceId of player.hand) {
      if (validateRespondWithCard(state, playerId, cardInstanceId)) {
        legalActions.push({ type: "RESPOND_WITH_CARD", playerId, cardInstanceId });
      }
    }
    if (validatePassResponse(state, playerId)) {
      legalActions.push({ type: "PASS_RESPONSE", playerId });
    }
    return legalActions;
  }

  if (state.phase === "statusWindow" && state.activePlayerId === playerId) {
    const pending = state.pendingStatusHandling;
    if (!pending || pending.playerId !== playerId) return [];
    const legalActions: GameAction[] = [];
    for (const cardInstanceId of player.hand) {
      if (validateHandleStatusWithCard(state, playerId, pending.statusInstanceId, cardInstanceId)) {
        legalActions.push({ type: "HANDLE_STATUS_WITH_CARD", playerId, statusInstanceId: pending.statusInstanceId, cardInstanceId });
      }
    }
    if (validatePassStatusHandling(state, playerId, pending.statusInstanceId)) {
      legalActions.push({ type: "PASS_STATUS_HANDLING", playerId, statusInstanceId: pending.statusInstanceId });
    }
    return legalActions;
  }

  if (state.phase === "experimentCounterattackWindow") {
    const pending = state.pendingExperimentCounterattack;
    if (!pending || pending.responderPlayerId !== playerId) return [];
    const legalActions: GameAction[] = [];
    const recoverAction: ResolveExperimentCounterattackAction = { type: "RESOLVE_EXPERIMENT_COUNTERATTACK", playerId, option: "recover" };
    if (validateExperimentCounterattackAction(state, recoverAction)) legalActions.push(recoverAction);
    for (const cardInstanceId of pending.legalPursuitCardInstanceIds) {
      const pursuitAction: ResolveExperimentCounterattackAction = { type: "RESOLVE_EXPERIMENT_COUNTERATTACK", playerId, option: "acid-base-pursuit", cardInstanceId };
      if (validateExperimentCounterattackAction(state, pursuitAction)) legalActions.push(pursuitAction);
    }
    return legalActions;
  }

  return [];
}
