import type { CardInstanceId, GameState, Player, PlayerId, PlayerStatus } from "./types";

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

  return beginActionForPlayer(nextState, nextStartingPlayer.id);
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
        pendingStatusHandling: undefined,
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
        pendingStatusHandling: undefined,
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

function getOrderedStatuses(player: Player): PlayerStatus[] {
  return [...player.statuses].sort((left, right) => left.createdAt - right.createdAt);
}

export function beginActionForPlayer(state: GameState, playerId: PlayerId): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player || player.eliminated) {
    return state;
  }

  const [nextStatus] = getOrderedStatuses(player);

  if (!nextStatus) {
    return {
      ...state,
      activePlayerId: player.id,
      phase: "mainAction",
      pendingStatusHandling: undefined,
    };
  }

  return appendLog(
    {
      ...state,
      activePlayerId: player.id,
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId: player.id,
        statusInstanceId: nextStatus.id,
      },
    },
    `${player.name} 开始处理 ${nextStatus.statusId}。`,
  );
}

export function advanceTurnFromReducer(state: GameState, shuffle: ShuffleFunction): GameState {
  const resolvedState = finishGameIfResolved(state);
  if (resolvedState.phase === "gameOver") {
    return resolvedState;
  }

  const activeIndex = resolvedState.players.findIndex((player) => player.id === resolvedState.activePlayerId);
  const nextPlayer = findNextAlivePlayer(resolvedState, activeIndex + 1);

  if (nextPlayer) {
    return beginActionForPlayer(appendLog(resolvedState, `轮到 ${nextPlayer.name} 行动。`), nextPlayer.id);
  }

  if (resolvedState.roundInCycle < resolvedState.settings.roundsPerCycle) {
    const nextRound = (resolvedState.roundInCycle + 1) as GameState["roundInCycle"];
    const nextStartingPlayer = findNextAlivePlayer(resolvedState, 0);

    if (!nextStartingPlayer) {
      return finishGameIfResolved(resolvedState);
    }

    return beginActionForPlayer(
      {
        ...appendLog(resolvedState, `进入第 ${nextRound} 实验轮次。`),
        activePlayerId: nextStartingPlayer.id,
        startingPlayerId: nextStartingPlayer.id,
        roundInCycle: nextRound,
      },
      nextStartingPlayer.id,
    );
  }

  return startNextCycle(discardAllHands(resolvedState), shuffle);
}
