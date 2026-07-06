import type { GameAction } from "./actions";
import type { GameState } from "./types";
import { fisherYatesShuffle } from "../../shared/random";
import {
  handleStatusWithCard,
  passResponse,
  passStatusHandling,
  playMainActionCard,
  respondWithCard,
} from "./resolution";
import { advanceTurnFromReducer } from "./turnFlow";

export function engineReducer(state: GameState, action: GameAction): GameState {
  if (state.phase === "gameOver") {
    return state;
  }

  switch (action.type) {
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
      );
    case "PASS_STATUS_HANDLING":
      return passStatusHandling(
        state,
        action.playerId,
        action.statusInstanceId,
        fisherYatesShuffle,
      );
    default:
      return state;
  }
}
