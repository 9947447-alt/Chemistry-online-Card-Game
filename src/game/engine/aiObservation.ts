import { cardDefinitionsById } from "../data/cardDefinitions";
import type { SuccessfulReactionEvent } from "./reactions";
import type {
  CardDefinition,
  CardInstanceId,
  CharacterId,
  CharacterUsageState,
  GameLogEntry,
  GamePhase,
  GameState,
  PlayerId,
  PlayerStatus,
  TableReference,
} from "./types";

export type AIObservationSelf = Readonly<{
  playerId: PlayerId;
  name: string;
  characterId: CharacterId;
  hp: number;
  maxHp: number;
  hand: readonly CardInstanceId[];
  handCards: readonly Readonly<CardDefinition>[];
  statuses: readonly Readonly<PlayerStatus>[];
  eliminated: boolean;
  usedDIYThisCycle: boolean;
  characterUsage: Readonly<CharacterUsageState>;
}>;

export type AIObservationOpponent = Readonly<{
  playerId: PlayerId;
  name: string;
  characterId: CharacterId;
  hp: number;
  maxHp: number;
  handCount: number;
  statuses: readonly Readonly<PlayerStatus>[];
  eliminated: boolean;
  usedDIYThisCycle: boolean;
  characterUsage: Readonly<CharacterUsageState>;
}>;

export type AIObservationDiscardCard = Readonly<{
  cardInstanceId: CardInstanceId;
  definition: Readonly<CardDefinition>;
}>;

export type AIObservationPendingContext =
  | { readonly kind: "none" }
  | {
      readonly kind: "response";
      readonly responderId: PlayerId;
      readonly chainDepth: number;
    }
  | {
      readonly kind: "status";
      readonly playerId: PlayerId;
      readonly statusInstanceId: string;
    }
  | {
      readonly kind: "experimentCounterattack";
      readonly responderPlayerId: PlayerId;
      readonly attackerPlayerId: PlayerId;
      readonly responseType: "acid-base" | "alkali-absorption";
    }
  | {
      readonly kind: "laboratoryPreparation";
      readonly playerId: PlayerId;
      readonly keepCount: 10;
      readonly candidateCardInstanceIds?: readonly CardInstanceId[];
    };

export type AIObservation = Readonly<{
  viewerPlayerId: PlayerId;
  gameId: string;
  phase: GamePhase;
  cycleNumber: number;
  roundInCycle: 1 | 2 | 3;
  activePlayerId: PlayerId;
  startingPlayerId: PlayerId;
  deckCount: number;
  discardPile: readonly CardInstanceId[];
  discardPileCards: readonly AIObservationDiscardCard[];
  tableReference?: Readonly<TableReference>;
  self: AIObservationSelf;
  opponents: readonly AIObservationOpponent[];
  pendingContext: AIObservationPendingContext;
  log: readonly Readonly<GameLogEntry>[];
  winnerPlayerId?: PlayerId;
  isDraw?: boolean;
}>;

function cloneCharacterUsage(usage: CharacterUsageState): CharacterUsageState {
  return {
    perCycle: { ...usage.perCycle },
    perRound: { ...usage.perRound },
  };
}

function cloneStatuses(statuses: readonly PlayerStatus[]): PlayerStatus[] {
  return statuses.map((status) => ({
    id: status.id,
    statusId: status.statusId,
    sourcePlayerId: status.sourcePlayerId,
    createdAt: status.createdAt,
  }));
}

function cloneTableReference(
  tableRef?: TableReference,
): TableReference | undefined {
  if (!tableRef) {
    return undefined;
  }
  return {
    cardInstanceId: tableRef.cardInstanceId,
    definitionId: tableRef.definitionId,
    displayName: tableRef.displayName,
    playedBy: tableRef.playedBy,
    cycle: tableRef.cycle,
    round: tableRef.round,
  };
}

function cloneSuccessfulReactionEvent(
  reaction: SuccessfulReactionEvent,
): SuccessfulReactionEvent {
  return {
    ...reaction,
    trigger: { ...reaction.trigger },
    participants: reaction.participants.map((p) => ({ ...p })) as any,
    outcome: { ...reaction.outcome },
  } as SuccessfulReactionEvent;
}

function cloneLog(log: readonly GameLogEntry[]): GameLogEntry[] {
  return log.map((entry) => {
    if (entry.eventKey === "reaction") {
      return {
        id: entry.id,
        eventKey: "reaction" as const,
        params: { ...entry.params },
        reaction: cloneSuccessfulReactionEvent(entry.reaction),
      };
    }
    return {
      id: entry.id,
      eventKey: entry.eventKey,
      params: { ...entry.params },
    };
  }) as GameLogEntry[];
}

function projectPendingContext(
  state: GameState,
  viewerPlayerId: PlayerId,
): AIObservationPendingContext {
  if (state.phase === "responseWindow" && state.pendingResponse) {
    return {
      kind: "response",
      responderId: state.pendingResponse.responderId,
      chainDepth: state.pendingResponse.chainDepth,
    };
  }

  if (state.phase === "statusWindow" && state.pendingStatusHandling) {
    return {
      kind: "status",
      playerId: state.pendingStatusHandling.playerId,
      statusInstanceId: state.pendingStatusHandling.statusInstanceId,
    };
  }

  if (
    state.phase === "experimentCounterattackWindow" &&
    state.pendingExperimentCounterattack
  ) {
    return {
      kind: "experimentCounterattack",
      responderPlayerId: state.pendingExperimentCounterattack.responderPlayerId,
      attackerPlayerId: state.pendingExperimentCounterattack.attackerPlayerId,
      responseType: state.pendingExperimentCounterattack.responseType,
    };
  }

  if (state.phase === "preparationSelection" && state.pendingLaboratoryPreparation) {
    const isViewer = state.pendingLaboratoryPreparation.playerId === viewerPlayerId;
    return {
      kind: "laboratoryPreparation",
      playerId: state.pendingLaboratoryPreparation.playerId,
      keepCount: 10,
      ...(isViewer
        ? {
            candidateCardInstanceIds: [
              ...state.pendingLaboratoryPreparation.candidateCardInstanceIds,
            ],
          }
        : {}),
    };
  }

  return { kind: "none" };
}

export function cloneCardDefinition(def: CardDefinition): CardDefinition {
  return {
    ...def,
    elements: def.elements ? [...def.elements] : undefined,
    ionsProvided: def.ionsProvided ? [...def.ionsProvided] : undefined,
    tags: [...def.tags],
    allowedTimings: [...def.allowedTimings],
  };
}

export function getAIObservation(
  state: GameState,
  viewerPlayerId: PlayerId,
): AIObservation {
  const viewerPlayer = state.players.find((player) => player.id === viewerPlayerId);

  const self: AIObservationSelf = viewerPlayer
    ? {
        playerId: viewerPlayer.id,
        name: viewerPlayer.name,
        characterId: viewerPlayer.characterId,
        hp: viewerPlayer.hp,
        maxHp: viewerPlayer.maxHp,
        hand: [...viewerPlayer.hand],
        handCards: viewerPlayer.hand
          .map((cardId) => {
            const instance = state.cardInstances[cardId];
            return instance ? cardDefinitionsById.get(instance.definitionId) : undefined;
          })
          .filter((definition): definition is CardDefinition => definition !== undefined)
          .map(cloneCardDefinition),
        statuses: cloneStatuses(viewerPlayer.statuses),
        eliminated: viewerPlayer.eliminated,
        usedDIYThisCycle: viewerPlayer.usedDIYThisCycle,
        characterUsage: cloneCharacterUsage(viewerPlayer.characterUsage),
      }
    : {
        playerId: viewerPlayerId,
        name: "Unknown",
        characterId: "laboratory_teacher",
        hp: 0,
        maxHp: 0,
        hand: [],
        handCards: [],
        statuses: [],
        eliminated: true,
        usedDIYThisCycle: false,
        characterUsage: { perCycle: {}, perRound: {} },
      };

  const opponents: AIObservationOpponent[] = state.players
    .filter((player) => player.id !== viewerPlayerId)
    .map((opponent) => ({
      playerId: opponent.id,
      name: opponent.name,
      characterId: opponent.characterId,
      hp: opponent.hp,
      maxHp: opponent.maxHp,
      handCount: opponent.hand.length,
      statuses: cloneStatuses(opponent.statuses),
      eliminated: opponent.eliminated,
      usedDIYThisCycle: opponent.usedDIYThisCycle,
      characterUsage: cloneCharacterUsage(opponent.characterUsage),
    }));

  const discardPileCards: AIObservationDiscardCard[] = state.discardPile.map(
    (cardInstanceId) => {
      const instance = state.cardInstances[cardInstanceId];
      const def = instance ? cardDefinitionsById.get(instance.definitionId) : undefined;
      const definition = def
        ? cloneCardDefinition(def)
        : {
            id: instance?.definitionId ?? "unknown",
            name: "Unknown Card",
            type: "substance" as const,
            formula: "Unknown",
            tags: [],
            allowedTimings: [],
            rulesText: "",
          };
      return {
        cardInstanceId,
        definition,
      };
    },
  );

  return {
    viewerPlayerId,
    gameId: state.id,
    phase: state.phase,
    cycleNumber: state.cycleNumber,
    roundInCycle: state.roundInCycle,
    activePlayerId: state.activePlayerId,
    startingPlayerId: state.startingPlayerId,
    deckCount: state.deck.length,
    discardPile: [...state.discardPile],
    discardPileCards,
    tableReference: cloneTableReference(state.tableReference),
    self,
    opponents,
    pendingContext: projectPendingContext(state, viewerPlayerId),
    log: cloneLog(state.log),
    winnerPlayerId: state.winnerPlayerId,
    isDraw: state.isDraw,
  };
}
