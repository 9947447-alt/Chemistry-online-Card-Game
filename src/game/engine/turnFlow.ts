import type { CardInstanceId, GameState, Player, PlayerId, PlayerStatus } from "./types";
import {
  resetCharacterUsageForNewCycle,
  resetCharacterUsageForNewRound,
} from "./characterUsage";
import { getAllowedDrawCount } from "./handCapacity";

export type ShuffleFunction = <T>(items: readonly T[]) => T[];

export function getAvailableDrawCardCount(state: GameState): number {
  return state.deck.length + state.discardPile.length;
}

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

export function drawCardsForPlayer(
  state: GameState,
  playerId: PlayerId,
  count: number,
  shuffle: ShuffleFunction,
): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player || player.eliminated) {
    return state;
  }

  let nextState = state;
  const allowedDrawCount = getAllowedDrawCount(player, count);

  for (let drawn = 0; drawn < allowedDrawCount; drawn += 1) {
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

function getCycleDrawCount(player: Player, defaultHandSize: number): number {
  if (player.characterId === "laboratory_teacher") {
    return 20;
  }

  if (player.characterId === "chemical_factory_ceo") {
    return 14;
  }

  return defaultHandSize;
}

export function dealCycleStartHands(state: GameState, shuffle: ShuffleFunction): GameState {
  let nextState = state;
  const preparationSelections: NonNullable<
    GameState["pendingLaboratoryPreparation"]
  >["remainingSelections"] = [];

  for (const originalPlayer of state.players) {
    if (originalPlayer.eliminated) {
      continue;
    }

    const playerBeforeDraw = nextState.players.find(
      (candidate) => candidate.id === originalPlayer.id,
    );

    if (!playerBeforeDraw) {
      continue;
    }

    const existingHandIds = new Set(playerBeforeDraw.hand);
    nextState = drawCardsForPlayer(
      nextState,
      playerBeforeDraw.id,
      getCycleDrawCount(playerBeforeDraw, nextState.settings.handSize),
      shuffle,
    );

    if (playerBeforeDraw.characterId === "laboratory_teacher") {
      const playerAfterDraw = nextState.players.find(
        (candidate) => candidate.id === playerBeforeDraw.id,
      );
      const selection = {
        playerId: playerBeforeDraw.id,
        candidateCardInstanceIds:
          playerAfterDraw?.hand.filter((cardId) => !existingHandIds.has(cardId)) ?? [],
      };

      if (selection.candidateCardInstanceIds.length !== 20) {
        return {
          ...nextState,
          phase: "setup",
          pendingLaboratoryPreparation: undefined,
        };
      }

      preparationSelections.push(selection);
    }
  }

  const [currentSelection, ...remainingSelections] = preparationSelections;

  if (!currentSelection) {
    return {
      ...nextState,
      pendingLaboratoryPreparation: undefined,
    };
  }

  return {
    ...nextState,
    phase: "preparationSelection",
    pendingLaboratoryPreparation: {
      ...currentSelection,
      keepCount: 10,
      remainingSelections,
    },
  };
}

function isValidLaboratoryPreparationSelection(
  state: GameState,
  selection: NonNullable<
    GameState["pendingLaboratoryPreparation"]
  >["remainingSelections"][number],
): boolean {
  const player = state.players.find((candidate) => candidate.id === selection.playerId);

  if (!Array.isArray(selection.candidateCardInstanceIds)) {
    return false;
  }

  const candidateIds = new Set(selection.candidateCardInstanceIds);

  return (
    player?.characterId === "laboratory_teacher" &&
    !player.eliminated &&
    selection.candidateCardInstanceIds.length === 20 &&
    candidateIds.size === 20 &&
    selection.candidateCardInstanceIds.every((cardId) => {
      const instance = state.cardInstances[cardId];
      return (
        player.hand.includes(cardId) &&
        instance?.ownerId === player.id &&
        instance.zone.type === "hand" &&
        instance.zone.playerId === player.id
      );
    })
  );
}

function isValidLaboratoryPreparationConfirmation(
  state: GameState,
  playerId: PlayerId,
  keptCardInstanceIds: CardInstanceId[],
): boolean {
  const pending = state.pendingLaboratoryPreparation;

  if (
    state.phase !== "preparationSelection" ||
    !pending ||
    !Array.isArray(pending.remainingSelections) ||
    pending.keepCount !== 10 ||
    pending.playerId !== playerId ||
    !isValidLaboratoryPreparationSelection(state, pending)
  ) {
    return false;
  }

  const remainingPlayerIds = pending.remainingSelections.map((selection) => selection.playerId);
  const uniqueRemainingPlayerIds = new Set(remainingPlayerIds);

  if (
    uniqueRemainingPlayerIds.size !== remainingPlayerIds.length ||
    uniqueRemainingPlayerIds.has(pending.playerId) ||
    !pending.remainingSelections.every((selection) =>
      isValidLaboratoryPreparationSelection(state, selection),
    )
  ) {
    return false;
  }

  const keptIds = new Set(keptCardInstanceIds);
  const candidateIds = new Set(pending.candidateCardInstanceIds);

  return (
    keptCardInstanceIds.length === 10 &&
    keptIds.size === 10 &&
    keptCardInstanceIds.every((cardId) => candidateIds.has(cardId))
  );
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
    tableReference: undefined,
    players: state.players.map(resetCharacterUsageForNewCycle),
  };

  nextState = appendLog(nextState, `进入第 ${nextState.cycleNumber} 实验周期。`);

  nextState = dealCycleStartHands(nextState, shuffle);

  if (nextState.phase !== "cycleStart") {
    return nextState;
  }

  return beginActionForPlayer(nextState, nextStartingPlayer.id);
}

export function confirmLaboratoryPreparation(
  state: GameState,
  playerId: PlayerId,
  keptCardInstanceIds: CardInstanceId[],
): GameState {
  const pending = state.pendingLaboratoryPreparation;
  const player = state.players.find((candidate) => candidate.id === playerId);
  const keptIds = new Set(keptCardInstanceIds);

  if (
    !pending ||
    !player ||
    !isValidLaboratoryPreparationConfirmation(state, playerId, keptCardInstanceIds)
  ) {
    return state;
  }

  const discardedIds = pending.candidateCardInstanceIds.filter((cardId) => !keptIds.has(cardId));
  const discardedIdSet = new Set(discardedIds);
  const cardInstances = { ...state.cardInstances };

  for (const cardId of discardedIds) {
    cardInstances[cardId] = {
      ...cardInstances[cardId],
      ownerId: undefined,
      zone: { type: "discard" },
    };
  }

  const resolved = appendLog(
    {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId
          ? {
              ...candidate,
              hand: candidate.hand.filter((cardId) => !discardedIdSet.has(cardId)),
            }
          : candidate,
      ),
      cardInstances,
      discardPile: [...state.discardPile, ...discardedIds],
    },
    `${player.name} 完成备课，保留 ${pending.keepCount} 张牌。`,
  );
  const [nextSelection, ...remainingSelections] = pending.remainingSelections;

  if (nextSelection) {
    return {
      ...resolved,
      phase: "preparationSelection",
      pendingLaboratoryPreparation: {
        ...nextSelection,
        keepCount: 10,
        remainingSelections,
      },
    };
  }

  return beginActionForPlayer(
    {
      ...resolved,
      pendingLaboratoryPreparation: undefined,
    },
    resolved.startingPlayerId,
  );
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
        players: resolvedState.players.map(resetCharacterUsageForNewRound),
      },
      nextStartingPlayer.id,
    );
  }

  return startNextCycle(discardAllHands(resolvedState), shuffle);
}
