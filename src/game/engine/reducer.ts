import type { GameAction } from "./actions";
import type { GameState } from "./types";
import { fisherYatesShuffle } from "../../shared/random";
import { startActiveDIY } from "./diy";
import { activateCharacterSkill } from "./characterSkills";
import { resolveExperimentCounterattack } from "./experimentCounterattack";
import {
  handleStatusWithCard,
  passResponse,
  passStatusHandling,
  playMainActionCard,
  playReferenceCard,
  respondWithCard,
} from "./resolution";
import { advanceTurnFromReducer, confirmLaboratoryPreparation } from "./turnFlow";

export function engineReducer(state: GameState, action: GameAction): GameState {
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
        fisherYatesShuffle,
      );
    case "CONFIRM_LABORATORY_PREPARATION":
      return confirmLaboratoryPreparation(
        state,
        action.playerId,
        action.keptCardInstanceIds,
      );
    case "RESOLVE_EXPERIMENT_COUNTERATTACK":
      return resolveExperimentCounterattack(state, action, fisherYatesShuffle);
    case "PASS_ACTION":
      if (
        action.playerId !== state.activePlayerId ||
        state.phase !== "mainAction" ||
        state.players.find((player) => player.id === action.playerId)?.eliminated
      ) {
        return state;
      }
      return advanceTurnFromReducer(state, fisherYatesShuffle);
    case "PLAY_CARD":
      return playMainActionCard(
        state,
        action.playerId,
        action.cardInstanceId,
        action.targetPlayerId,
        fisherYatesShuffle,
      );
    case "PLAY_REFERENCE_CARD":
      return playReferenceCard(state, action.playerId, action.cardInstanceId, fisherYatesShuffle);
    case "RESPOND_WITH_CARD":
      return respondWithCard(state, action.playerId, action.cardInstanceId, fisherYatesShuffle);
    case "PASS_RESPONSE":
      return passResponse(state, action.playerId, fisherYatesShuffle);
    case "HANDLE_STATUS_WITH_CARD":
      return handleStatusWithCard(
        state,
        action.playerId,
        action.statusInstanceId,
        action.cardInstanceId,
        fisherYatesShuffle,
      );
    case "PASS_STATUS_HANDLING":
      return passStatusHandling(
        state,
        action.playerId,
        action.statusInstanceId,
        fisherYatesShuffle,
      );
    case "START_ACTIVE_DIY":
      return startActiveDIY(
        state,
        action.playerId,
        action.recipeId,
        action.componentCardInstanceIds,
        action.targetPlayerId,
        fisherYatesShuffle,
      );
    default:
      return state;
  }
}
