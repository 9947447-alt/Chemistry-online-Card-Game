import type { CardInstanceId, GameState, Player, PlayerId, PlayerStatus } from "./types";
import {
  resetCharacterUsageForNewCycle,
  resetCharacterUsageForNewRound,
} from "./characterUsage";
import { getAllowedDrawCount } from "./handCapacity";
import { appendEvent } from "./logEvents";

export type ShuffleFunction = <T>(items: readonly T[]) => T[];

export function getAvailableDrawCardCount(state: GameState): number {
  return state.deck.length + state.discardPile.length;
}

function replacePlayer(state: GameState, playerId: PlayerId, update: (p: Player) => Player): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? update(p) : p)) };
}

function moveCardToHand(state: GameState, cardId: CardInstanceId, playerId: PlayerId): GameState {
  return replacePlayer(
    { ...state, cardInstances: { ...state.cardInstances, [cardId]: { ...state.cardInstances[cardId], ownerId: playerId, zone: { type: "hand", playerId } } } },
    playerId,
    (p) => ({ ...p, hand: [...p.hand, cardId] }),
  );
}

function recycleDiscardIntoDeck(state: GameState, shuffle: ShuffleFunction): GameState {
  if (state.deck.length > 0 || state.discardPile.length === 0) return state;
  const deck = shuffle(state.discardPile);
  const cardInstances = { ...state.cardInstances };
  for (const id of deck) cardInstances[id] = { ...cardInstances[id], ownerId: undefined, zone: { type: "deck" } };
  return appendEvent({ ...state, cardInstances, deck, discardPile: [] }, { eventKey: "recycle_discard_into_deck", params: {} });
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
      return appendEvent(nextState, { eventKey: "draw_stopped_empty", params: {} });
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

export function isValidLaboratoryPreparationSelection(
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

export function getValidLaboratoryPreparationContext(
  state: GameState,
): NonNullable<GameState["pendingLaboratoryPreparation"]> | undefined {
  const pending = state.pendingLaboratoryPreparation;
  if (
    state.phase !== "preparationSelection" ||
    !pending ||
    !Array.isArray(pending.remainingSelections) ||
    pending.keepCount !== 10 ||
    !isValidLaboratoryPreparationSelection(state, pending)
  ) {
    return undefined;
  }

  const selectionPlayerIds = [
    pending.playerId,
    ...pending.remainingSelections.map((selection) => selection.playerId),
  ];
  if (
    new Set(selectionPlayerIds).size !== selectionPlayerIds.length ||
    !pending.remainingSelections.every((selection) =>
      isValidLaboratoryPreparationSelection(state, selection),
    )
  ) {
    return undefined;
  }

  return pending;
}

export function isValidLaboratoryPreparationConfirmation(
  state: GameState,
  playerId: PlayerId,
  keptCardInstanceIds: CardInstanceId[],
): boolean {
  const pending = getValidLaboratoryPreparationContext(state);

  if (!pending || pending.playerId !== playerId) {
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

  return appendEvent(
    {
      ...state,
      players,
      cardInstances,
      discardPile,
      phase: "cleanup",
    },
    { eventKey: "cycle_cleanup_discard_hands", params: {} },
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

  nextState = appendEvent(nextState, {
    eventKey: "cycle_start",
    params: { cycleNumber: nextState.cycleNumber },
  });

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

  const resolved = appendEvent(
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
    {
      eventKey: "laboratory_preparation_confirmed",
      params: { playerId, keepCount: pending.keepCount },
    },
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
    return appendEvent(
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
      { eventKey: "winner", params: { playerId: survivors[0].id } },
    );
  }

  if (survivors.length === 0) {
    return appendEvent(
      {
        ...state,
        phase: "gameOver",
        pendingResponse: undefined,
        pendingStatusHandling: undefined,
        effectQueue: [],
        winnerPlayerId: undefined,
        isDraw: true,
      },
      { eventKey: "draw_game", params: {} },
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

  return appendEvent(
    {
      ...state,
      activePlayerId: player.id,
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId: player.id,
        statusInstanceId: nextStatus.id,
      },
    },
    {
      eventKey: "status_window_start",
      params: { playerId: player.id, statusId: nextStatus.statusId },
    },
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
    return beginActionForPlayer(
      appendEvent(resolvedState, {
        eventKey: "turn_start",
        params: { playerId: nextPlayer.id },
      }),
      nextPlayer.id,
    );
  }

  if (resolvedState.roundInCycle < resolvedState.settings.roundsPerCycle) {
    const nextRound = (resolvedState.roundInCycle + 1) as GameState["roundInCycle"];
    const nextStartingPlayer = findNextAlivePlayer(resolvedState, 0);

    if (!nextStartingPlayer) {
      return finishGameIfResolved(resolvedState);
    }

    return beginActionForPlayer(
      {
        ...appendEvent(resolvedState, {
          eventKey: "round_start",
          params: { roundInCycle: nextRound },
        }),
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
