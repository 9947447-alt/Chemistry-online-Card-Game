import { cardDefinitions } from "../data/cardDefinitions";
import { diyRecipes, type DIYRecipe } from "../data/diyRecipes";
import type {
  CardDefinition,
  CardInstanceId,
  DamageEffect,
  GameState,
  Player,
  PlayerId,
  PlayerStatus,
} from "./types";
import { advanceTurnFromReducer, type ShuffleFunction } from "./turnFlow";

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

function replacePlayer(state: GameState, playerId: PlayerId, nextPlayer: Player): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? nextPlayer : player)),
  };
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

function componentCountsMatchRecipe(
  componentDefinitionIds: string[],
  recipe: DIYRecipe,
): boolean {
  const actualCounts = new Map<string, number>();

  for (const definitionId of componentDefinitionIds) {
    actualCounts.set(definitionId, (actualCounts.get(definitionId) ?? 0) + 1);
  }

  if (actualCounts.size !== recipe.requiredComponents.length) {
    return false;
  }

  return recipe.requiredComponents.every(
    (requirement) => actualCounts.get(requirement.definitionId) === requirement.count,
  );
}

function findMatchingRecipe(componentDefinitionIds: string[]): DIYRecipe | undefined {
  return diyRecipes.find((recipe) => componentCountsMatchRecipe(componentDefinitionIds, recipe));
}

function removeOwnFire(state: GameState, playerId: PlayerId): GameState {
  const player = getPlayer(state, playerId);

  if (!player) {
    return state;
  }

  return replacePlayer(state, playerId, {
    ...player,
    statuses: player.statuses.filter((status) => status.statusId !== "FIRE"),
  });
}

function markDIYUsed(state: GameState, playerId: PlayerId): GameState {
  const player = getPlayer(state, playerId);

  if (!player) {
    return state;
  }

  return replacePlayer(state, playerId, {
    ...player,
    usedDIYThisCycle: true,
  });
}

function discardComponents(
  state: GameState,
  componentCardInstanceIds: CardInstanceId[],
): GameState | undefined {
  let nextState = state;

  for (const cardInstanceId of componentCardInstanceIds) {
    const updated = moveCardFromHandToDiscard(nextState, cardInstanceId);

    if (!updated) {
      return undefined;
    }

    nextState = updated;
  }

  return nextState;
}

export function startActiveDIY(
  state: GameState,
  playerId: PlayerId,
  recipeId: string,
  componentCardInstanceIds: CardInstanceId[],
  targetPlayerId: PlayerId | undefined,
  shuffle: ShuffleFunction,
): GameState {
  const player = getPlayer(state, playerId);

  if (
    state.phase !== "mainAction" ||
    state.activePlayerId !== playerId ||
    !player ||
    player.eliminated ||
    player.usedDIYThisCycle ||
    new Set(componentCardInstanceIds).size !== componentCardInstanceIds.length
  ) {
    return state;
  }

  const componentDefinitions: CardDefinition[] = [];

  for (const cardInstanceId of componentCardInstanceIds) {
    if (!player.hand.includes(cardInstanceId)) {
      return state;
    }

    const definition = getDefinitionForCard(state, cardInstanceId);

    if (!definition || !definition.allowedTimings.includes("diy-component")) {
      return state;
    }

    componentDefinitions.push(definition);
  }

  const matchedRecipe = findMatchingRecipe(componentDefinitions.map((definition) => definition.id));

  if (!matchedRecipe || matchedRecipe.id !== recipeId) {
    return state;
  }

  if (matchedRecipe.result === "CO2_REMOVE_OWN_FIRE") {
    if (targetPlayerId || !player.statuses.some((status) => status.statusId === "FIRE")) {
      return state;
    }

    const withComponentsDiscarded = discardComponents(state, componentCardInstanceIds);
    if (!withComponentsDiscarded) {
      return state;
    }

    const withFireRemoved = removeOwnFire(withComponentsDiscarded, player.id);
    const resolved = appendLog(
      markDIYUsed(withFireRemoved, player.id),
      `${player.name} 主动 DIY 生成 CO2 并移除 FIRE；不创建 CO2 卡牌。`,
    );

    return advanceTurnFromReducer(resolved, shuffle);
  }

  if (matchedRecipe.result === "H2O_REMOVE_OWN_FIRE") {
    if (targetPlayerId || !player.statuses.some((status) => status.statusId === "FIRE")) {
      return state;
    }

    const withComponentsDiscarded = discardComponents(state, componentCardInstanceIds);
    if (!withComponentsDiscarded) {
      return state;
    }

    const withFireRemoved = removeOwnFire(withComponentsDiscarded, player.id);
    const resolved = appendLog(
      markDIYUsed(withFireRemoved, player.id),
      `${player.name} 主动 DIY 生成 H2O 并移除 FIRE；不创建 H2O 卡牌。`,
    );

    return advanceTurnFromReducer(resolved, shuffle);
  }

  if (matchedRecipe.result === "VIRTUAL_ATTACK") {
    const target = targetPlayerId ? getPlayer(state, targetPlayerId) : undefined;

    if (
      !matchedRecipe.requiresTarget ||
      !target ||
      target.id === player.id ||
      target.eliminated ||
      !matchedRecipe.damageKind ||
      !matchedRecipe.damageAmount ||
      !matchedRecipe.displayName
    ) {
      return state;
    }

    const withComponentsDiscarded = discardComponents(state, componentCardInstanceIds);
    if (!withComponentsDiscarded) {
      return state;
    }

    const sourceEffect: DamageEffect = {
      type: "DAMAGE",
      source: {
        kind: "virtual-diy",
        recipeId: matchedRecipe.id,
        displayName: matchedRecipe.displayName,
      },
      targetPlayerId: target.id,
      amount: matchedRecipe.damageAmount,
      damageKind: matchedRecipe.damageKind,
      canRespond: true,
    };

    return appendLog(
      {
        ...markDIYUsed(withComponentsDiscarded, player.id),
        phase: "responseWindow",
        pendingResponse: {
          responderId: target.id,
          sourceEffect,
          chainDepth: 1,
          effectsAfterPass: [sourceEffect],
        },
      },
      `${player.name} 主动 DIY 使用 ${matchedRecipe.name}，生成虚拟 ${matchedRecipe.displayName}，对 ${target.name} 造成 ${matchedRecipe.damageAmount} 点${matchedRecipe.damageKind === "acid" ? "酸性" : "碱性"}伤害，等待响应；不创建实体卡牌。`,
    );
  }

  if (matchedRecipe.result === "SO2_APPLY_LEAK") {
    const target = targetPlayerId ? getPlayer(state, targetPlayerId) : undefined;

    if (!matchedRecipe.requiresTarget || !target || target.id === player.id || target.eliminated) {
      return state;
    }

    const withComponentsDiscarded = discardComponents(state, componentCardInstanceIds);
    if (!withComponentsDiscarded) {
      return state;
    }

    const withStatus = addStatusIfMissing(withComponentsDiscarded, target.id, player.id, "SO2_LEAK");
    const resolved = appendLog(
      markDIYUsed(withStatus, player.id),
      `${player.name} 主动 DIY 生成 SO2，使 ${target.name} 获得 SO2_LEAK；不创建 SO2 卡牌。`,
    );

    return advanceTurnFromReducer(resolved, shuffle);
  }

  return state;
}
