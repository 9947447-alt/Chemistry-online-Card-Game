import {
  createSafeRuntimeDiagnostics,
  type SafeRuntimeDiagnostics,
} from "../../app/releaseMetadata";
import { characterDefinitions } from "../../game/data/characterDefinitions";
import { engineReducer } from "../../game/engine/reducer";
import type { GameAction } from "../../game/engine/actions";
import type { CharacterId, GameState } from "../../game/engine/types";
import { getFatalMessageDisplayName } from "./presentationLocale";

export type CharacterSelection = readonly [CharacterId, CharacterId];

export type PlayerController = "human" | "ai";
export type PlayerControllerSelection = readonly [PlayerController, PlayerController];

export const defaultCharacterSelection: CharacterSelection = [
  "laboratory_teacher",
  "chemical_factory_ceo",
];

export const defaultPlayerControllers: PlayerControllerSelection = [
  "human",
  "human",
];

export type ConfiguringLocalGameSession = Readonly<{
  mode: "configuring";
  characterIds: CharacterSelection;
  playerControllers: PlayerControllerSelection;
  revision: number;
  error: string | null;
}>;

export type PlayingLocalGameSession = Readonly<{
  mode: "playing";
  characterIds: CharacterSelection;
  playerControllers: PlayerControllerSelection;
  revision: number;
  game: GameState;
  error: string | null;
}>;

export type FatalErrorCode =
  | "SESSION_INITIALIZATION_FAILED"
  | "GAME_START_FAILED"
  | "GAME_RESTART_FAILED"
  | "GAME_ACTION_FAILED"
  | "GAME_RECOVERY_FAILED"
  | "GAME_STATE_VALIDATION_FAILED";

export type FatalLocalGameError = Readonly<{
  code: FatalErrorCode;
  userMessage: string;
  diagnostics: SafeRuntimeDiagnostics;
}>;

export type FatalLocalGameSession = Readonly<{
  mode: "fatal";
  characterIds: CharacterSelection;
  playerControllers: PlayerControllerSelection;
  revision: number;
  error: FatalLocalGameError;
}>;

export type LocalGameSessionState =
  | ConfiguringLocalGameSession
  | PlayingLocalGameSession
  | FatalLocalGameSession;

type SelectCharacterAction = Readonly<{
  type: "SELECT_CHARACTER";
  playerIndex: 0 | 1;
  characterId: unknown;
}>;

type SelectPlayerControllerAction = Readonly<{
  type: "SELECT_PLAYER_CONTROLLER";
  playerIndex: 0 | 1;
  controller: unknown;
}>;

type ReturnToCharacterSelectionAction = Readonly<{
  type: "RETURN_TO_CHARACTER_SELECTION";
}>;

type DispatchGameAction = Readonly<{
  type: "DISPATCH_GAME_ACTION";
  action: GameAction;
}>;

type CreatedGameActionPayload = Readonly<{
  expectedRevision: number;
  characterIds: CharacterSelection;
  playerControllers?: PlayerControllerSelection;
  game: GameState;
}>;

type ApplyGameActionResult = Readonly<{
  type: "APPLY_GAME_ACTION_RESULT";
  expectedRevision: number;
  characterIds: CharacterSelection;
  playerControllers?: PlayerControllerSelection;
  game: GameState;
}>;

type EnterFatalAction = Readonly<{
  type: "ENTER_FATAL_LOCAL_GAME";
  expectedMode: LocalGameSessionState["mode"];
  expectedRevision: number;
  code: FatalErrorCode;
}>;

export type LocalGameSessionAction =
  | SelectCharacterAction
  | SelectPlayerControllerAction
  | (CreatedGameActionPayload & Readonly<{ type: "APPLY_STARTED_LOCAL_GAME" }>)
  | (CreatedGameActionPayload & Readonly<{ type: "APPLY_RESTARTED_LOCAL_GAME" }>)
  | (CreatedGameActionPayload & Readonly<{ type: "APPLY_RECOVERED_LOCAL_GAME" }>)
  | ApplyGameActionResult
  | EnterFatalAction
  | ReturnToCharacterSelectionAction
  | DispatchGameAction;

export type LocalGameSessionCommand =
  | SelectCharacterAction
  | SelectPlayerControllerAction
  | Readonly<{ type: "START_LOCAL_GAME" }>
  | Readonly<{ type: "RESTART_CURRENT_LINEUP" }>
  | Readonly<{ type: "RECOVER_FATAL_WITH_CURRENT_LINEUP" }>
  | ReturnToCharacterSelectionAction
  | DispatchGameAction;

export type LocalGameFactory = (
  characterIds: CharacterSelection,
) => GameState;

export type LocalGameEngineReducer = (
  game: GameState,
  action: GameAction,
) => GameState;

export type LocalGameSessionInitializer = () => LocalGameSessionState;

export function isPlayerController(value: unknown): value is PlayerController {
  return value === "human" || value === "ai";
}

export function isPlayerControllerSelection(
  values: readonly unknown[],
): values is PlayerControllerSelection {
  return (
    values.length === 2 &&
    isPlayerController(values[0]) &&
    isPlayerController(values[1])
  );
}

export function isCharacterId(value: unknown): value is CharacterId {
  return (
    typeof value === "string" &&
    characterDefinitions.some((definition) => definition.id === value)
  );
}

export function isCharacterSelection(
  values: readonly unknown[],
): values is CharacterSelection {
  return (
    values.length === 2 &&
    isCharacterId(values[0]) &&
    isCharacterId(values[1])
  );
}

export function createConfiguringLocalGameSession(
  characterIds: CharacterSelection = defaultCharacterSelection,
  playerControllers: PlayerControllerSelection = defaultPlayerControllers,
): ConfiguringLocalGameSession {
  return {
    mode: "configuring",
    characterIds: [characterIds[0], characterIds[1]],
    playerControllers: [playerControllers[0], playerControllers[1]],
    revision: 0,
    error: null,
  };
}

export function createFatalLocalGameSession(
  characterIds: CharacterSelection,
  revision: number,
  code: FatalErrorCode,
  playerControllers: PlayerControllerSelection = defaultPlayerControllers,
): FatalLocalGameSession {
  return {
    mode: "fatal",
    characterIds: [characterIds[0], characterIds[1]],
    playerControllers: [playerControllers[0], playerControllers[1]],
    revision: revision + 1,
    error: {
      code,
      userMessage: getFatalMessageDisplayName(code, code, "zh-CN"),
      diagnostics: createSafeRuntimeDiagnostics(),
    },
  };
}

export function formatFatalDiagnostics(error: FatalLocalGameError): string {
  const { diagnostics } = error;
  return [
    `名称：${diagnostics.displayName}`,
    `应用版本：${diagnostics.version}`,
    `规则版本：${diagnostics.rulesVersion}`,
    `Commit：${diagnostics.commit}`,
    `错误码：${error.code}`,
    `运行环境：${diagnostics.environment}`,
  ].join("\n");
}

const samePair = (left: readonly unknown[], right: readonly unknown[]): boolean =>
  left.length === 2 && left[0] === right[0] && left[1] === right[1];

function gameMatchesCharacterSelection(
  game: GameState,
  characterIds: CharacterSelection,
): boolean {
  return (
    game.players.length === 2 &&
    game.players[0]?.characterId === characterIds[0] &&
    game.players[1]?.characterId === characterIds[1]
  );
}

function applyCreatedGame(
  state: LocalGameSessionState,
  action: CreatedGameActionPayload,
  expectedMode: LocalGameSessionState["mode"],
): LocalGameSessionState {
  if (state.mode !== expectedMode || state.revision !== action.expectedRevision) {
    return state;
  }

  const effectiveControllers = action.playerControllers ?? state.playerControllers;

  if (
    !isCharacterSelection(action.characterIds) ||
    !samePair(action.characterIds, state.characterIds) ||
    !isPlayerControllerSelection(effectiveControllers) ||
    !samePair(effectiveControllers, state.playerControllers) ||
    !gameMatchesCharacterSelection(action.game, state.characterIds)
  ) {
    return createFatalLocalGameSession(
      state.characterIds,
      state.revision,
      "GAME_STATE_VALIDATION_FAILED",
      state.playerControllers,
    );
  }

  return {
    mode: "playing",
    characterIds: [state.characterIds[0], state.characterIds[1]],
    playerControllers: [effectiveControllers[0], effectiveControllers[1]],
    revision: state.revision + 1,
    game: action.game,
    error: null,
  };
}

function applyGameActionResult(
  state: LocalGameSessionState,
  action: ApplyGameActionResult,
): LocalGameSessionState {
  if (state.mode !== "playing" || state.revision !== action.expectedRevision) {
    return state;
  }

  const effectiveControllers = action.playerControllers ?? state.playerControllers;

  if (
    !samePair(action.characterIds, state.characterIds) ||
    !samePair(effectiveControllers, state.playerControllers) ||
    !gameMatchesCharacterSelection(action.game, state.characterIds)
  ) {
    return createFatalLocalGameSession(
      state.characterIds,
      state.revision,
      "GAME_STATE_VALIDATION_FAILED",
      state.playerControllers,
    );
  }

  if (action.game === state.game) {
    return {
      ...state,
      error: "操作不合法",
    };
  }

  return {
    ...state,
    revision: state.revision + 1,
    game: action.game,
    error: null,
  };
}

function reduceDispatchedGameAction(
  state: LocalGameSessionState,
  action: DispatchGameAction,
  reduceGame: LocalGameEngineReducer,
): LocalGameSessionState {
  if (state.mode !== "playing") {
    return state;
  }

  let game: GameState;
  try {
    game = reduceGame(state.game, action.action);
  } catch {
    return createFatalLocalGameSession(
      state.characterIds,
      state.revision,
      "GAME_ACTION_FAILED",
      state.playerControllers,
    );
  }

  return applyGameActionResult(state, {
    type: "APPLY_GAME_ACTION_RESULT",
    expectedRevision: state.revision,
    characterIds: state.characterIds,
    playerControllers: state.playerControllers,
    game,
  });
}

export function localGameSessionReducer(
  state: LocalGameSessionState,
  action: LocalGameSessionAction,
  reduceGame: LocalGameEngineReducer = engineReducer,
): LocalGameSessionState {
  switch (action.type) {
    case "SELECT_CHARACTER":
      if (state.mode !== "configuring") return state;
      if (!isCharacterId(action.characterId)) return { ...state, error: "未知角色不能用于创建本地对局。" };
      return {
        ...state,
        characterIds: action.playerIndex === 0 ? [action.characterId, state.characterIds[1]] : [state.characterIds[0], action.characterId],
        error: null,
      };

    case "SELECT_PLAYER_CONTROLLER":
      if (state.mode !== "configuring") return state;
      if (!isPlayerController(action.controller)) return { ...state, error: "未知控制方类型。" };
      return {
        ...state,
        playerControllers: action.playerIndex === 0 ? [action.controller, state.playerControllers[1]] : [state.playerControllers[0], action.controller],
        error: null,
      };

    case "APPLY_STARTED_LOCAL_GAME":
      return applyCreatedGame(state, action, "configuring");

    case "APPLY_RESTARTED_LOCAL_GAME":
      return applyCreatedGame(state, action, "playing");

    case "APPLY_RECOVERED_LOCAL_GAME":
      return applyCreatedGame(state, action, "fatal");

    case "APPLY_GAME_ACTION_RESULT":
      return applyGameActionResult(state, action);

    case "ENTER_FATAL_LOCAL_GAME":
      return state.mode === action.expectedMode && state.revision === action.expectedRevision
        ? createFatalLocalGameSession(
            state.characterIds,
            state.revision,
            action.code,
            state.playerControllers,
          )
        : state;

    case "RETURN_TO_CHARACTER_SELECTION":
      return state.mode === "playing" || state.mode === "fatal"
        ? { mode: "configuring", characterIds: state.characterIds, playerControllers: state.playerControllers, revision: state.revision + 1, error: null }
        : state;

    case "DISPATCH_GAME_ACTION":
      return reduceDispatchedGameAction(state, action, reduceGame);
  }
}
