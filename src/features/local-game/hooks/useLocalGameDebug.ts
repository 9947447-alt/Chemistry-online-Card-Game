import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import { createInitialGame } from "../../../game/engine/createInitialGame";
import { engineReducer } from "../../../game/engine/reducer";
import type { GameState } from "../../../game/engine/types";
import {
  createConfiguringLocalGameSession,
  createFatalLocalGameSession,
  isCharacterSelection,
  localGameSessionReducer,
  type LocalGameEngineReducer,
  type LocalGameFactory,
  type LocalGameSessionAction,
  type LocalGameSessionCommand,
  type LocalGameSessionInitializer,
  type LocalGameSessionState,
} from "../localGameSession";

function reduceLocalGameSession(
  state: LocalGameSessionState,
  action: LocalGameSessionAction,
): LocalGameSessionState {
  return localGameSessionReducer(state, action);
}

function initializeLocalGameSession(
  createSession: LocalGameSessionInitializer,
): LocalGameSessionState {
  try {
    return createSession();
  } catch {
    const fallback = createConfiguringLocalGameSession();
    return createFatalLocalGameSession(
      fallback.characterIds,
      fallback.revision,
      "SESSION_INITIALIZATION_FAILED",
    );
  }
}

const defaultLocalGameFactory: LocalGameFactory = (characterIds) =>
  createInitialGame({
    characterIds: [characterIds[0], characterIds[1]],
  });

export function useLocalGameDebug(
  createGame: LocalGameFactory = defaultLocalGameFactory,
  reduceGame: LocalGameEngineReducer = engineReducer,
  createSession: LocalGameSessionInitializer = createConfiguringLocalGameSession,
): readonly [LocalGameSessionState, (command: LocalGameSessionCommand) => void] {
  const [session, dispatch] = useReducer(
    reduceLocalGameSession,
    createSession,
    initializeLocalGameSession,
  );
  const sessionRef = useRef(session);

  useLayoutEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const dispatchPureAction = useCallback((action: LocalGameSessionAction) => {
    const nextSession = localGameSessionReducer(sessionRef.current, action);
    sessionRef.current = nextSession;
    dispatch(action);
  }, []);

  const enterFatal = useCallback((
    state: LocalGameSessionState,
    code: "GAME_START_FAILED" | "GAME_RESTART_FAILED" | "GAME_ACTION_FAILED" | "GAME_RECOVERY_FAILED",
  ) => {
    dispatchPureAction({
      type: "ENTER_FATAL_LOCAL_GAME",
      expectedMode: state.mode,
      expectedRevision: state.revision,
      code,
    });
  }, [dispatchPureAction]);

  const dispatchCommand = useCallback((command: LocalGameSessionCommand) => {
    if (command.type === "SELECT_CHARACTER" || command.type === "RETURN_TO_CHARACTER_SELECTION") {
      dispatchPureAction(command);
      return;
    }

    const currentSession = sessionRef.current;

    if (command.type === "DISPATCH_GAME_ACTION") {
      if (currentSession.mode !== "playing") {
        return;
      }

      let game: GameState;
      try {
        game = reduceGame(currentSession.game, command.action);
      } catch {
        enterFatal(currentSession, "GAME_ACTION_FAILED");
        return;
      }

      dispatchPureAction({
        type: "APPLY_GAME_ACTION_RESULT",
        expectedRevision: currentSession.revision,
        characterIds: currentSession.characterIds,
        game,
      });
      return;
    }

    const expectedMode = command.type === "START_LOCAL_GAME"
      ? "configuring"
      : command.type === "RESTART_CURRENT_LINEUP"
        ? "playing"
        : "fatal";

    if (currentSession.mode !== expectedMode) {
      return;
    }

    if (!isCharacterSelection(currentSession.characterIds)) {
      enterFatal(
        currentSession,
        command.type === "START_LOCAL_GAME"
          ? "GAME_START_FAILED"
          : command.type === "RESTART_CURRENT_LINEUP"
            ? "GAME_RESTART_FAILED"
            : "GAME_RECOVERY_FAILED",
      );
      return;
    }

    let game: GameState;
    try {
      game = createGame(currentSession.characterIds);
    } catch {
      enterFatal(
        currentSession,
        command.type === "START_LOCAL_GAME"
          ? "GAME_START_FAILED"
          : command.type === "RESTART_CURRENT_LINEUP"
            ? "GAME_RESTART_FAILED"
            : "GAME_RECOVERY_FAILED",
      );
      return;
    }

    dispatchPureAction({
      type: command.type === "START_LOCAL_GAME"
        ? "APPLY_STARTED_LOCAL_GAME"
        : command.type === "RESTART_CURRENT_LINEUP"
          ? "APPLY_RESTARTED_LOCAL_GAME"
          : "APPLY_RECOVERED_LOCAL_GAME",
      expectedRevision: currentSession.revision,
      characterIds: currentSession.characterIds,
      game,
    });
  }, [createGame, dispatchPureAction, enterFatal, reduceGame]);

  return [session, dispatchCommand] as const;
}
