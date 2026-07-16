import { cardDefinitions } from "../data/cardDefinitions";
import type { ResolveExperimentCounterattackAction } from "./actions";
import { applyDamage } from "./damage";
import { createExperimentCounterattackPursuitDamageContext } from "./damageContext";
import { canRecoverHp } from "./recovery";
import { resumeResponseContinuation } from "./responseContinuation";
import type {
  CardDefinition,
  CardInstanceId,
  DamageContext,
  DamageSource,
  ExperimentCounterattackOption,
  GameState,
  PendingExperimentCounterattack,
  Player,
  PlayerId,
  ResponseContinuation,
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

function getSourcePlayerId(source: DamageSource): PlayerId | null {
  return source.kind === "status" ? null : source.sourcePlayerId;
}

function cloneDamageSource(source: DamageSource): DamageSource {
  switch (source.kind) {
    case "card":
      return source.sourceSkillId
        ? { ...source, sourceSkillId: source.sourceSkillId }
        : {
            kind: "card",
            sourcePlayerId: source.sourcePlayerId,
            cardInstanceId: source.cardInstanceId,
            cardDefinitionId: source.cardDefinitionId,
          };
    case "diy":
      return { ...source };
    case "status":
      return { ...source };
    case "character-skill":
      return { ...source };
    default: {
      const exhaustiveSource: never = source;
      return exhaustiveSource;
    }
  }
}

function cloneDamageContext(context: DamageContext): DamageContext {
  return {
    ...context,
    source: cloneDamageSource(context.source),
    tags: [...context.tags],
  };
}

export function isLegalExperimentCounterattackMetalDefinition(
  definition: CardDefinition,
): boolean {
  return definition.type === "element" && definition.elementCategory === "metal";
}

export function isLegalExperimentCounterattackPursuitDefinition(
  definition: CardDefinition,
): boolean {
  return (
    definition.type === "substance" &&
    Number.isFinite(definition.baseDamage) &&
    (definition.baseDamage ?? 0) > 0 &&
    (definition.tags.includes("acid") || definition.tags.includes("base"))
  );
}

function getOwnedHandCardIds(
  state: GameState,
  player: Player,
  predicate: (definition: CardDefinition) => boolean,
): CardInstanceId[] {
  return player.hand.filter((cardInstanceId) => {
    const instance = state.cardInstances[cardInstanceId];
    const definition = instance ? definitionsById.get(instance.definitionId) : undefined;
    return Boolean(
      instance &&
        instance.ownerId === player.id &&
        instance.zone.type === "hand" &&
        instance.zone.playerId === player.id &&
        definition &&
        predicate(definition),
    );
  });
}

function getLegalOptions(
  state: GameState,
  responder: Player,
): Pick<
  PendingExperimentCounterattack,
  "legalOptions" | "legalMetalCardInstanceIds" | "legalPursuitCardInstanceIds"
> {
  const legalMetalCardInstanceIds = getOwnedHandCardIds(
    state,
    responder,
    isLegalExperimentCounterattackMetalDefinition,
  );
  const legalPursuitCardInstanceIds = getOwnedHandCardIds(
    state,
    responder,
    isLegalExperimentCounterattackPursuitDefinition,
  );
  const legalOptions: ExperimentCounterattackOption[] = [];

  if (canRecoverHp(responder)) {
    legalOptions.push("recover");
  }
  if (legalMetalCardInstanceIds.length > 0) {
    legalOptions.push("metal-counterattack");
  }
  if (legalPursuitCardInstanceIds.length > 0) {
    legalOptions.push("acid-base-pursuit");
  }

  return {
    legalOptions,
    legalMetalCardInstanceIds,
    legalPursuitCardInstanceIds,
  };
}

export function openExperimentCounterattackOrResume(input: {
  state: GameState;
  responderPlayerId: PlayerId;
  originalDamageContext: DamageContext;
  responseType: PendingExperimentCounterattack["responseType"];
  continuation: ResponseContinuation;
  shuffle: ShuffleFunction;
}): GameState {
  const { state, responderPlayerId, originalDamageContext, responseType } = input;
  const responder = state.players.find((player) => player.id === responderPlayerId);
  const attackerPlayerId = getSourcePlayerId(originalDamageContext.source);
  const attacker = attackerPlayerId
    ? state.players.find((player) => player.id === attackerPlayerId)
    : undefined;
  const canTrigger =
    state.phase !== "gameOver" &&
    originalDamageContext.responsePolicy === responseType &&
    Boolean(
      responder &&
        !responder.eliminated &&
        responder.characterId === "chemistry_enthusiast" &&
        !responder.characterUsage.perCycle.chemistry_enthusiast_counterattack &&
        attacker &&
        !attacker.eliminated &&
        attacker.id !== responder.id,
    );

  if (!canTrigger || !responder || !attacker) {
    return resumeResponseContinuation(state, input.continuation, input.shuffle);
  }

  const legal = getLegalOptions(state, responder);
  if (legal.legalOptions.length === 0) {
    return resumeResponseContinuation(state, input.continuation, input.shuffle);
  }

  return appendLog(
    {
      ...state,
      phase: "experimentCounterattackWindow",
      pendingResponse: undefined,
      pendingExperimentCounterattack: {
        responderPlayerId: responder.id,
        attackerPlayerId: attacker.id,
        originalDamageContext: cloneDamageContext(originalDamageContext),
        responseType,
        ...legal,
        continuation: input.continuation,
      },
    },
    `${responder.name} 成功完全抵消来自 ${attacker.name} 的攻击，进入实验反击选择窗口。`,
  );
}

function markCounterattackUsed(state: GameState, playerId: PlayerId): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            characterUsage: {
              ...player.characterUsage,
              perCycle: {
                ...player.characterUsage.perCycle,
                chemistry_enthusiast_counterattack: 1,
              },
            },
          }
        : player,
    ),
  };
}

function discardOwnedHandCard(
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
    instance.ownerId !== player.id ||
    instance.zone.type !== "hand" ||
    instance.zone.playerId !== player.id
  ) {
    return undefined;
  }

  return {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === player.id
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

function isValidPending(
  state: GameState,
  playerId: PlayerId,
): PendingExperimentCounterattack | undefined {
  const pending = state.pendingExperimentCounterattack;
  const responder = state.players.find((player) => player.id === playerId);
  const attacker = pending
    ? state.players.find((player) => player.id === pending.attackerPlayerId)
    : undefined;
  const sourcePlayerId = pending
    ? getSourcePlayerId(pending.originalDamageContext.source)
    : null;
  const hasValidSnapshots = Boolean(
    pending &&
      Array.isArray(pending.legalOptions) &&
      new Set(pending.legalOptions).size === pending.legalOptions.length &&
      pending.legalOptions.every(
        (option) =>
          option === "recover" ||
          option === "metal-counterattack" ||
          option === "acid-base-pursuit",
      ) &&
      Array.isArray(pending.legalMetalCardInstanceIds) &&
      Array.isArray(pending.legalPursuitCardInstanceIds),
  );
  const continuation = pending?.continuation;
  const hasValidContinuation = Boolean(
    continuation &&
      (continuation.kind === "single-response" ||
        (continuation.kind === "multi-target-response" &&
          continuation.completedResult.targetPlayerId === playerId &&
          continuation.completedResult.outcome === "absorbed" &&
          continuation.completedResult.finalDamage === 0 &&
          continuation.sequence.sourcePlayerId === pending?.attackerPlayerId &&
          continuation.sequence.sourceSkillId === "exhaust_leak" &&
          continuation.sequence.finishBehavior === "exhaust-leak" &&
          Array.isArray(continuation.sequence.targetPlayerIds) &&
          continuation.sequence.targetPlayerIds.includes(playerId) &&
          Array.isArray(continuation.sequence.remainingTargetPlayerIds) &&
          Array.isArray(continuation.sequence.completedResults))),
  );

  if (
    state.phase !== "experimentCounterattackWindow" ||
    !pending ||
    !hasValidSnapshots ||
    !hasValidContinuation ||
    pending.responderPlayerId !== playerId ||
    sourcePlayerId !== pending.attackerPlayerId ||
    pending.originalDamageContext.targetPlayerId !== playerId ||
    pending.originalDamageContext.responsePolicy !== pending.responseType ||
    !responder ||
    responder.eliminated ||
    responder.characterId !== "chemistry_enthusiast" ||
    responder.characterUsage.perCycle.chemistry_enthusiast_counterattack ||
    !attacker ||
    attacker.eliminated ||
    attacker.id === responder.id
  ) {
    return undefined;
  }

  return pending;
}

export function resolveExperimentCounterattack(
  state: GameState,
  action: ResolveExperimentCounterattackAction,
  shuffle: ShuffleFunction,
): GameState {
  const pending = isValidPending(state, action.playerId);
  const responder = state.players.find((player) => player.id === action.playerId);
  const attacker = pending
    ? state.players.find((player) => player.id === pending.attackerPlayerId)
    : undefined;

  if (!pending || !responder || !attacker) {
    return state;
  }

  if (action.option === "recover") {
    if (!pending.legalOptions.includes("recover") || !canRecoverHp(responder)) {
      return state;
    }

    const healedState: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === responder.id
          ? { ...player, hp: Math.min(player.maxHp, player.hp + 1) }
          : player,
      ),
    };
    const resolved = appendLog(
      markCounterattackUsed(healedState, responder.id),
      `${responder.name} 发动实验反击，回复 1 HP。`,
    );
    return resumeResponseContinuation(resolved, pending.continuation, shuffle);
  }

  if (action.option === "metal-counterattack") {
    return state;
  }

  const instance = state.cardInstances[action.cardInstanceId];
  const definition = instance ? definitionsById.get(instance.definitionId) : undefined;
  if (
    !pending.legalOptions.includes("acid-base-pursuit") ||
    !pending.legalPursuitCardInstanceIds.includes(action.cardInstanceId) ||
    !definition ||
    !isLegalExperimentCounterattackPursuitDefinition(definition)
  ) {
    return state;
  }

  const withCardDiscarded = discardOwnedHandCard(
    state,
    responder.id,
    action.cardInstanceId,
  );
  if (!withCardDiscarded) {
    return state;
  }

  const damageEffect = {
    type: "DAMAGE" as const,
    context: createExperimentCounterattackPursuitDamageContext({
      sourcePlayerId: responder.id,
      cardInstanceId: action.cardInstanceId,
      definition,
      targetPlayerId: attacker.id,
      baseAmount: definition.baseDamage ?? 0,
    }),
  };
  const withUsage = markCounterattackUsed(withCardDiscarded, responder.id);
  const applied = applyDamage(withUsage, damageEffect);
  const resolved = appendLog(
    applied.state,
    `${responder.name} 发动实验反击，使用 ${definition.name} 追击 ${attacker.name}，造成 ${applied.resolution.finalAmount} 点伤害。`,
  );

  return resumeResponseContinuation(resolved, pending.continuation, shuffle);
}
