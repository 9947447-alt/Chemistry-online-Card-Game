import type { GameAction } from "./actions";
import type { GameState } from "./types";
import { fisherYatesShuffle } from "../../shared/random";
import { advanceTurnFromReducer } from "./turnFlow";

export function engineReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "PASS_ACTION":
      if (action.playerId !== state.activePlayerId || state.phase === "gameOver") {
        return state;
      }
      return advanceTurnFromReducer(state, fisherYatesShuffle);
    default:
      return state;
  }
}
