import { useReducer } from "react";
import { createInitialGame } from "../../../game/engine/createInitialGame";
import { engineReducer } from "../../../game/engine/reducer";
import type { GameAction } from "../../../game/engine/actions";
import type { GameState } from "../../../game/engine/types";

type LocalDebugState = {
  game: GameState;
  error?: string;
};

type LocalDebugAction = GameAction | { type: "RESET_GAME" };

function createLocalDebugState(): LocalDebugState {
  return {
    game: createInitialGame(),
  };
}

function localDebugReducer(state: LocalDebugState, action: LocalDebugAction): LocalDebugState {
  if (action.type === "RESET_GAME") {
    return createLocalDebugState();
  }

  const nextGame = engineReducer(state.game, action);

  if (nextGame === state.game) {
    return {
      ...state,
      error: "操作不合法",
    };
  }

  return {
    game: nextGame,
    error: undefined,
  };
}

export function useLocalGameDebug() {
  return useReducer(localDebugReducer, undefined, createLocalDebugState);
}
