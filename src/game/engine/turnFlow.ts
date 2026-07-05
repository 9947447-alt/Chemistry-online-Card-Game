import type { CardInstanceId, GameState, PlayerId } from "./types";

export type ShuffleFunction = <T>(items: readonly T[]) => T[];

function appendLog(state: GameState, message: string): GameState {
  const nextIndex = state.log.length + 1;
  return {
    ...state,
    log: [...state.log, { id: `log_${String(nextIndex).padStart(3, "0")}`, message }],
  };
}

function replacePlayer(state: GameState, playerId: PlayerId, update: (player: GameState["players"][number]) => GameState["players"][number]): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? update(player) : player)),
  };
}

function moveCardToHand(state: GameState, cardId: CardInstanceId, playerId: PlayerId): GameState {
  const card = state.cardInstances[cardId];
  return replacePlayer(
    {
      ...state,
      cardInstances: {
        ...state.cardInstances,
        [cardId]: {
          ...card,
          ownerId: playerId,
          zone: { type: "hand", playerId },
        },
      },
    },
    playerId,
    (player) => ({ ...player, hand: [...player.hand, cardId] }),
  );
}

function recycleDiscardIntoDeck(state: GameState, shuffle: ShuffleFunction): GameState {
  if (state.deck.length > 0 || state.discardPile.length === 0) {
    return state;
  }

  const recycledDeck = shuffle(state.discardPile);
  const cardInstances = { ...state.cardInstances };

  for (const cardId of recycledDeck) {
    cardInstances[cardId] = {
      ...cardInstances[cardId],
      ownerId: undefined,
      zone: { type: "deck" },
    };
  }

  return appendLog(
    {
      ...state,
      cardInstances,
      deck: recycledDeck,
      discardPile: [],
    },
    "主牌堆不足，弃牌堆洗回主牌堆。",
  );
}

function drawCardsForPlayer(
  state: GameState,
  playerId: PlayerId,
  count: number,
  shuffle: ShuffleFunction,
): GameState {
  let nextState = state;

  for (let drawn = 0; drawn < count; drawn += 1) {
    nextState = recycleDiscardIntoDeck(nextState, shuffle);

    const [cardId, ...remainingDeck] = nextState.deck;
    if (!cardId) {
      return appendLog(nextState, "主牌堆与弃牌堆均为空，摸牌停止。");
    }

    nextState = moveCardToHand(
      {
        ...nextState,
        deck: remainingDeck,
      },
      cardId,
      playerId,
    );
  }

  return nextState;
}

function discardAllHands(state: GameState): GameState {
  let cardInstances = { ...state.cardInstances };
  let discardPile = [...state.discardPile];

  const players = state.players.map((player) => {
    for (const cardId of player.hand) {
      cardInstances = {
        ...cardInstances,
        [cardId]: {
          ...cardInstances[cardId],
          ownerId: undefined,
          zone: { type: "discard" },
        },
      };
      discardPile = [...discardPile, cardId];
    }

    return {
      ...player,
      hand: [],
      usedDIYThisCycle: false,
    };
  });

  return appendLog(
    {
      ...state,
      players,
      cardInstances,
      discardPile,
      phase: "cleanup",
    },
    "实验周期结束，所有剩余手牌进入弃牌堆。",
  );
}

function startNextCycle(state: GameState, shuffle: ShuffleFunction): GameState {
  const nextStartingPlayer = state.players.find((player) => !player.eliminated);

  if (!nextStartingPlayer) {
    return finishGameIfResolved(state);
  }

  let nextState: GameState = {
    ...state,
    phase: "cycleStart",
    cycleNumber: state.cycleNumber + 1,
    roundInCycle: 1,
    activePlayerId: nextStartingPlayer.id,
    startingPlayerId: nextStartingPlayer.id,
  };

  nextState = appendLog(nextState, `进入第 ${nextState.cycleNumber} 实验周期。`);

  for (const player of nextState.players) {
    if (!player.eliminated) {
      nextState = drawCardsForPlayer(nextState, player.id, nextState.settings.handSize, shuffle);
    }
  }

  return {
    ...nextState,
    phase: "mainAction",
  };
}

export function dealInitialHands(state: GameState, shuffle: ShuffleFunction): GameState {
  let nextState = state;

  for (const player of nextState.players) {
    if (!player.eliminated) {
      nextState = drawCardsForPlayer(nextState, player.id, nextState.settings.handSize, shuffle);
    }
  }

  return nextState;
}

export function finishGameIfResolved(state: GameState): GameState {
  if (state.phase === "gameOver") {
    return state;
  }

  const survivors = state.players.filter((player) => !player.eliminated);

  if (survivors.length === 1) {
    return appendLog(
      {
        ...state,
        phase: "gameOver",
        activePlayerId: survivors[0].id,
        pendingResponse: undefined,
        effectQueue: [],
        winnerPlayerId: survivors[0].id,
        isDraw: undefined,
      },
      `${survivors[0].name} 获胜。`,
    );
  }

  if (survivors.length === 0) {
    return appendLog(
      {
        ...state,
        phase: "gameOver",
        pendingResponse: undefined,
        effectQueue: [],
        winnerPlayerId: undefined,
        isDraw: true,
      },
      "所有玩家均被淘汰，本局平局。",
    );
  }

  return state;
}

function findNextAlivePlayer(state: GameState, startIndex: number): GameState["players"][number] | undefined {
  return state.players.slice(startIndex).find((player) => !player.eliminated);
}

export function advanceTurnFromReducer(state: GameState, shuffle: ShuffleFunction): GameState {
  const resolvedState = finishGameIfResolved(state);
  if (resolvedState.phase === "gameOver") {
    return resolvedState;
  }

  const activeIndex = state.players.findIndex((player) => player.id === state.activePlayerId);
  const nextPlayer = findNextAlivePlayer(state, activeIndex + 1);

  if (nextPlayer) {
    return {
      ...appendLog(state, `轮到 ${nextPlayer.name} 行动。`),
      activePlayerId: nextPlayer.id,
      phase: "mainAction",
    };
  }

  if (state.roundInCycle < state.settings.roundsPerCycle) {
    const nextRound = (state.roundInCycle + 1) as GameState["roundInCycle"];
    const nextStartingPlayer = findNextAlivePlayer(state, 0);

    if (!nextStartingPlayer) {
      return finishGameIfResolved(state);
    }

    return {
      ...appendLog(state, `进入第 ${nextRound} 实验轮次。`),
      activePlayerId: nextStartingPlayer.id,
      startingPlayerId: nextStartingPlayer.id,
      roundInCycle: nextRound,
      phase: "mainAction",
    };
  }

  return startNextCycle(discardAllHands(state), shuffle);
}
