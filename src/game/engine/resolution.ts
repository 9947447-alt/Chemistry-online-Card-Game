import { cardDefinitionsById } from "../data/cardDefinitions";
import { canPlayCardAgainstTableReference } from "./cardAssociation";
import {
  createCardDamageContext,
  createStatusDamageContext,
  getAcidBaseDamageTag,
} from "./damageContext";
import { applyDamage } from "./damage";
import { openExperimentCounterattackOrResume } from "./experimentCounterattack";
import {
  getValidMultiTargetPendingResponse,
  isAlkalineAbsorptionDefinition,
  isMultiTargetPendingResponse,
  passMultiTargetDamageResponse,
  respondToMultiTargetDamage,
} from "./multiTargetResponse";
import {
  createAcidBaseResponseReactionEvent,
  createSo2StatusHandlingReactionEvent,
  recordSuccessfulReaction,
} from "./reactions";
import { canRecoverHp } from "./recovery";
import type {
  CardDefinition,
  CardInstanceId,
  DamageEffect,
  DamageSource,
  GameState,
  Player,
  PlayerId,
  PlayerStatus,
} from "./types";
import { advanceTurnFromReducer, finishGameIfResolved, type ShuffleFunction } from "./turnFlow";
import { appendEvent } from "./logEvents";

export function getPlayer(state: GameState, playerId: PlayerId): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}

function getDefinitionForCard(
  state: GameState,
  cardInstanceId: CardInstanceId,
): CardDefinition | undefined {
  const instance = state.cardInstances[cardInstanceId];
  return instance ? cardDefinitionsById.get(instance.definitionId) : undefined;
}

function setTableReference(
  state: GameState,
  actor: Player,
  cardInstanceId: CardInstanceId,
  definition: CardDefinition,
): GameState {
  return {
    ...state,
    tableReference: {
      cardInstanceId,
      definitionId: definition.id,
      displayName: definition.name,
      playedBy: actor.id,
      cycle: state.cycleNumber,
      round: state.roundInCycle,
    },
  };
}

export function replacePlayer(state: GameState, playerId: PlayerId, nextPlayer: Player): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? nextPlayer : player)),
  };
}

export function moveCardFromHandToDiscard(
  state: GameState,
  cardInstanceId: CardInstanceId,
): GameState | undefined {
  const holder = state.players.find((player) => player.hand.includes(cardInstanceId));
  const instance = state.cardInstances[cardInstanceId];

  if (!holder || !instance) {
    return undefined;
  }

  return replacePlayer(
    {
      ...state,
      cardInstances: {
        ...state.cardInstances,
        [cardInstanceId]: {
          ...instance,
          ownerId: undefined,
          zone: { type: "discard" },
        },
      },
      discardPile: [...state.discardPile, cardInstanceId],
    },
    holder.id,
    {
      ...holder,
      hand: holder.hand.filter((heldCardId) => heldCardId !== cardInstanceId),
    },
  );
}

export function getAcidBaseDamageKind(definition: CardDefinition): "acid" | "base" | undefined {
  if (definition.tags.includes("acid")) {
    return "acid";
  }

  if (definition.tags.includes("base")) {
    return "base";
  }

  return undefined;
}

export function canNeutralize(
  incomingDamageKind: "acid" | "base",
  responseDefinition: CardDefinition,
): boolean {
  if (!responseDefinition.allowedTimings.includes("response")) {
    return false;
  }

  if (responseDefinition.type !== "ion" && responseDefinition.type !== "substance") {
    return false;
  }

  if (incomingDamageKind === "acid") {
    return responseDefinition.tags.includes("base");
  }

  return responseDefinition.tags.includes("acid");
}

export function canGenerateCarbonDioxideAgainstAcid(
  incomingDamageKind: "acid" | "base",
  responseDefinition: CardDefinition,
): boolean {
  const isCarbonateResponder =
    responseDefinition.id === "ion_co3" || responseDefinition.id === "substance_na2co3";

  return (
    incomingDamageKind === "acid" &&
    isCarbonateResponder &&
    (responseDefinition.type === "ion" || responseDefinition.type === "substance") &&
    responseDefinition.allowedTimings.includes("response")
  );
}


function discardAttackSourceCardIfNeeded(
  state: GameState,
  source: DamageSource,
): GameState | undefined {
  if (source.kind !== "card") {
    return state;
  }

  return moveCardFromHandToDiscard(state, source.cardInstanceId);
}

function getOrderedStatuses(player: Player): PlayerStatus[] {
  return [...player.statuses].sort((left, right) => left.createdAt - right.createdAt);
}

function enterNextStatusWindowOrMainAction(
  state: GameState,
  playerId: PlayerId,
  afterCreatedAt: number,
): GameState {
  const player = getPlayer(state, playerId);

  if (!player || player.eliminated) {
    return state;
  }

  const nextStatus = getOrderedStatuses(player).find((status) => status.createdAt > afterCreatedAt);

  if (!nextStatus) {
    return {
      ...state,
      phase: "mainAction",
      pendingStatusHandling: undefined,
    };
  }

  return appendEvent(
    {
      ...state,
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId,
        statusInstanceId: nextStatus.id,
      },
    },
    {
      eventKey: "status_window_start",
      params: { playerId, statusId: nextStatus.statusId },
    },
  );
}

export function addStatusIfMissing(
  state: GameState,
  targetPlayerId: PlayerId,
  sourcePlayerId: PlayerId,
  statusId: PlayerStatus["statusId"],
): GameState {
  const target = getPlayer(state, targetPlayerId);

  if (!target) {
    return state;
  }

  const existingStatus = target.statuses.find((status) => status.statusId === statusId);

  if (existingStatus) {
    return appendEvent(state, {
      eventKey: "status_refreshed",
      params: { playerId: target.id, statusId },
    });
  }

  const status: PlayerStatus = {
    id: `status_${String(state.log.length + 1).padStart(3, "0")}_${target.id}_${statusId}`,
    statusId,
    sourcePlayerId,
    createdAt: state.log.length + 1,
  };

  return appendEvent(
    replacePlayer(state, target.id, {
      ...target,
      statuses: [...target.statuses, status],
    }),
    {
      eventKey: "status_gained",
      params: { playerId: target.id, statusId },
    },
  );
}

function removeStatusFromPlayer(
  state: GameState,
  playerId: PlayerId,
  statusInstanceId: string,
): GameState {
  const player = getPlayer(state, playerId);

  if (!player) {
    return state;
  }

  return replacePlayer(state, playerId, {
    ...player,
    statuses: player.statuses.filter((status) => status.id !== statusInstanceId),
  });
}

function playSulfurDioxideCard(
  state: GameState,
  actor: Player,
  target: Player,
  definition: CardDefinition,
  cardInstanceId: CardInstanceId,
  shuffle: ShuffleFunction,
): GameState {
  const withCardDiscarded = moveCardFromHandToDiscard(state, cardInstanceId);

  if (!withCardDiscarded) {
    return state;
  }

  const withStatus = addStatusIfMissing(withCardDiscarded, target.id, actor.id, "SO2_LEAK");

  const resolved = appendEvent(
    setTableReference(
      {
        ...withStatus,
        phase: "mainAction",
        pendingResponse: undefined,
      },
      actor,
      cardInstanceId,
      definition,
    ),
    {
      eventKey: "card_play_so2",
      params: { actorId: actor.id, targetId: target.id },
    },
  );

  return advanceTurnFromReducer(resolved, shuffle);
}

function playOxygenRecoveryCard(
  state: GameState,
  actor: Player,
  definition: CardDefinition,
  cardInstanceId: CardInstanceId,
  shuffle: ShuffleFunction,
): GameState {
  const withCardDiscarded = moveCardFromHandToDiscard(state, cardInstanceId);
  if (!withCardDiscarded) {
    return state;
  }

  const updatedActor = getPlayer(withCardDiscarded, actor.id);
  if (!updatedActor) {
    return state;
  }

  const healedHp = Math.min(actor.maxHp, actor.hp + 2);
  const withHealing = replacePlayer(withCardDiscarded, actor.id, {
    ...updatedActor,
    hp: healedHp,
  });
  const resolved = appendEvent(
    setTableReference(
      {
        ...withHealing,
        phase: "mainAction",
        pendingResponse: undefined,
      },
      actor,
      cardInstanceId,
      definition,
    ),
    {
      eventKey: "card_play_o2",
      params: { actorId: actor.id, amount: healedHp - actor.hp },
    },
  );

  return advanceTurnFromReducer(resolved, shuffle);
}

function isOwnedHandCard(state: GameState, playerId: PlayerId, cardInstanceId: CardInstanceId): boolean {
  const player = getPlayer(state, playerId);
  const instance = state.cardInstances[cardInstanceId];
  return Boolean(
    player &&
    !player.eliminated &&
    player.hand.includes(cardInstanceId) &&
    instance &&
    instance.ownerId === playerId &&
    instance.zone.type === "hand" &&
    instance.zone.playerId === playerId,
  );
}

export function validatePassAction(state: GameState, playerId: PlayerId): boolean {
  const actor = getPlayer(state, playerId);
  return Boolean(
    state.phase === "mainAction" &&
    playerId === state.activePlayerId &&
    actor &&
    !actor.eliminated,
  );
}

export function validatePlayReferenceCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): boolean {
  if (state.phase !== "mainAction" || playerId !== state.activePlayerId) {
    return false;
  }
  const definition = getDefinitionForCard(state, cardInstanceId);
  return Boolean(
    isOwnedHandCard(state, playerId, cardInstanceId) &&
    definition &&
    definition.type !== "event" &&
    canPlayCardAgainstTableReference(state, playerId, cardInstanceId),
  );
}

export function playReferenceCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  shuffle: ShuffleFunction,
): GameState {
  if (!validatePlayReferenceCard(state, playerId, cardInstanceId)) {
    return state;
  }

  const actor = getPlayer(state, playerId)!;
  const definition = getDefinitionForCard(state, cardInstanceId)!;
  const withCardDiscarded = moveCardFromHandToDiscard(state, cardInstanceId);

  if (!withCardDiscarded) {
    return state;
  }

  const resolved = appendEvent(
    setTableReference(
      {
        ...withCardDiscarded,
        phase: "mainAction",
        pendingResponse: undefined,
      },
      actor,
      cardInstanceId,
      definition,
    ),
    {
      eventKey: "card_play_reference",
      params: { actorId: actor.id, cardDefinitionId: definition.id },
    },
  );

  return advanceTurnFromReducer(resolved, shuffle);
}

export function validatePlayMainActionCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  targetPlayerId: PlayerId | undefined,
): boolean {
  if (state.phase !== "mainAction" || playerId !== state.activePlayerId) {
    return false;
  }
  const actor = getPlayer(state, playerId);
  const definition = getDefinitionForCard(state, cardInstanceId);
  if (
    !actor ||
    !isOwnedHandCard(state, playerId, cardInstanceId) ||
    !definition ||
    !definition.allowedTimings.includes("main-action") ||
    !canPlayCardAgainstTableReference(state, playerId, cardInstanceId)
  ) {
    return false;
  }

  if (definition.id === "substance_o2") {
    return canRecoverHp(actor) && targetPlayerId === actor.id;
  }

  const target = targetPlayerId ? getPlayer(state, targetPlayerId) : undefined;
  if (!target || target.id === actor.id || target.eliminated) {
    return false;
  }

  if (definition.id === "substance_so2") {
    return true;
  }

  const damageKind = getAcidBaseDamageKind(definition);
  return definition.type === "substance" && definition.baseDamage === 1 && damageKind !== undefined;
}

export function playMainActionCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  targetPlayerId: PlayerId | undefined,
  shuffle: ShuffleFunction,
): GameState {
  if (!validatePlayMainActionCard(state, playerId, cardInstanceId, targetPlayerId)) {
    return state;
  }

  const actor = getPlayer(state, playerId)!;
  const target = targetPlayerId ? getPlayer(state, targetPlayerId) : undefined;
  const definition = getDefinitionForCard(state, cardInstanceId)!;
  const damageKind = getAcidBaseDamageKind(definition);

  if (definition.id === "substance_o2") {
    return playOxygenRecoveryCard(state, actor, definition, cardInstanceId, shuffle);
  }

  if (!target) {
    return state;
  }

  if (definition.id === "substance_so2") {
    return playSulfurDioxideCard(state, actor, target, definition, cardInstanceId, shuffle);
  }

  if (!damageKind) {
    return state;
  }

  const sourceEffect: DamageEffect = {
    type: "DAMAGE",
    context: createCardDamageContext({
      sourcePlayerId: actor.id,
      cardInstanceId,
      definition,
      targetPlayerId: target.id,
      baseAmount: definition.baseDamage ?? 1,
    }),
  };

  return appendEvent(
    setTableReference(
      {
        ...state,
        phase: "responseWindow",
        pendingResponse: {
          responderId: target.id,
          sourceEffect,
          chainDepth: 1,
          effectsAfterPass: [sourceEffect],
        },
      },
      actor,
      cardInstanceId,
      definition,
    ),
    {
      eventKey: "card_play_attack",
      params: {
        actorId: actor.id,
        cardDefinitionId: definition.id,
        targetId: target.id,
        damageKind,
        baseAmount: definition.baseDamage ?? 1,
      },
    },
  );
}

export function validateHandleStatusWithCard(
  state: GameState,
  playerId: PlayerId,
  statusInstanceId: string,
  cardInstanceId: CardInstanceId,
): boolean {
  const pending = state.pendingStatusHandling;
  const player = getPlayer(state, playerId);
  const status = player?.statuses.find((candidate) => candidate.id === statusInstanceId);
  const definition = getDefinitionForCard(state, cardInstanceId);
  const canHandleSo2 =
    status?.statusId === "SO2_LEAK" &&
    definition?.allowedTimings.includes("status-window") &&
    definition.tags.includes("alkaline-absorb");
  const canHandleFire =
    status?.statusId === "FIRE" &&
    (definition?.id === "substance_h2o" || definition?.id === "substance_co2") &&
    definition.allowedTimings.includes("status-window") &&
    definition.tags.includes("fire-extinguish");

  return Boolean(
    state.phase === "statusWindow" &&
    state.activePlayerId === playerId &&
    pending &&
    pending.playerId === playerId &&
    pending.statusInstanceId === statusInstanceId &&
    status &&
    isOwnedHandCard(state, playerId, cardInstanceId) &&
    definition &&
    (canHandleSo2 || canHandleFire),
  );
}

export function handleStatusWithCard(
  state: GameState,
  playerId: PlayerId,
  statusInstanceId: string,
  cardInstanceId: CardInstanceId,
  shuffle: ShuffleFunction,
): GameState {
  if (!validateHandleStatusWithCard(state, playerId, statusInstanceId, cardInstanceId)) {
    return state;
  }

  const player = getPlayer(state, playerId)!;
  const status = player.statuses.find((candidate) => candidate.id === statusInstanceId)!;
  const definition = getDefinitionForCard(state, cardInstanceId)!;

  const withCardDiscarded = moveCardFromHandToDiscard(state, cardInstanceId);

  if (!withCardDiscarded) {
    return state;
  }

  const withStatusRemoved = removeStatusFromPlayer(withCardDiscarded, player.id, status.id);
  const statusRemovedState: GameState = {
    ...withStatusRemoved,
    pendingStatusHandling: undefined,
  };
  const resolved = status.statusId === "FIRE"
    ? appendEvent(
        statusRemovedState,
        {
          eventKey: "status_handled_fire",
          params: { playerId: player.id, cardDefinitionId: definition.id },
        },
      )
    : recordSuccessfulReaction({
        stateBeforeReaction: state,
        resolvedState: statusRemovedState,
        event: createSo2StatusHandlingReactionEvent({
          targetPlayerId: player.id,
          statusInstanceId: status.id,
          handlerCardInstanceId: cardInstanceId,
          handlerCardDefinitionId: definition.id,
        }),
        shuffle,
      });

  if (resolved === state) {
    return state;
  }

  return enterNextStatusWindowOrMainAction(resolved, player.id, status.createdAt);
}

export function validatePassStatusHandling(
  state: GameState,
  playerId: PlayerId,
  statusInstanceId: string,
): boolean {
  const pending = state.pendingStatusHandling;
  const player = getPlayer(state, playerId);
  const status = player?.statuses.find((candidate) => candidate.id === statusInstanceId);

  return Boolean(
    state.phase === "statusWindow" &&
    state.activePlayerId === playerId &&
    pending &&
    pending.playerId === playerId &&
    pending.statusInstanceId === statusInstanceId &&
    player &&
    !player.eliminated &&
    status &&
    (status.statusId === "SO2_LEAK" || status.statusId === "FIRE"),
  );
}

export function passStatusHandling(
  state: GameState,
  playerId: PlayerId,
  statusInstanceId: string,
  shuffle: ShuffleFunction,
): GameState {
  if (!validatePassStatusHandling(state, playerId, statusInstanceId)) {
    return state;
  }

  const player = getPlayer(state, playerId)!;
  const status = player.statuses.find((candidate) => candidate.id === statusInstanceId)!;

  const appliedDamage = applyDamage(state, {
    type: "DAMAGE",
    context: createStatusDamageContext({
      statusInstanceId: status.id,
      statusId: status.statusId,
      targetPlayerId: player.id,
      baseAmount: 2,
    }),
  });
  const withDamage = appliedDamage.state;
  const damagedPlayer = getPlayer(withDamage, player.id);
  const withLog = appendEvent(
    {
      ...withDamage,
      pendingStatusHandling: undefined,
    },
    {
      eventKey: "status_passed_damage",
      params: {
        playerId: player.id,
        statusId: status.statusId,
        amount: appliedDamage.resolution.finalAmount,
      },
    },
  );

  const gameOverChecked = finishGameIfResolved(withLog);
  if (gameOverChecked.phase === "gameOver") {
    return gameOverChecked;
  }

  if (damagedPlayer?.eliminated) {
    return advanceTurnFromReducer(
      {
        ...gameOverChecked,
        phase: "mainAction",
        pendingStatusHandling: undefined,
      },
      shuffle,
    );
  }

  return enterNextStatusWindowOrMainAction(gameOverChecked, player.id, status.createdAt);
}

export function validateRespondWithCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): boolean {
  if (state.phase !== "responseWindow") {
    return false;
  }
  if (!isOwnedHandCard(state, playerId, cardInstanceId)) {
    return false;
  }
  const definition = getDefinitionForCard(state, cardInstanceId);
  if (!definition) {
    return false;
  }

  if (isMultiTargetPendingResponse(state)) {
    const pendingResponse = getValidMultiTargetPendingResponse(state, playerId);
    return Boolean(pendingResponse && isAlkalineAbsorptionDefinition(definition));
  }

  const pendingResponse = getValidSinglePendingResponse(state, playerId);
  const damageContext = pendingResponse?.sourceEffect.context;
  const damageKind = damageContext ? getAcidBaseDamageTag(damageContext) : undefined;
  const isCarbonateResponse =
    damageKind === "acid" && canGenerateCarbonDioxideAgainstAcid(damageKind, definition);

  return Boolean(
    pendingResponse &&
    damageKind &&
    (canNeutralize(damageKind, definition) || isCarbonateResponse),
  );
}

export function respondWithCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  shuffle: ShuffleFunction,
): GameState {
  if (!validateRespondWithCard(state, playerId, cardInstanceId)) {
    return state;
  }

  if (isMultiTargetPendingResponse(state)) {
    return respondToMultiTargetDamage(state, playerId, cardInstanceId, shuffle);
  }

  const pendingResponse = state.pendingResponse!;
  const responder = getPlayer(state, playerId)!;
  const sourceEffect = pendingResponse.sourceEffect!;
  const damageContext = sourceEffect.context;
  const damageKind = getAcidBaseDamageTag(damageContext);
  const responseDefinition = getDefinitionForCard(state, cardInstanceId)!;
  const isCarbonateResponse =
    damageKind === "acid" &&
    canGenerateCarbonDioxideAgainstAcid(damageKind, responseDefinition);

  const reactionEvent = createAcidBaseResponseReactionEvent({
    context: sourceEffect.context,
    responsePlayerId: responder.id,
    responseCardInstanceId: cardInstanceId,
    responseCardDefinitionId: responseDefinition.id,
    responseKind: isCarbonateResponse ? "carbonate" : "neutralization",
  });

  if (!reactionEvent) {
    return state;
  }

  const withAttackDiscarded = discardAttackSourceCardIfNeeded(state, sourceEffect.context.source);
  if (!withAttackDiscarded) {
    return state;
  }

  const withResponseDiscarded = moveCardFromHandToDiscard(withAttackDiscarded, cardInstanceId);
  if (!withResponseDiscarded) {
    return state;
  }

  const resolved = recordSuccessfulReaction({
    stateBeforeReaction: state,
    resolvedState: {
      ...withResponseDiscarded,
      phase: "mainAction",
      pendingResponse: undefined,
    },
    event: reactionEvent,
    shuffle,
  });

  if (resolved === state) {
    return state;
  }

  return openExperimentCounterattackOrResume({
    state: resolved,
    responderPlayerId: responder.id,
    originalDamageContext: sourceEffect.context,
    responseType: "acid-base",
    continuation: { kind: "single-response" },
    shuffle,
  });
}

export function getValidSinglePendingResponse(
  state: GameState,
  playerId: PlayerId,
): NonNullable<GameState["pendingResponse"]> | undefined {
  if (state.phase !== "responseWindow" || isMultiTargetPendingResponse(state)) {
    return undefined;
  }

  const pending = state.pendingResponse;
  const damageContext = pending?.sourceEffect?.context;
  const responder = getPlayer(state, playerId);
  const target = damageContext ? getPlayer(state, damageContext.targetPlayerId) : undefined;
  if (
    !pending ||
    !pending.sourceEffect ||
    pending.responderId !== playerId ||
    damageContext?.responsePolicy !== "acid-base" ||
    damageContext.targetPlayerId !== pending.responderId ||
    !responder ||
    responder.eliminated ||
    !target ||
    target.eliminated
  ) {
    return undefined;
  }

  return pending;
}

export function validatePassResponse(state: GameState, playerId: PlayerId): boolean {
  if (isMultiTargetPendingResponse(state)) {
    const pendingResponse = getValidMultiTargetPendingResponse(state, playerId);
    const responder = getPlayer(state, playerId);
    return Boolean(pendingResponse && responder && !responder.eliminated);
  }

  return getValidSinglePendingResponse(state, playerId) !== undefined;
}

export function passResponse(
  state: GameState,
  playerId: PlayerId,
  shuffle: ShuffleFunction,
): GameState {
  if (!validatePassResponse(state, playerId)) {
    return state;
  }

  if (isMultiTargetPendingResponse(state)) {
    return passMultiTargetDamageResponse(state, playerId, shuffle);
  }

  const pendingResponse = state.pendingResponse!;
  const sourceEffect = pendingResponse.sourceEffect!;
  const damageContext = sourceEffect.context;
  const damageKind = getAcidBaseDamageTag(damageContext);
  const target = getPlayer(state, damageContext.targetPlayerId)!;

  const appliedDamage = applyDamage(state, sourceEffect);
  const withDamage = appliedDamage.state;
  const withAttackDiscarded = discardAttackSourceCardIfNeeded(
    withDamage,
    sourceEffect.context.source,
  );

  if (!withAttackDiscarded) {
    return state;
  }

  const resolved = appendEvent(
    {
      ...withAttackDiscarded,
      phase: "mainAction",
      pendingResponse: undefined,
    },
    {
      eventKey: "response_pass_damage",
      params: {
        targetId: target.id,
        damageKind: damageKind!,
        amount: appliedDamage.resolution.finalAmount,
      },
    },
  );

  const gameOverChecked = finishGameIfResolved(resolved);
  if (gameOverChecked.phase === "gameOver") {
    return gameOverChecked;
  }

  return advanceTurnFromReducer(gameOverChecked, shuffle);
}
