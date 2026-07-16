import { characterDefinitions } from "../../game/data/characterDefinitions";
import {
  createInitialGame,
  type CreateInitialGameOptions,
} from "../../game/engine/createInitialGame";
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

export type LocalGameSessionAction =
  | Readonly<{
      type: "SELECT_CHARACTER";
      playerIndex: 0 | 1;
      characterId: unknown;
    }>
  | Readonly<{ type: "START_LOCAL_GAME" }>
  | Readonly<{ type: "RESTART_CURRENT_LINEUP" }>
  | Readonly<{ type: "RETURN_TO_CHARACTER_SELECTION" }>
  | Readonly<{ type: "DISPATCH_GAME_ACTION"; action: GameAction }>;

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

function createGameFromSelection(
  characterSelection: CharacterSelection,
  options: Omit<CreateInitialGameOptions, "characterIds"> = {},
): GameState {
  return createInitialGame({
    ...options,
    characterIds: [characterSelection[0], characterSelection[1]],
  });
}

const defaultGameFactory: LocalGameFactory = (characterSelection) =>
  createGameFromSelection(characterSelection);

export function createConfiguringLocalGameSession(): ConfiguringLocalGameSession {
  return {
    mode: "configuring",
    characterIds: defaultCharacterSelection,
    revision: 0,
    error: null,
  };
}

function createPlayingSession(
  state: LocalGameSessionState,
  createGame: LocalGameFactory,
): LocalGameSessionState {
  if (!isCharacterSelection(state.characterIds)) {
    return {
      ...state,
      error: "角色配置无效，请重新选择两名正式角色。",
    };
  }

  try {
    return {
      mode: "playing",
      characterIds: state.characterIds,
      revision: state.revision + 1,
      game: createGame(state.characterIds),
      error: null,
    };
  } catch (error) {
    return {
      ...state,
      error: error instanceof Error ? error.message : "创建本地对局失败。",
    };
  }
}

export function localGameSessionReducer(
  state: LocalGameSessionState,
  action: LocalGameSessionAction,
  createGame: LocalGameFactory = defaultGameFactory,
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

    case "START_LOCAL_GAME":
      return state.mode === "configuring"
        ? createPlayingSession(state, createGame)
        : state;

    case "RESTART_CURRENT_LINEUP":
      return state.mode === "playing"
        ? createPlayingSession(state, createGame)
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
