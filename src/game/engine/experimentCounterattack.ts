import { cardDefinitionsById } from "../data/cardDefinitions";
import type { ResolveExperimentCounterattackAction } from "./actions";
import { applyDamage } from "./damage";
import { createExperimentCounterattackPursuitDamageContext } from "./damageContext";
import { canRecoverHp } from "./recovery";
import { resumeResponseContinuation } from "./responseContinuation";
import { moveCardFromHandToDiscard } from "./resolution";
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
import { appendEvent } from "./logEvents";

function getSourcePlayerId(source: DamageSource): PlayerId | null {
  return source.kind === "status" ? null : source.sourcePlayerId;
}

const cloneDamageContext = (context: DamageContext): DamageContext => ({
  ...context,
  source: { ...context.source },
  tags: [...context.tags],
});

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
    const definition = instance ? cardDefinitionsById.get(instance.definitionId) : undefined;
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

  return appendEvent(
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
    {
      eventKey: "counterattack_window_open",
      params: { responderId: responder.id, attackerId: attacker.id },
    },
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

export function getValidPendingExperimentCounterattack(
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

export function validateExperimentCounterattackAction(
  state: GameState,
  action: ResolveExperimentCounterattackAction,
): boolean {
  const pending = getValidPendingExperimentCounterattack(state, action.playerId);
  const responder = state.players.find((player) => player.id === action.playerId);
  const attacker = pending
    ? state.players.find((player) => player.id === pending.attackerPlayerId)
    : undefined;

  if (!pending || !responder || !attacker) {
    return false;
  }

  if (action.option === "recover") {
    return pending.legalOptions.includes("recover") && canRecoverHp(responder);
  }

  if (action.option === "acid-base-pursuit") {
    if (
      !action.cardInstanceId ||
      !pending.legalOptions.includes("acid-base-pursuit") ||
      !pending.legalPursuitCardInstanceIds.includes(action.cardInstanceId)
    ) {
      return false;
    }
    const instance = state.cardInstances[action.cardInstanceId];
    const definition = instance ? cardDefinitionsById.get(instance.definitionId) : undefined;
    return Boolean(
      instance &&
      responder.hand.includes(action.cardInstanceId) &&
      instance.ownerId === responder.id &&
      instance.zone.type === "hand" &&
      instance.zone.playerId === responder.id &&
      definition &&
      isLegalExperimentCounterattackPursuitDefinition(definition),
    );
  }

  return false;
}

export function resolveExperimentCounterattack(
  state: GameState,
  action: ResolveExperimentCounterattackAction,
  shuffle: ShuffleFunction,
): GameState {
  if (!validateExperimentCounterattackAction(state, action)) {
    return state;
  }

  const pending = getValidPendingExperimentCounterattack(state, action.playerId)!;
  const responder = state.players.find((player) => player.id === action.playerId)!;
  const attacker = state.players.find((player) => player.id === pending.attackerPlayerId)!;

  if (action.option === "recover") {
    const healedState: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === responder.id
          ? { ...player, hp: Math.min(player.maxHp, player.hp + 1) }
          : player,
      ),
    };
    const resolved = appendEvent(
      markCounterattackUsed(healedState, responder.id),
      {
        eventKey: "counterattack_recover",
        params: { playerId: responder.id, amount: 1 },
      },
    );
    return resumeResponseContinuation(resolved, pending.continuation, shuffle);
  }

  if (action.option === "metal-counterattack") {
    return state;
  }

  const instance = state.cardInstances[action.cardInstanceId];
  const definition = instance ? cardDefinitionsById.get(instance.definitionId) : undefined;
  if (!definition) {
    return state;
  }

  const withCardDiscarded = moveCardFromHandToDiscard(
    state,
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
  const resolved = appendEvent(applied.state, {
    eventKey: "counterattack_pursuit",
    params: {
      playerId: responder.id,
      cardDefinitionId: definition.id,
      targetId: attacker.id,
      amount: applied.resolution.finalAmount,
    },
  });

  return resumeResponseContinuation(resolved, pending.continuation, shuffle);
}
