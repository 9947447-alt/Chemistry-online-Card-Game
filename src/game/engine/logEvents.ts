import type {
  GameLogEntry,
  GameLogEventKey,
  GameLogParamsMap,
  GameState,
  LogPlayerIdentitySnapshot,
  LogPresentationContext,
  PlayerId,
} from "./types";
import type { SuccessfulReactionEvent } from "./reactions";

export type EventInput<E extends GameLogEventKey> = E extends "reaction"
  ? Readonly<{
      eventKey: E;
      params: Readonly<GameLogParamsMap[E]>;
      reaction: Readonly<SuccessfulReactionEvent>;
    }>
  : Readonly<{
      eventKey: E;
      params: Readonly<GameLogParamsMap[E]>;
      reaction?: never;
    }>;

function createLogEntry(
  id: string,
  input: EventInput<GameLogEventKey>,
): GameLogEntry {
  return {
    id,
    ...input,
  };
}

export function appendEvent<E extends GameLogEventKey>(
  state: GameState,
  input: EventInput<E>,
): GameState {
  const nextIndex = state.log.length + 1;
  const id = `log_${String(nextIndex).padStart(3, "0")}`;
  const entry = createLogEntry(id, input);

  return {
    ...state,
    log: [...state.log, entry],
  };
}

export function createLogPresentationContext(
  playerNames?: readonly [string, string],
): LogPresentationContext {
  const [p1Custom, p2Custom] = playerNames ?? [];

  const players: Record<PlayerId, LogPlayerIdentitySnapshot> = {
    player_1: {
      playerId: "player_1",
      ...(p1Custom !== undefined ? { customName: p1Custom } : {}),
    },
    player_2: {
      playerId: "player_2",
      ...(p2Custom !== undefined ? { customName: p2Custom } : {}),
    },
  };

  return { players };
}
