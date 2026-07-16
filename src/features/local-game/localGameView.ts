import { cardDefinitions } from "../../game/data/cardDefinitions";
import { diyRecipes, type DIYRecipe } from "../../game/data/diyRecipes";
import { canPlayCardAgainstTableReference } from "../../game/engine/cardAssociation";
import { getAcidBaseDamageTag } from "../../game/engine/damageContext";
import { isAlkalineAbsorptionDefinition } from "../../game/engine/multiTargetResponse";
import { canRecoverHp } from "../../game/engine/recovery";
import {
  isLegalExperimentCounterattackMetalDefinition,
  isLegalExperimentCounterattackPursuitDefinition,
} from "../../game/engine/experimentCounterattack";
import type {
  CardDefinition,
  CardInstanceId,
  DamageEffect,
  GameState,
  Player,
  PlayerId,
  PlayerStatus,
} from "../../game/engine/types";

export const cardDefinitionById = new Map<string, CardDefinition>(
  cardDefinitions.map((definition) => [definition.id, definition]),
);

export function getCardDefinition(state: GameState, cardInstanceId: CardInstanceId) {
  const instance = state.cardInstances[cardInstanceId];
  return instance ? cardDefinitionById.get(instance.definitionId) : undefined;
}

export function getPlayer(state: GameState, playerId: PlayerId) {
  return state.players.find((player) => player.id === playerId);
}

export function getPlayerName(state: GameState, playerId: PlayerId) {
  return getPlayer(state, playerId)?.name ?? playerId;
}

export function getActivePlayer(state: GameState) {
  return getPlayer(state, state.activePlayerId);
}

export function formatList(items: readonly string[]) {
  return items.length > 0 ? items.join(", ") : "无";
}

export function describeDamageSource(effect: DamageEffect) {
  const source = effect.context.source;

  switch (source.kind) {
    case "card":
      return cardDefinitionById.get(source.cardDefinitionId)?.name ?? "未知卡牌";
    case "diy":
      return diyRecipes.find((recipe) => recipe.id === source.recipeId)?.displayName ?? "未知主动 DIY";
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

export function describePendingResponse(state: GameState) {
  const pendingResponse = state.pendingResponse;

  if (!pendingResponse) {
    return "无";
  }

  const effect = pendingResponse.sourceEffect;
  return `${getPlayerName(state, pendingResponse.responderId)} 响应 ${describeDamageSource(
    effect,
  )}：${effect.context.baseAmount} 点 ${effect.context.tags.join("+")} 伤害，chainDepth ${pendingResponse.chainDepth}`;
}

export function describePendingExperimentCounterattack(state: GameState) {
  const pending = state.pendingExperimentCounterattack;
  if (!pending) {
    return "无";
  }

  const effect: DamageEffect = {
    type: "DAMAGE",
    context: pending.originalDamageContext,
  };
  return `${getPlayerName(state, pending.responderPlayerId)} 已抵消 ${getPlayerName(
    state,
    pending.attackerPlayerId,
  )} 的 ${describeDamageSource(effect)}；原响应类型：${pending.responseType}`;
}

export function describePendingStatusHandling(state: GameState) {
  const pendingStatusHandling = state.pendingStatusHandling;

  if (!pendingStatusHandling) {
    return "无";
  }

  const player = getPlayer(state, pendingStatusHandling.playerId);
  const status = player?.statuses.find(
    (candidate) => candidate.id === pendingStatusHandling.statusInstanceId,
  );

  if (!player || !status) {
    return `${pendingStatusHandling.playerId} 处理 ${pendingStatusHandling.statusInstanceId}`;
  }

  return `${player.name} 处理 ${status.statusId} (${status.id})`;
}

export function describeTableReference(state: GameState) {
  const tableReference = state.tableReference;

  if (!tableReference) {
    return "暂无场面基准牌";
  }

  return `${tableReference.displayName} · ${getPlayerName(state, tableReference.playedBy)} · 第 ${tableReference.cycle} 周期 / 第 ${tableReference.round} 轮`;
}

export function isMainActionCard(definition: CardDefinition) {
  return definition.allowedTimings.includes("main-action");
}

export function canExecuteMainActionEffect(
  state: GameState,
  player: Player,
  cardInstanceId: CardInstanceId,
) {
  const definition = getCardDefinition(state, cardInstanceId);
  const hasOpponentTarget = getOpponentTargets(state, player.id).length > 0;

  if (
    !definition ||
    !definition.allowedTimings.includes("main-action") ||
    !canPlayCardAgainstTableReference(state, player.id, cardInstanceId)
  ) {
    return false;
  }

  if (definition.id === "substance_o2") {
    return canRecoverHp(player);
  }

  if (definition.id === "substance_so2") {
    return hasOpponentTarget;
  }

  return definition.type === "substance" && definition.baseDamage === 1 && hasOpponentTarget;
}

export function canPlayAgainstCurrentTableReference(
  state: GameState,
  player: Player,
  cardInstanceId: CardInstanceId,
) {
  return canPlayCardAgainstTableReference(state, player.id, cardInstanceId);
}

export function describeTableReferenceAssociation(
  state: GameState,
  player: Player,
  cardInstanceId: CardInstanceId,
) {
  if (!state.tableReference) {
    return "可建立首张基准牌";
  }

  return canPlayAgainstCurrentTableReference(state, player, cardInstanceId)
    ? "可关联出牌"
    : "与当前基准牌不关联";
}

export function getMainActionCards(state: GameState, player: Player) {
  return player.hand.filter((cardInstanceId) => {
    return canExecuteMainActionEffect(state, player, cardInstanceId);
  });
}

function canNeutralize(incomingDamageKind: "acid" | "base", responseDefinition: CardDefinition) {
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

function canCarbonateRespond(incomingDamageKind: "acid" | "base", responseDefinition: CardDefinition) {
  return (
    incomingDamageKind === "acid" &&
    (responseDefinition.id === "ion_co3" || responseDefinition.id === "substance_na2co3") &&
    responseDefinition.allowedTimings.includes("response")
  );
}

export function getResponseCards(state: GameState, player: Player) {
  const pendingResponse = state.pendingResponse;
  const context = pendingResponse?.sourceEffect.context;

  if (
    state.phase !== "responseWindow" ||
    !pendingResponse ||
    pendingResponse.responderId !== player.id
  ) {
    return [];
  }

  if (context?.responsePolicy === "alkali-absorption") {
    return player.hand.filter((cardInstanceId) => {
      const instance = state.cardInstances[cardInstanceId];
      const definition = getCardDefinition(state, cardInstanceId);
      return Boolean(
        instance &&
          instance.ownerId === player.id &&
          instance.zone.type === "hand" &&
          instance.zone.playerId === player.id &&
          definition &&
          isAlkalineAbsorptionDefinition(definition),
      );
    });
  }

  const damageKind = context ? getAcidBaseDamageTag(context) : undefined;

  if (context?.responsePolicy !== "acid-base" || !damageKind) {
    return [];
  }

  return player.hand.filter((cardInstanceId) => {
    const definition = getCardDefinition(state, cardInstanceId);
    return Boolean(
      definition && (canNeutralize(damageKind, definition) || canCarbonateRespond(damageKind, definition)),
    );
  });
}

export function getAlkaliRecoveryCards(state: GameState, player: Player) {
  if (!canRecoverHp(player)) {
    return [];
  }

  return player.hand.filter((cardInstanceId) => {
    const instance = state.cardInstances[cardInstanceId];
    const definition = getCardDefinition(state, cardInstanceId);
    return Boolean(
      instance &&
        instance.ownerId === player.id &&
        instance.zone.type === "hand" &&
        instance.zone.playerId === player.id &&
        definition?.type === "substance" &&
        definition.tags.includes("strong-alkali"),
    );
  });
}

function getCurrentPendingOptionCards(
  state: GameState,
  player: Player,
  snapshotIds: readonly CardInstanceId[],
  predicate: (definition: CardDefinition) => boolean,
) {
  return snapshotIds.filter((cardInstanceId) => {
    const instance = state.cardInstances[cardInstanceId];
    const definition = getCardDefinition(state, cardInstanceId);
    return Boolean(
      player.hand.includes(cardInstanceId) &&
        instance &&
        instance.ownerId === player.id &&
        instance.zone.type === "hand" &&
        instance.zone.playerId === player.id &&
        definition &&
        predicate(definition),
    );
  });
}

export function getExperimentCounterattackPursuitCards(
  state: GameState,
  player: Player,
) {
  const pending = state.pendingExperimentCounterattack;
  if (
    state.phase !== "experimentCounterattackWindow" ||
    !pending ||
    pending.responderPlayerId !== player.id
  ) {
    return [];
  }

  return getCurrentPendingOptionCards(
    state,
    player,
    pending.legalPursuitCardInstanceIds,
    isLegalExperimentCounterattackPursuitDefinition,
  );
}

export function getExperimentCounterattackMetalCards(
  state: GameState,
  player: Player,
) {
  const pending = state.pendingExperimentCounterattack;
  if (
    state.phase !== "experimentCounterattackWindow" ||
    !pending ||
    pending.responderPlayerId !== player.id
  ) {
    return [];
  }

  return getCurrentPendingOptionCards(
    state,
    player,
    pending.legalMetalCardInstanceIds,
    isLegalExperimentCounterattackMetalDefinition,
  );
}

export function getStatusHandlingCards(
  state: GameState,
  player: Player,
  status: PlayerStatus | undefined,
) {
  if (!status || state.phase !== "statusWindow") {
    return [];
  }

  return player.hand.filter((cardInstanceId) => {
    const definition = getCardDefinition(state, cardInstanceId);

    if (!definition || !definition.allowedTimings.includes("status-window")) {
      return false;
    }

    if (status.statusId === "SO2_LEAK") {
      return definition.tags.includes("alkaline-absorb");
    }

    return (
      status.statusId === "FIRE" &&
      (definition.id === "substance_h2o" || definition.id === "substance_co2") &&
      definition.tags.includes("fire-extinguish")
    );
  });
}

export function getPlayerStatusById(player: Player | undefined, statusInstanceId: string | undefined) {
  if (!player || !statusInstanceId) {
    return undefined;
  }

  return player.statuses.find((status) => status.id === statusInstanceId);
}

export function getPlayableDiyRecipes() {
  return diyRecipes;
}

export function getRecipeById(recipeId: string | undefined) {
  return diyRecipes.find((recipe) => recipe.id === recipeId);
}

export function getRequiredComponentSlots(recipe: DIYRecipe) {
  return recipe.requiredComponents.flatMap((requirement) =>
    Array.from({ length: requirement.count }, (_, index) => ({
      definitionId: requirement.definitionId,
      slotId: `${requirement.definitionId}_${index}`,
      label:
        requirement.count > 1
          ? `${cardDefinitionById.get(requirement.definitionId)?.name ?? requirement.definitionId} #${
              index + 1
            }`
          : cardDefinitionById.get(requirement.definitionId)?.name ?? requirement.definitionId,
    })),
  );
}

export function getAvailableComponentCards(
  state: GameState,
  player: Player,
  definitionId: string,
  selectedCardIds: readonly CardInstanceId[],
) {
  return player.hand.filter((cardInstanceId) => {
    if (selectedCardIds.includes(cardInstanceId)) {
      return false;
    }

    const definition = getCardDefinition(state, cardInstanceId);
    return definition?.id === definitionId && definition.allowedTimings.includes("diy-component");
  });
}

export function getOpponentTargets(state: GameState, playerId: PlayerId) {
  return state.players.filter((player) => player.id !== playerId && !player.eliminated);
}

export function getTotalCardCount(state: GameState) {
  return Object.keys(state.cardInstances).length;
}
