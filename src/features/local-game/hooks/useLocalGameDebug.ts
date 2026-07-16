import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import { createInitialGame } from "../../../game/engine/createInitialGame";
import {
  createConfiguringLocalGameSession,
  isCharacterSelection,
  localGameSessionReducer,
  type LocalGameSessionAction,
  type LocalGameSessionCommand,
  type LocalGameFactory,
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

const defaultLocalGameFactory: LocalGameFactory = (characterIds) =>
  createInitialGame({
    characterIds: [characterIds[0], characterIds[1]],
  });

function gameCreationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "创建本地对局失败。";
}

export function useLocalGameDebug(
  createGame: LocalGameFactory = defaultLocalGameFactory,
): readonly [LocalGameSessionState, (command: LocalGameSessionCommand) => void] {
  const [session, dispatch] = useReducer(
    reduceLocalGameSession,
    undefined,
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

  const dispatchCommand = useCallback((command: LocalGameSessionCommand) => {
    if (command.type === "DISPATCH_GAME_ACTION") {
      dispatch(command);
      return;
    }

    if (command.type === "SELECT_CHARACTER" || command.type === "RETURN_TO_CHARACTER_SELECTION") {
      dispatchPureAction(command);
      return;
    }

    const currentSession = sessionRef.current;
    const expectedMode = command.type === "START_LOCAL_GAME" ? "configuring" : "playing";

    if (currentSession.mode !== expectedMode) {
      return;
    }

    if (!isCharacterSelection(currentSession.characterIds)) {
      dispatchPureAction({
        type: "REPORT_LOCAL_GAME_CREATION_ERROR",
        expectedMode,
        expectedRevision: currentSession.revision,
        message: "角色配置无效，请重新选择两名正式角色。",
      });
      return;
    }

    let game;
    try {
      game = createGame(currentSession.characterIds);
    } catch (error) {
      dispatchPureAction({
        type: "REPORT_LOCAL_GAME_CREATION_ERROR",
        expectedMode,
        expectedRevision: currentSession.revision,
        message: gameCreationErrorMessage(error),
      });
      return;
    }

    dispatchPureAction({
      type: command.type === "START_LOCAL_GAME"
        ? "APPLY_STARTED_LOCAL_GAME"
        : "APPLY_RESTARTED_LOCAL_GAME",
      expectedRevision: currentSession.revision,
      characterIds: currentSession.characterIds,
      game,
    });
  }, [createGame, dispatchPureAction]);

  return [session, dispatchCommand] as const;
}
