import { cardDefinitions } from "../data/cardDefinitions";
import { applyDamage } from "./damage";
import { openExperimentCounterattackOrResume } from "./experimentCounterattack";
import {
  createExhaustLeakPendingResponse,
  resumeResponseContinuation,
} from "./responseContinuation";
import {
  createImmediateSo2AbsorptionReactionEvent,
  recordSuccessfulReaction,
} from "./reactions";
import type {
  CardDefinition,
  CardInstanceId,
  GameState,
  MultiTargetPendingResponse,
  MultiTargetResponseResult,
  MultiTargetResponseSequence,
  PlayerId,
} from "./types";
import type { ShuffleFunction } from "./turnFlow";

const definitionsById = new Map<string, CardDefinition>(
  cardDefinitions.map((definition) => [definition.id, definition]),
);

function appendLog(state: GameState, message: string): GameState {
  const nextIndex = state.log.length + 1;
  return {
    ...state,
    log: [...state.log, { id: `log_${String(nextIndex).padStart(3, "0")}`, message }],
  };
}

export function startExhaustLeakResponseSequence(
  state: GameState,
  sourcePlayerId: PlayerId,
  targetPlayerIds: readonly PlayerId[],
): GameState {
  const [currentTargetPlayerId, ...remainingTargetPlayerIds] = targetPlayerIds;
  if (!currentTargetPlayerId) {
    return state;
  }

  const sequence: MultiTargetResponseSequence = {
    sourcePlayerId,
    sourceSkillId: "exhaust_leak",
    targetPlayerIds: [...targetPlayerIds],
    remainingTargetPlayerIds,
    completedResults: [],
    finishBehavior: "exhaust-leak",
  };

  return {
    ...state,
    phase: "responseWindow",
    pendingResponse: createExhaustLeakPendingResponse(sequence, currentTargetPlayerId),
  };
}

export function isMultiTargetPendingResponse(
  state: GameState,
): state is GameState & { pendingResponse: MultiTargetPendingResponse } {
  return state.pendingResponse?.multiTargetSequence !== undefined;
}

export function isAlkalineAbsorptionDefinition(definition: CardDefinition): boolean {
  return (
    (definition.type === "ion" || definition.type === "substance") &&
    definition.allowedTimings.includes("status-window") &&
    definition.tags.includes("alkaline-absorb")
  );
}

function discardResponseCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState | undefined {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const instance = state.cardInstances[cardInstanceId];

  if (
    !player ||
    !player.hand.includes(cardInstanceId) ||
    !instance ||
    instance.ownerId !== playerId ||
    instance.zone.type !== "hand" ||
    instance.zone.playerId !== playerId
  ) {
    return undefined;
  }

  return {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId
        ? {
            ...candidate,
            hand: candidate.hand.filter((heldCardId) => heldCardId !== cardInstanceId),
          }
        : candidate,
    ),
    cardInstances: {
      ...state.cardInstances,
      [cardInstanceId]: {
        ...instance,
        ownerId: undefined,
        zone: { type: "discard" },
      },
    },
    discardPile: [...state.discardPile, cardInstanceId],
  };
}

function getValidPendingResponse(
  state: GameState,
  playerId: PlayerId,
): MultiTargetPendingResponse | undefined {
  if (!isMultiTargetPendingResponse(state)) {
    return undefined;
  }

  const pendingResponse = state.pendingResponse;
  const context = pendingResponse.sourceEffect.context;
  const sequence = pendingResponse.multiTargetSequence;
  const responder = state.players.find((player) => player.id === playerId);

  if (
    state.phase !== "responseWindow" ||
    pendingResponse.responderId !== playerId ||
    !responder ||
    responder.eliminated ||
    context.targetPlayerId !== playerId ||
    context.responsePolicy !== "alkali-absorption" ||
    context.source.kind !== "character-skill" ||
    context.source.sourcePlayerId !== sequence.sourcePlayerId ||
    context.source.skillId !== sequence.sourceSkillId ||
    !context.tags.includes("so2") ||
    context.tags.includes("status")
  ) {
    return undefined;
  }

  return pendingResponse;
}

export function respondToMultiTargetDamage(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  shuffle: ShuffleFunction,
): GameState {
  const pendingResponse = getValidPendingResponse(state, playerId);
  const instance = state.cardInstances[cardInstanceId];
  const definition = instance ? definitionsById.get(instance.definitionId) : undefined;

  if (!pendingResponse || !definition || !isAlkalineAbsorptionDefinition(definition)) {
    return state;
  }

  const reactionEvent = createImmediateSo2AbsorptionReactionEvent({
    context: pendingResponse.sourceEffect.context,
    responsePlayerId: playerId,
    responseCardInstanceId: cardInstanceId,
    responseCardDefinitionId: definition.id,
  });

  if (!reactionEvent) {
    return state;
  }

  const withCardDiscarded = discardResponseCard(state, playerId, cardInstanceId);
  if (!withCardDiscarded) {
    return state;
  }

  const responder = state.players.find((player) => player.id === playerId);
  const withReaction = recordSuccessfulReaction({
    stateBeforeReaction: state,
    resolvedState: withCardDiscarded,
    event: reactionEvent,
    message: `${responder?.name ?? playerId} 使用 ${definition.name} 碱性吸收，完全抵消尾气泄漏伤害。`,
    shuffle,
  });

  if (withReaction === state) {
    return state;
  }

  const completedResult: MultiTargetResponseResult = {
    targetPlayerId: playerId,
    outcome: "absorbed",
    finalDamage: 0,
  };
  return openExperimentCounterattackOrResume({
    state: withReaction,
    responderPlayerId: playerId,
    originalDamageContext: pendingResponse.sourceEffect.context,
    responseType: "alkali-absorption",
    continuation: {
      kind: "multi-target-response",
      sequence: pendingResponse.multiTargetSequence,
      completedResult,
    },
    shuffle,
  });
}

export function passMultiTargetDamageResponse(
  state: GameState,
  playerId: PlayerId,
  shuffle: ShuffleFunction,
): GameState {
  const pendingResponse = getValidPendingResponse(state, playerId);
  if (!pendingResponse) {
    return state;
  }

  const appliedDamage = applyDamage(state, pendingResponse.sourceEffect);
  const target = state.players.find((player) => player.id === playerId);
  const withLog = appendLog(
    appliedDamage.state,
    `${target?.name ?? playerId} 放弃碱性吸收，受到 ${appliedDamage.resolution.finalAmount} 点 SO2 伤害。`,
  );

  return resumeResponseContinuation(
    withLog,
    {
      kind: "multi-target-response",
      sequence: pendingResponse.multiTargetSequence,
      completedResult: {
        targetPlayerId: playerId,
        outcome: "damaged",
        finalDamage: appliedDamage.resolution.finalAmount,
      },
    },
    shuffle,
  );
}
