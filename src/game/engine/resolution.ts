import { cardDefinitions } from "../data/cardDefinitions";
import type {
  CardDefinition,
  CardInstanceId,
  Effect,
  GameState,
  Player,
  PlayerId,
} from "./types";
import { advanceTurnFromReducer, finishGameIfResolved, type ShuffleFunction } from "./turnFlow";

export function resolveEffects(effects: Effect[]): Effect[] {
  return effects;
}

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

function applyDamage(state: GameState, effect: Extract<Effect, { type: "DAMAGE" }>): GameState {
  const target = getPlayer(state, effect.targetPlayerId);

  if (!target || target.eliminated) {
    return state;
  }

  const nextHp = Math.max(0, target.hp - effect.amount);
  const isEliminated = nextHp === 0;
  const nextState = replacePlayer(state, target.id, {
    ...target,
    hp: nextHp,
    eliminated: isEliminated,
  });

  if (isEliminated && !target.eliminated) {
    return appendLog(nextState, `${target.name} HP 降至 0，被淘汰。`);
  }

  return nextState;
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

export function playMainActionCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  targetPlayerId: PlayerId | undefined,
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
    !target ||
    target.id === actor.id ||
    target.eliminated ||
    !actor.hand.includes(cardInstanceId) ||
    !definition ||
    definition.type !== "substance" ||
    !definition.allowedTimings.includes("main-action") ||
    definition.baseDamage !== 1 ||
    !damageKind
  ) {
    return state;
  }

  const sourceEffect: Effect = {
    type: "DAMAGE",
    sourceId: cardInstanceId,
    targetPlayerId: target.id,
    amount: 1,
    damageKind,
    canRespond: true,
  };

  return appendLog(
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
    `${actor.name} 打出 ${definition.name}，对 ${target.name} 造成 1 点${damageKind === "acid" ? "酸性" : "碱性"}伤害，等待响应。`,
  );
}

export function respondWithCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  shuffle: ShuffleFunction,
): GameState {
  const pendingResponse = state.pendingResponse;
  const responder = getPlayer(state, playerId);
  const sourceEffect = pendingResponse?.sourceEffect;
  const responseDefinition = getDefinitionForCard(state, cardInstanceId);
  const attackDefinition =
    sourceEffect?.type === "DAMAGE" ? getDefinitionForCard(state, sourceEffect.sourceId) : undefined;

  if (
    state.phase !== "responseWindow" ||
    !pendingResponse ||
    pendingResponse.responderId !== playerId ||
    sourceEffect?.type !== "DAMAGE" ||
    (sourceEffect.damageKind !== "acid" && sourceEffect.damageKind !== "base") ||
    !responder ||
    responder.eliminated ||
    !responder.hand.includes(cardInstanceId) ||
    !responseDefinition ||
    !attackDefinition ||
    !canNeutralize(sourceEffect.damageKind, responseDefinition)
  ) {
    return state;
  }

  const withAttackDiscarded = moveCardFromHandToDiscard(state, sourceEffect.sourceId);
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
    `${responder.name} 打出 ${responseDefinition.name}，中和 ${attackDefinition.name}，原伤害取消。`,
  );

  return advanceTurnFromReducer(resolved, shuffle);
}

export function passResponse(
  state: GameState,
  playerId: PlayerId,
  shuffle: ShuffleFunction,
): GameState {
  const pendingResponse = state.pendingResponse;
  const sourceEffect = pendingResponse?.sourceEffect;
  const responder = getPlayer(state, playerId);
  const target = sourceEffect?.type === "DAMAGE" ? getPlayer(state, sourceEffect.targetPlayerId) : undefined;
  const attackDefinition =
    sourceEffect?.type === "DAMAGE" ? getDefinitionForCard(state, sourceEffect.sourceId) : undefined;

  if (
    state.phase !== "responseWindow" ||
    !pendingResponse ||
    pendingResponse.responderId !== playerId ||
    sourceEffect?.type !== "DAMAGE" ||
    !responder ||
    responder.eliminated ||
    !target ||
    target.eliminated ||
    !attackDefinition
  ) {
    return state;
  }

  const withDamage = applyDamage(state, sourceEffect);
  const withAttackDiscarded = moveCardFromHandToDiscard(withDamage, sourceEffect.sourceId);

  if (!withAttackDiscarded) {
    return state;
  }

  const resolved = appendLog(
    {
      ...withAttackDiscarded,
      phase: "mainAction",
      pendingResponse: undefined,
    },
    `${target.name} 放弃响应，受到 ${sourceEffect.amount} 点${sourceEffect.damageKind === "acid" ? "酸性" : "碱性"}伤害。`,
  );

  const gameOverChecked = finishGameIfResolved(resolved);
  if (gameOverChecked.phase === "gameOver") {
    return gameOverChecked;
  }

  return advanceTurnFromReducer(gameOverChecked, shuffle);
}
