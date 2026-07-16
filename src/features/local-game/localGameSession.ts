import { characterDefinitions } from "../../game/data/characterDefinitions";
import { engineReducer } from "../../game/engine/reducer";
import type { GameAction } from "../../game/engine/actions";
import type { CharacterId, GameState } from "../../game/engine/types";

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

export type LocalGameSessionState =
  | ConfiguringLocalGameSession
  | PlayingLocalGameSession;

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

export type LocalGameSessionAction =
  | SelectCharacterAction
  | (CreatedGameActionPayload & Readonly<{ type: "APPLY_STARTED_LOCAL_GAME" }>)
  | (CreatedGameActionPayload & Readonly<{ type: "APPLY_RESTARTED_LOCAL_GAME" }>)
  | Readonly<{
      type: "REPORT_LOCAL_GAME_CREATION_ERROR";
      expectedMode: LocalGameSessionState["mode"];
      expectedRevision: number;
      message: string;
    }>
  | ReturnToCharacterSelectionAction
  | DispatchGameAction;

export type LocalGameSessionCommand =
  | SelectCharacterAction
  | Readonly<{ type: "START_LOCAL_GAME" }>
  | Readonly<{ type: "RESTART_CURRENT_LINEUP" }>
  | ReturnToCharacterSelectionAction
  | DispatchGameAction;

export type LocalGameFactory = (
  characterIds: CharacterSelection,
) => GameState;

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
    game.players[0].characterId === characterIds[0] &&
    game.players[1].characterId === characterIds[1]
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
    return {
      ...state,
      error: "创建的游戏与当前角色阵容不一致。",
    };
  }

  return {
    mode: "playing",
    characterIds: state.characterIds,
    revision: state.revision + 1,
    game: action.game,
    error: null,
  };
}

export function localGameSessionReducer(
  state: LocalGameSessionState,
  action: LocalGameSessionAction,
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

    case "REPORT_LOCAL_GAME_CREATION_ERROR":
      return state.mode === action.expectedMode && state.revision === action.expectedRevision
        ? { ...state, error: action.message }
        : state;

    case "RETURN_TO_CHARACTER_SELECTION":
      return state.mode === "playing"
        ? {
            mode: "configuring",
            characterIds: state.characterIds,
            revision: state.revision + 1,
            error: null,
          }
        : state;

    case "DISPATCH_GAME_ACTION": {
      if (state.mode !== "playing") {
        return state;
      }

      const nextGame = engineReducer(state.game, action.action);

      if (nextGame === state.game) {
        return {
          ...state,
          error: "操作不合法",
        };
      }

      return {
        ...state,
        game: nextGame,
        error: null,
      };
    }
  }
}
