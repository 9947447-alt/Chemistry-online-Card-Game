import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { createInitialGame } from "../../../game/engine/createInitialGame";
import { engineReducer } from "../../../game/engine/reducer";
import { getAIObservation } from "../../../game/engine/aiObservation";
import { getDecisionContext } from "../../../game/engine/decisionContext";
import { natba0RandomLegalPolicy } from "../../../game/natba/natba0Policy";
import type { NATBAPolicy } from "../../../game/natba/types";
import type { RandomSource } from "../../../shared/random";
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

const defaultLocalGameFactory: LocalGameFactory = (characterIds) =>
  createInitialGame({
    characterIds: [characterIds[0], characterIds[1]],
  });

const initializeLocalGameSession = (
  createSession: LocalGameSessionInitializer,
): LocalGameSessionState => {
  try {
    return createSession();
  } catch {
    const fallback = createConfiguringLocalGameSession();
    return createFatalLocalGameSession(
      fallback.characterIds,
      fallback.revision,
      "SESSION_INITIALIZATION_FAILED",
      fallback.playerControllers,
    );
  }
};

export type UseLocalGameDebugOptions = {
  createGame?: LocalGameFactory;
  reduceGame?: LocalGameEngineReducer;
  createSession?: LocalGameSessionInitializer;
  policy?: NATBAPolicy;
  aiDelayMs?: number;
  random?: RandomSource;
};

export function useLocalGameDebug(
  createGameOrOptions?: LocalGameFactory | UseLocalGameDebugOptions,
  reduceGameArg: LocalGameEngineReducer = engineReducer,
  createSessionArg: LocalGameSessionInitializer = createConfiguringLocalGameSession,
  optionsArg?: { policy?: NATBAPolicy; aiDelayMs?: number; random?: RandomSource },
): readonly [LocalGameSessionState, (command: LocalGameSessionCommand) => void] {
  const opts: UseLocalGameDebugOptions =
    typeof createGameOrOptions === "object" && createGameOrOptions !== null
      ? createGameOrOptions
      : {
          createGame: createGameOrOptions,
          reduceGame: reduceGameArg,
          createSession: createSessionArg,
          ...optionsArg,
        };

  const createGame = opts.createGame ?? defaultLocalGameFactory;
  const reduceGame = opts.reduceGame ?? engineReducer;
  const createSession = opts.createSession ?? createConfiguringLocalGameSession;
  const policy = opts.policy ?? natba0RandomLegalPolicy;
  const aiDelayMs = opts.aiDelayMs ?? 250;
  const random = opts.random ?? Math.random;

  const sessionReducer = (
    state: LocalGameSessionState,
    action: LocalGameSessionAction,
  ): LocalGameSessionState => localGameSessionReducer(state, action);

  const [session, dispatch] = useReducer(
    sessionReducer,
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
    if (
      command.type === "SELECT_CHARACTER" ||
      command.type === "SELECT_PLAYER_CONTROLLER" ||
      command.type === "RETURN_TO_CHARACTER_SELECTION"
    ) {
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
        playerControllers: currentSession.playerControllers,
        game,
      });
      return;
    }

    const isStart = command.type === "START_LOCAL_GAME";
    const isRestart = command.type === "RESTART_CURRENT_LINEUP";
    const expectedMode = isStart ? "configuring" : isRestart ? "playing" : "fatal";
    const failCode = isStart ? "GAME_START_FAILED" : isRestart ? "GAME_RESTART_FAILED" : "GAME_RECOVERY_FAILED";

    if (currentSession.mode !== expectedMode) {
      return;
    }

    if (!isCharacterSelection(currentSession.characterIds)) {
      enterFatal(currentSession, failCode);
      return;
    }

    let game: GameState;
    try {
      game = createGame(currentSession.characterIds);
    } catch {
      enterFatal(currentSession, failCode);
      return;
    }

    dispatchPureAction({
      type: isStart
        ? "APPLY_STARTED_LOCAL_GAME"
        : isRestart
          ? "APPLY_RESTARTED_LOCAL_GAME"
          : "APPLY_RECOVERED_LOCAL_GAME",
      expectedRevision: currentSession.revision,
      characterIds: currentSession.characterIds,
      playerControllers: currentSession.playerControllers,
      game,
    });
  }, [createGame, dispatchPureAction, enterFatal, reduceGame]);

  useEffect(() => {
    if (session.mode !== "playing" || session.game.phase === "gameOver") {
      return;
    }

    const currentContext = getDecisionContext(session.game);
    if (
      currentContext.kind !== "finite-actions" &&
      currentContext.kind !== "laboratory-preparation"
    ) {
      return;
    }

    const decisionMakerId = currentContext.playerId;
    const playerIndex = decisionMakerId === "player_1" ? 0 : 1;
    const isAI = session.playerControllers[playerIndex] === "ai";

    if (!isAI) {
      return;
    }

    const currentRevision = session.revision;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const executeAIDecision = () => {
      const liveSession = sessionRef.current;
      if (liveSession.mode !== "playing" || liveSession.revision !== currentRevision) {
        return;
      }

      const liveContext = getDecisionContext(liveSession.game);
      if (
        (liveContext.kind !== "finite-actions" &&
          liveContext.kind !== "laboratory-preparation") ||
        liveContext.playerId !== decisionMakerId
      ) {
        return;
      }

      const observation = getAIObservation(liveSession.game, decisionMakerId);
      const action = policy(observation, liveContext, random);
      if (action) {
        dispatchCommand({ type: "DISPATCH_GAME_ACTION", action });
      }
    };

    if (aiDelayMs <= 0) {
      executeAIDecision();
    } else {
      timerId = setTimeout(executeAIDecision, aiDelayMs);
    }

    return () => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    };
  }, [
    session.mode,
    session.revision,
    session.mode === "playing" ? session.game : undefined,
    session.playerControllers,
    aiDelayMs,
    dispatchCommand,
    policy,
    random,
  ]);

  return [session, dispatchCommand] as const;
}
