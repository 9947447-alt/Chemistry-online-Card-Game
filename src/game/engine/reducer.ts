import type { GameAction } from "./actions";
import type { GameState } from "./types";
import { fisherYatesShuffle, type ShuffleFunction } from "../../shared/random";
import { playDIYSelection, startActiveDIY } from "./diy";
import { activateCharacterSkill } from "./characterSkills";
import { resolveExperimentCounterattack } from "./experimentCounterattack";
import {
  handleStatusWithCard,
  passResponse,
  passStatusHandling,
  playMainActionCard,
  playReferenceCard,
  respondWithCard,
  validatePassAction,
} from "./resolution";
import { advanceTurnFromReducer, confirmLaboratoryPreparation } from "./turnFlow";

export function engineReducer(
  state: GameState,
  action: GameAction,
  shuffle: ShuffleFunction = fisherYatesShuffle,
): GameState {
  if (state.phase === "gameOver") {
    return state;
  }

  if (
    state.phase === "preparationSelection" &&
    action.type !== "CONFIRM_LABORATORY_PREPARATION"
  ) {
    return state;
  }

  if (
    state.phase === "experimentCounterattackWindow" &&
    action.type !== "RESOLVE_EXPERIMENT_COUNTERATTACK"
  ) {
    return state;
  }

  switch (action.type) {
    case "ACTIVATE_CHARACTER_SKILL":
      return activateCharacterSkill(
        state,
        action,
        shuffle,
      );
    case "CONFIRM_LABORATORY_PREPARATION":
      return confirmLaboratoryPreparation(
        state,
        action.playerId,
        action.keptCardInstanceIds,
      );
    case "RESOLVE_EXPERIMENT_COUNTERATTACK":
      return resolveExperimentCounterattack(state, action, shuffle);
    case "PASS_ACTION":
      if (!validatePassAction(state, action.playerId)) {
        return state;
      }
      return advanceTurnFromReducer(state, shuffle);
    case "PLAY_CARD":
      return playMainActionCard(
        state,
        action.playerId,
        action.cardInstanceId,
        action.targetPlayerId,
        shuffle,
      );
    case "PLAY_REFERENCE_CARD":
      return playReferenceCard(state, action.playerId, action.cardInstanceId, shuffle);
    case "RESPOND_WITH_CARD":
      return respondWithCard(state, action.playerId, action.cardInstanceId, shuffle);
    case "PASS_RESPONSE":
      return passResponse(state, action.playerId, shuffle);
    case "HANDLE_STATUS_WITH_CARD":
      return handleStatusWithCard(
        state,
        action.playerId,
        action.statusInstanceId,
        action.cardInstanceId,
        shuffle,
      );
    case "PASS_STATUS_HANDLING":
      return passStatusHandling(
        state,
        action.playerId,
        action.statusInstanceId,
        shuffle,
      );
    case "PLAY_DIY_SELECTION":
      return playDIYSelection(
        state,
        action.playerId,
        action.componentCardInstanceIds,
        action.targetPlayerId,
        shuffle,
      );
    case "START_ACTIVE_DIY":
      return startActiveDIY(
        state,
        action.playerId,
        action.recipeId,
        action.componentCardInstanceIds,
        action.targetPlayerId,
        shuffle,
      );
    default:
      return state;
  }
}
