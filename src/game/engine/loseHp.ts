import { finishGameIfResolved } from "./turnFlow";
import type { GameState, PlayerId } from "./types";
import { appendEvent } from "./logEvents";

export type LoseHpTarget = Readonly<{
  targetPlayerId: PlayerId;
  amount: number;
}>;

function isValidLoseHpBatch(state: GameState, targets: readonly LoseHpTarget[]): boolean {
  if (state.phase === "gameOver") {
    return false;
  }

  const seenPlayerIds = new Set<PlayerId>();

  for (const target of targets) {
    const player = state.players.find((candidate) => candidate.id === target.targetPlayerId);

    if (
      !Number.isFinite(target.amount) ||
      target.amount < 0 ||
      seenPlayerIds.has(target.targetPlayerId) ||
      !player ||
      player.eliminated
    ) {
      return false;
    }

    seenPlayerIds.add(target.targetPlayerId);
  }

  return true;
}

export function applyLoseHpBatch(
  state: GameState,
  targets: readonly LoseHpTarget[],
): GameState {
  if (!isValidLoseHpBatch(state, targets)) {
    return state;
  }

  const amountByPlayerId = new Map<PlayerId, number>(
    targets.map((target) => [target.targetPlayerId, target.amount]),
  );
  const hasPositiveLoss = targets.some((target) => target.amount > 0);

  if (!hasPositiveLoss) {
    return state;
  }

  const playersWithUpdatedHp = state.players.map((player) => {
    const amount = amountByPlayerId.get(player.id);

    if (amount === undefined || amount === 0) {
      return player;
    }

    return {
      ...player,
      hp: Math.max(0, player.hp - amount),
    };
  });

  const playersWithEliminations = playersWithUpdatedHp.map((player) => {
    if (!amountByPlayerId.has(player.id) || player.hp !== 0) {
      return player;
    }

    return {
      ...player,
      eliminated: true,
    };
  });

  let nextState: GameState = {
    ...state,
    players: playersWithEliminations,
  };

  for (const originalPlayer of state.players) {
    const requestedAmount = amountByPlayerId.get(originalPlayer.id);

    if (requestedAmount === undefined || requestedAmount === 0) {
      continue;
    }

    const resolvedPlayer = playersWithEliminations.find(
      (player) => player.id === originalPlayer.id,
    );
    const actualAmount = originalPlayer.hp - (resolvedPlayer?.hp ?? originalPlayer.hp);
    nextState = appendEvent(nextState, {
      eventKey: "lose_hp",
      params: { playerId: originalPlayer.id, amount: actualAmount },
    });
  }

  for (const originalPlayer of state.players) {
    const resolvedPlayer = playersWithEliminations.find(
      (player) => player.id === originalPlayer.id,
    );

    if (!originalPlayer.eliminated && resolvedPlayer?.eliminated) {
      nextState = appendEvent(nextState, {
        eventKey: "eliminated",
        params: { playerId: originalPlayer.id },
      });
    }
  }

  return finishGameIfResolved(nextState);
}
