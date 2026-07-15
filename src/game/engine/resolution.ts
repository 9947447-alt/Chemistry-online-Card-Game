import { cardDefinitions } from "../data/cardDefinitions";
import { diyRecipes } from "../data/diyRecipes";
import { canPlayCardAgainstTableReference } from "./cardAssociation";
import {
  createCardDamageContext,
  createStatusDamageContext,
  getAcidBaseDamageTag,
} from "./damageContext";
import { applyDamage } from "./damage";
import {
  isMultiTargetPendingResponse,
  passMultiTargetDamageResponse,
  respondToMultiTargetDamage,
} from "./multiTargetResponse";
import { canRecoverHp } from "./recovery";
import type {
  CardDefinition,
  CardInstanceId,
  DamageEffect,
  DamageSource,
  Effect,
  GameState,
  Player,
  PlayerId,
  PlayerStatus,
} from "./types";
import { advanceTurnFromReducer, finishGameIfResolved, type ShuffleFunction } from "./turnFlow";

export function resolveEffects(effects: Effect[]): Effect[] {
  return effects;
}

const definitionsById = new Map<string, CardDefinition>(
  cardDefinitions.map((definition) => [definition.id, definition]),
);
const diyRecipesById = new Map(diyRecipes.map((recipe) => [recipe.id, recipe]));

function appendLog(state: GameState, message: string): GameState {
  const nextIndex = state.log.length + 1;
  return {
    ...state,
    log: [...state.log, { id: `log_${String(nextIndex).padStart(3, "0")}`, message }],
  };
}

function getPlayer(state: GameState, playerId: PlayerId): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}

function getDefinitionForCard(
  state: GameState,
  cardInstanceId: CardInstanceId,
): CardDefinition | undefined {
  const instance = state.cardInstances[cardInstanceId];
  return instance ? definitionsById.get(instance.definitionId) : undefined;
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

function getCardHolder(state: GameState, cardInstanceId: CardInstanceId): Player | undefined {
  return state.players.find((player) => player.hand.includes(cardInstanceId));
}

function replacePlayer(state: GameState, playerId: PlayerId, nextPlayer: Player): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? nextPlayer : player)),
  };
}

function moveCardFromHandToDiscard(
  state: GameState,
  cardInstanceId: CardInstanceId,
): GameState | undefined {
  const holder = getCardHolder(state, cardInstanceId);
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

function getAcidBaseDamageKind(definition: CardDefinition): "acid" | "base" | undefined {
  if (definition.tags.includes("acid")) {
    return "acid";
  }

  if (definition.tags.includes("base")) {
    return "base";
  }

  return undefined;
}

function canNeutralize(
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

function canGenerateCarbonDioxideAgainstAcid(
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

function getDamageSourceName(source: DamageSource): string {
  switch (source.kind) {
    case "card":
      return definitionsById.get(source.cardDefinitionId)?.name ?? "未知卡牌";
    case "diy":
      return diyRecipesById.get(source.recipeId)?.displayName ?? "未知主动 DIY";
    case "status":
      return source.statusId;
    case "character-skill":
      return source.skillId;
    default: {
      const exhaustiveSource: never = source;
      return exhaustiveSource;
    }
  }
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

  return appendLog(
    {
      ...state,
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId,
        statusInstanceId: nextStatus.id,
      },
    },
    `${player.name} 开始处理 ${nextStatus.statusId}。`,
  );
}

function addStatusIfMissing(
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
    return appendLog(state, `${target.name} 的 ${statusId} 已刷新/重复施加。`);
  }

  const status: PlayerStatus = {
    id: `status_${String(state.log.length + 1).padStart(3, "0")}_${target.id}_${statusId}`,
    statusId,
    sourcePlayerId,
    createdAt: state.log.length + 1,
  };

  return appendLog(
    replacePlayer(state, target.id, {
      ...target,
      statuses: [...target.statuses, status],
    }),
    `${target.name} 获得 ${statusId}。`,
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

  const resolved = appendLog(
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
    `${actor.name} 打出 SO2，使 ${target.name} 获得 SO2_LEAK；不造成即时伤害。`,
  );

  return advanceTurnFromReducer(resolved, shuffle);
}

function playOxygenRecoveryCard(
  state: GameState,
  actor: Player,
  definition: CardDefinition,
  cardInstanceId: CardInstanceId,
  targetPlayerId: PlayerId | undefined,
  shuffle: ShuffleFunction,
): GameState {
  if (
    targetPlayerId !== actor.id ||
    !canRecoverHp(actor)
  ) {
    return state;
  }

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
  const resolved = appendLog(
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
    `${actor.name} 使用 O2，回复 ${healedHp - actor.hp} HP。`,
  );

  return advanceTurnFromReducer(resolved, shuffle);
}

export function playReferenceCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  shuffle: ShuffleFunction,
): GameState {
  const actor = getPlayer(state, playerId);
  const definition = getDefinitionForCard(state, cardInstanceId);

  if (
    state.phase !== "mainAction" ||
    playerId !== state.activePlayerId ||
    !actor ||
    actor.eliminated ||
    !actor.hand.includes(cardInstanceId) ||
    !definition ||
    !canPlayCardAgainstTableReference(state, playerId, cardInstanceId)
  ) {
    return state;
  }

  const withCardDiscarded = moveCardFromHandToDiscard(state, cardInstanceId);

  if (!withCardDiscarded) {
    return state;
  }

  const resolved = appendLog(
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
    `${actor.name} 普通出牌 ${definition.name}，作为场面基准；不触发原有效果。`,
  );

  return advanceTurnFromReducer(resolved, shuffle);
}

export function playMainActionCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  targetPlayerId: PlayerId | undefined,
  shuffle: ShuffleFunction,
): GameState {
  const actor = getPlayer(state, playerId);
  const target = targetPlayerId ? getPlayer(state, targetPlayerId) : undefined;
  const definition = getDefinitionForCard(state, cardInstanceId);
  const damageKind = definition ? getAcidBaseDamageKind(definition) : undefined;

  if (
    state.phase !== "mainAction" ||
    playerId !== state.activePlayerId ||
    !actor ||
    actor.eliminated ||
    !actor.hand.includes(cardInstanceId) ||
    !definition ||
    !definition.allowedTimings.includes("main-action") ||
    !canPlayCardAgainstTableReference(state, playerId, cardInstanceId)
  ) {
    return state;
  }

  if (definition.id === "substance_o2") {
    return playOxygenRecoveryCard(state, actor, definition, cardInstanceId, targetPlayerId, shuffle);
  }

  if (!target || target.id === actor.id || target.eliminated) {
    return state;
  }

  if (definition.id === "substance_so2") {
    return playSulfurDioxideCard(state, actor, target, definition, cardInstanceId, shuffle);
  }

  if (definition.type !== "substance") {
    return state;
  }

  if (definition.baseDamage !== 1 || !damageKind) {
    return state;
  }

  const sourceEffect: DamageEffect = {
    type: "DAMAGE",
    context: createCardDamageContext({
      sourcePlayerId: actor.id,
      cardInstanceId,
      definition,
      targetPlayerId: target.id,
      baseAmount: definition.baseDamage,
    }),
  };

  return appendLog(
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
    `${actor.name} 打出 ${definition.name}，对 ${target.name} 的${damageKind === "acid" ? "酸性" : "碱性"}伤害基础值为 1 点，等待响应。`,
  );
}

export function handleStatusWithCard(
  state: GameState,
  playerId: PlayerId,
  statusInstanceId: string,
  cardInstanceId: CardInstanceId,
): GameState {
  const pendingStatusHandling = state.pendingStatusHandling;
  const player = getPlayer(state, playerId);
  const status = player?.statuses.find((candidate) => candidate.id === statusInstanceId);
  const definition = getDefinitionForCard(state, cardInstanceId);
  const canHandleSo2Leak =
    status?.statusId === "SO2_LEAK" &&
    definition?.allowedTimings.includes("status-window") &&
    definition.tags.includes("alkaline-absorb");
  const canHandleFire =
    status?.statusId === "FIRE" &&
    (definition?.id === "substance_h2o" || definition?.id === "substance_co2") &&
    definition.allowedTimings.includes("status-window") &&
    definition.tags.includes("fire-extinguish");

  if (
    state.phase !== "statusWindow" ||
    !pendingStatusHandling ||
    pendingStatusHandling.playerId !== playerId ||
    pendingStatusHandling.statusInstanceId !== statusInstanceId ||
    state.activePlayerId !== playerId ||
    !player ||
    player.eliminated ||
    !status ||
    !player.hand.includes(cardInstanceId) ||
    !definition ||
    (!canHandleSo2Leak && !canHandleFire)
  ) {
    return state;
  }

  const withCardDiscarded = moveCardFromHandToDiscard(state, cardInstanceId);

  if (!withCardDiscarded) {
    return state;
  }

  const withStatusRemoved = removeStatusFromPlayer(withCardDiscarded, player.id, status.id);
  const resolved = appendLog(
    {
      ...withStatusRemoved,
      pendingStatusHandling: undefined,
    },
    status.statusId === "FIRE"
      ? `${player.name} 使用 ${definition.name} 处理 FIRE。`
      : `${player.name} 使用 ${definition.name} 碱性吸收，处理 SO2 泄漏。`,
  );

  return enterNextStatusWindowOrMainAction(resolved, player.id, status.createdAt);
}

export function passStatusHandling(
  state: GameState,
  playerId: PlayerId,
  statusInstanceId: string,
  shuffle: ShuffleFunction,
): GameState {
  const pendingStatusHandling = state.pendingStatusHandling;
  const player = getPlayer(state, playerId);
  const status = player?.statuses.find((candidate) => candidate.id === statusInstanceId);

  if (
    state.phase !== "statusWindow" ||
    !pendingStatusHandling ||
    pendingStatusHandling.playerId !== playerId ||
    pendingStatusHandling.statusInstanceId !== statusInstanceId ||
    state.activePlayerId !== playerId ||
    !player ||
    player.eliminated ||
    !status ||
    (status.statusId !== "SO2_LEAK" && status.statusId !== "FIRE")
  ) {
    return state;
  }

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
  const withLog = appendLog(
    {
      ...withDamage,
      pendingStatusHandling: undefined,
    },
    `${player.name} 未处理 ${status.statusId}，受到 ${appliedDamage.resolution.finalAmount} 点状态伤害；${status.statusId} 保留。`,
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

export function respondWithCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  shuffle: ShuffleFunction,
): GameState {
  if (isMultiTargetPendingResponse(state)) {
    return respondToMultiTargetDamage(state, playerId, cardInstanceId, shuffle);
  }

  const pendingResponse = state.pendingResponse;
  const responder = getPlayer(state, playerId);
  const sourceEffect = pendingResponse?.sourceEffect;
  const damageContext = sourceEffect?.context;
  const damageKind = damageContext ? getAcidBaseDamageTag(damageContext) : undefined;
  const responseDefinition = getDefinitionForCard(state, cardInstanceId);
  const attackName = sourceEffect ? getDamageSourceName(sourceEffect.context.source) : "";
  const isCarbonateResponse =
    damageKind === "acid" &&
    responseDefinition &&
    canGenerateCarbonDioxideAgainstAcid(damageKind, responseDefinition);

  if (
    state.phase !== "responseWindow" ||
    !pendingResponse ||
    pendingResponse.responderId !== playerId ||
    !sourceEffect ||
    damageContext?.responsePolicy !== "acid-base" ||
    !damageKind ||
    !responder ||
    responder.eliminated ||
    !responder.hand.includes(cardInstanceId) ||
    !responseDefinition ||
    (!canNeutralize(damageKind, responseDefinition) && !isCarbonateResponse)
  ) {
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

  const resolved = appendLog(
    {
      ...withResponseDiscarded,
      phase: "mainAction",
      pendingResponse: undefined,
    },
    isCarbonateResponse
      ? `${responder.name} 打出 ${responseDefinition.name}，响应 ${attackName} 的酸性伤害，生成 CO2，原伤害取消。`
      : `${responder.name} 打出 ${responseDefinition.name}，中和 ${attackName}，原伤害取消。`,
  );

  return advanceTurnFromReducer(resolved, shuffle);
}

export function passResponse(
  state: GameState,
  playerId: PlayerId,
  shuffle: ShuffleFunction,
): GameState {
  if (isMultiTargetPendingResponse(state)) {
    return passMultiTargetDamageResponse(state, playerId, shuffle);
  }

  const pendingResponse = state.pendingResponse;
  const sourceEffect = pendingResponse?.sourceEffect;
  const damageContext = sourceEffect?.context;
  const damageKind = damageContext ? getAcidBaseDamageTag(damageContext) : undefined;
  const responder = getPlayer(state, playerId);
  const target = damageContext ? getPlayer(state, damageContext.targetPlayerId) : undefined;

  if (
    state.phase !== "responseWindow" ||
    !pendingResponse ||
    pendingResponse.responderId !== playerId ||
    !sourceEffect ||
    !responder ||
    responder.eliminated ||
    !target ||
    target.eliminated
  ) {
    return state;
  }

  const appliedDamage = applyDamage(state, sourceEffect);
  const withDamage = appliedDamage.state;
  const withAttackDiscarded = discardAttackSourceCardIfNeeded(
    withDamage,
    sourceEffect.context.source,
  );

  if (!withAttackDiscarded) {
    return state;
  }

  const resolved = appendLog(
    {
      ...withAttackDiscarded,
      phase: "mainAction",
      pendingResponse: undefined,
    },
    `${target.name} 放弃响应，受到 ${appliedDamage.resolution.finalAmount} 点${damageKind === "acid" ? "酸性" : "碱性"}伤害。`,
  );

  const gameOverChecked = finishGameIfResolved(resolved);
  if (gameOverChecked.phase === "gameOver") {
    return gameOverChecked;
  }

  return advanceTurnFromReducer(gameOverChecked, shuffle);
}
