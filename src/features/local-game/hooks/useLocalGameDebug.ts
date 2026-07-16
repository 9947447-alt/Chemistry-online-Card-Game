import { useReducer } from "react";
import {
  createConfiguringLocalGameSession,
  localGameSessionReducer,
  type LocalGameSessionAction,
  type LocalGameSessionState,
} from "../localGameSession";

function reduceLocalGameSession(
  state: LocalGameSessionState,
  action: LocalGameSessionAction,
): LocalGameSessionState {
  return localGameSessionReducer(state, action);
}

function initializeLocalGameSession(): LocalGameSessionState {
  return createConfiguringLocalGameSession();
}

export function useLocalGameDebug() {
  return useReducer(
    reduceLocalGameSession,
    undefined,
    initializeLocalGameSession,
  );
}
