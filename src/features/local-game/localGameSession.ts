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

export const defaultCharacterSelection: CharacterSelection = [
  "laboratory_teacher",
  "chemical_factory_ceo",
];

export type ConfiguringLocalGameSession = Readonly<{
  mode: "configuring";
  characterIds: CharacterSelection;
  revision: number;
  error: string | null;
}>;

export type PlayingLocalGameSession = Readonly<{
  mode: "playing";
  characterIds: CharacterSelection;
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
  game: GameState;
}>;

type ApplyGameActionResult = Readonly<{
  type: "APPLY_GAME_ACTION_RESULT";
  expectedRevision: number;
  characterIds: CharacterSelection;
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
  | (CreatedGameActionPayload & Readonly<{ type: "APPLY_STARTED_LOCAL_GAME" }>)
  | (CreatedGameActionPayload & Readonly<{ type: "APPLY_RESTARTED_LOCAL_GAME" }>)
  | (CreatedGameActionPayload & Readonly<{ type: "APPLY_RECOVERED_LOCAL_GAME" }>)
  | ApplyGameActionResult
  | EnterFatalAction
  | ReturnToCharacterSelectionAction
  | DispatchGameAction;

export type LocalGameSessionCommand =
  | SelectCharacterAction
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

export function createConfiguringLocalGameSession(): ConfiguringLocalGameSession {
  return {
    mode: "configuring",
    characterIds: defaultCharacterSelection,
    revision: 0,
    error: null,
  };
}

export function createFatalLocalGameSession(
  characterIds: CharacterSelection,
  revision: number,
  code: FatalErrorCode,
): FatalLocalGameSession {
  return {
    mode: "fatal",
    characterIds: [characterIds[0], characterIds[1]],
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

function sameCharacterSelection(
  left: readonly unknown[],
  right: CharacterSelection,
): boolean {
  return left.length === 2 && left[0] === right[0] && left[1] === right[1];
}

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

  if (
    !isCharacterSelection(action.characterIds) ||
    !sameCharacterSelection(action.characterIds, state.characterIds) ||
    !gameMatchesCharacterSelection(action.game, state.characterIds)
  ) {
    return createFatalLocalGameSession(
      state.characterIds,
      state.revision,
      "GAME_STATE_VALIDATION_FAILED",
    );
  }

  return {
    mode: "playing",
    characterIds: [state.characterIds[0], state.characterIds[1]],
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

  if (
    !sameCharacterSelection(action.characterIds, state.characterIds) ||
    !gameMatchesCharacterSelection(action.game, state.characterIds)
  ) {
    return createFatalLocalGameSession(
      state.characterIds,
      state.revision,
      "GAME_STATE_VALIDATION_FAILED",
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
    );
  }

  return applyGameActionResult(state, {
    type: "APPLY_GAME_ACTION_RESULT",
    expectedRevision: state.revision,
    characterIds: state.characterIds,
    game,
  });
}

export function localGameSessionReducer(
  state: LocalGameSessionState,
  action: LocalGameSessionAction,
  reduceGame: LocalGameEngineReducer = engineReducer,
): LocalGameSessionState {
  switch (action.type) {
    case "SELECT_CHARACTER": {
      if (state.mode !== "configuring") {
        return state;
      }

      if (!isCharacterId(action.characterId)) {
        return {
          ...state,
          error: "未知角色不能用于创建本地对局。",
        };
      }

      const nextCharacterIds: CharacterSelection = action.playerIndex === 0
        ? [action.characterId, state.characterIds[1]]
        : [state.characterIds[0], action.characterId];

      return {
        ...state,
        characterIds: nextCharacterIds,
        error: null,
      };
    }

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
        ? createFatalLocalGameSession(state.characterIds, state.revision, action.code)
        : state;

    case "RETURN_TO_CHARACTER_SELECTION":
      return state.mode === "playing" || state.mode === "fatal"
        ? {
            mode: "configuring",
            characterIds: [state.characterIds[0], state.characterIds[1]],
            revision: state.revision + 1,
            error: null,
          }
        : state;

    case "DISPATCH_GAME_ACTION":
      return reduceDispatchedGameAction(state, action, reduceGame);
  }
}
