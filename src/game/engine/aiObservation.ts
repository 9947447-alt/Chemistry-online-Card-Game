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

const cloneStatuses = (statuses: readonly PlayerStatus[]) =>
  statuses.map((s) => ({ ...s }));

const cloneTableReference = (t?: TableReference) => (t ? { ...t } : undefined);

const cloneReaction = (r: SuccessfulReactionEvent): SuccessfulReactionEvent =>
  ({
    ...r,
    participants: r.participants.map((p) => ({ ...p })),
    outcome: { ...r.outcome },
  }) as unknown as SuccessfulReactionEvent;

const cloneLog = (log: readonly GameLogEntry[]): readonly GameLogEntry[] =>
  log.map((e) => (e.reaction ? { ...e, reaction: cloneReaction(e.reaction) } : { ...e }));

const cloneUsage = (u: CharacterUsageState) => ({
  perCycle: { ...u.perCycle },
  perRound: { ...u.perRound },
});

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

export const cloneCardDefinition = (def: CardDefinition): CardDefinition => ({
  ...def,
  tags: [...def.tags],
  allowedTimings: [...def.allowedTimings],
  elements: def.elements ? [...def.elements] : undefined,
});

export function getAIObservation(state: GameState, viewerPlayerId: PlayerId): AIObservation {
  const v = state.players.find((p) => p.id === viewerPlayerId);

  const self: AIObservationSelf = v
    ? {
        playerId: v.id,
        name: v.name,
        characterId: v.characterId,
        hp: v.hp,
        maxHp: v.maxHp,
        hand: [...v.hand],
        handCards: v.hand
          .map((id) => cardDefinitionsById.get(state.cardInstances[id]?.definitionId ?? ""))
          .filter((d): d is CardDefinition => Boolean(d))
          .map(cloneCardDefinition),
        statuses: v.statuses.map((s) => ({ ...s })),
        eliminated: v.eliminated,
        usedDIYThisCycle: v.usedDIYThisCycle,
        characterUsage: cloneUsage(v.characterUsage),
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
    .filter((p) => p.id !== viewerPlayerId)
    .map((op) => ({
      playerId: op.id,
      name: op.name,
      characterId: op.characterId,
      hp: op.hp,
      maxHp: op.maxHp,
      handCount: op.hand.length,
      statuses: op.statuses.map((s) => ({ ...s })),
      eliminated: op.eliminated,
      usedDIYThisCycle: op.usedDIYThisCycle,
      characterUsage: cloneUsage(op.characterUsage),
    }));

  const discardPileCards: AIObservationDiscardCard[] = state.discardPile.map((id) => {
    const def = cardDefinitionsById.get(state.cardInstances[id]?.definitionId ?? "");
    return {
      cardInstanceId: id,
      definition: def
        ? cloneCardDefinition(def)
        : { id: state.cardInstances[id]?.definitionId ?? "unknown", name: "Unknown Card", type: "substance" as const, formula: "Unknown", tags: [], allowedTimings: [], rulesText: "" },
    };
  });

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
    tableReference: state.tableReference ? { ...state.tableReference } : undefined,
    self,
    opponents,
    pendingContext: projectPendingContext(state, viewerPlayerId),
    log: cloneLog(state.log),
    winnerPlayerId: state.winnerPlayerId,
    isDraw: state.isDraw,
  };
}
