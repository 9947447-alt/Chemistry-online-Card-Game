import { cardDefinitions } from "../data/cardDefinitions";
import type { ActivateCharacterSkillAction } from "./actions";
import { applyLoseHpBatch } from "./loseHp";
import { startExhaustLeakResponseSequence } from "./multiTargetResponse";
import { canRecoverHp } from "./recovery";
import type {
  CardDefinition,
  CharacterId,
  CharacterUsageKey,
  GameState,
  Player,
  PlayerId,
  PlayerStatus,
} from "./types";
import {
  advanceTurnFromReducer,
  drawCardsForPlayer,
  getAvailableDrawCardCount,
  type ShuffleFunction,
} from "./turnFlow";

type ActiveSkillId = ActivateCharacterSkillAction["skillId"];

type ActiveSkillSpec = Readonly<{
  characterId: CharacterId;
  usageKey: CharacterUsageKey;
}>;

const activeSkillSpecs: Record<ActiveSkillId, ActiveSkillSpec> = {
  extra_lesson: {
    characterId: "laboratory_teacher",
    usageKey: "laboratory_teacher_extra_lesson",
  },
  emergency_supply: {
    characterId: "chemical_factory_ceo",
    usageKey: "chemical_factory_ceo_emergency_supply",
  },
  exhaust_leak: {
    characterId: "clumsy_party_secretary",
    usageKey: "clumsy_party_secretary_shared_active",
  },
  lab_fire: {
    characterId: "clumsy_party_secretary",
    usageKey: "clumsy_party_secretary_shared_active",
  },
  exothermic_accident: {
    characterId: "clumsy_party_secretary",
    usageKey: "clumsy_party_secretary_shared_active",
  },
  alkali_recovery: {
    characterId: "caustic_soda_captain",
    usageKey: "caustic_soda_captain_alkali_recovery",
  },
  exhaust_discharge: {
    characterId: "sulfuric_acid_factory_director",
    usageKey: "sulfuric_acid_factory_director_exhaust_discharge",
  },
};

const definitionsById = new Map<string, CardDefinition>(
  cardDefinitions.map((definition) => [definition.id, definition]),
);

function appendSkillLog(state: GameState, message: string): GameState {
  const nextIndex = state.log.length + 1;
  return {
    ...state,
    log: [...state.log, { id: `log_${String(nextIndex).padStart(3, "0")}`, message }],
  };
}

function getCommonSkillActor(
  state: GameState,
  action: ActivateCharacterSkillAction,
): Player | undefined {
  const spec = activeSkillSpecs[action.skillId];
  const player = state.players.find((candidate) => candidate.id === action.playerId);

  if (
    state.phase !== "mainAction" ||
    !player ||
    player.eliminated ||
    state.activePlayerId !== player.id ||
    player.characterId !== spec.characterId ||
    player.characterUsage.perCycle[spec.usageKey]
  ) {
    return undefined;
  }

  return player;
}

function markSkillUsed(
  state: GameState,
  playerId: PlayerId,
  usageKey: CharacterUsageKey,
): GameState {
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
                [usageKey]: 1,
              },
            },
          }
        : player,
    ),
  };
}

function replacePlayer(state: GameState, playerId: PlayerId, player: Player): GameState {
  return {
    ...state,
    players: state.players.map((candidate) => (candidate.id === playerId ? player : candidate)),
  };
}

function addStatusIfMissing(
  state: GameState,
  targetPlayerId: PlayerId,
  sourcePlayerId: PlayerId,
  statusId: PlayerStatus["statusId"],
): GameState {
  const target = state.players.find((player) => player.id === targetPlayerId);
  if (!target) {
    return state;
  }

  if (target.statuses.some((status) => status.statusId === statusId)) {
    return appendSkillLog(state, `${target.name} 的 ${statusId} 已刷新/重复施加。`);
  }

  const status: PlayerStatus = {
    id: `status_${String(state.log.length + 1).padStart(3, "0")}_${target.id}_${statusId}`,
    statusId,
    sourcePlayerId,
    createdAt: state.log.length + 1,
  };

  return appendSkillLog(
    replacePlayer(state, target.id, {
      ...target,
      statuses: [...target.statuses, status],
    }),
    `${target.name} 获得 ${statusId}。`,
  );
}

function activateDrawSkill(
  state: GameState,
  player: Player,
  skillId: "extra_lesson" | "emergency_supply",
  shuffle: ShuffleFunction,
): GameState {
  const drawCount = skillId === "extra_lesson" ? 4 : 3;
  const name = skillId === "extra_lesson" ? "补课" : "紧急调货";
  const usageKey = activeSkillSpecs[skillId].usageKey;

  if (player.hand.length > 4 || getAvailableDrawCardCount(state) === 0) {
    return state;
  }

  const handSizeBefore = player.hand.length;
  const drawnState = drawCardsForPlayer(state, player.id, drawCount, shuffle);
  const drawnPlayer = drawnState.players.find((candidate) => candidate.id === player.id);
  const actualDrawCount = (drawnPlayer?.hand.length ?? handSizeBefore) - handSizeBefore;
  if (!drawnPlayer || actualDrawCount <= 0) {
    return state;
  }

  const loggedState = appendSkillLog(
    markSkillUsed(drawnState, player.id, usageKey),
    `${player.name} 发动${name}，实际摸 ${actualDrawCount} 张牌，本行动结束。`,
  );
  return advanceTurnFromReducer(loggedState, shuffle);
}

function activateAlkaliRecovery(
  state: GameState,
  player: Player,
  action: Extract<ActivateCharacterSkillAction, { skillId: "alkali_recovery" }>,
  shuffle: ShuffleFunction,
): GameState {
  const instance = state.cardInstances[action.cardInstanceId];
  const definition = instance ? definitionsById.get(instance.definitionId) : undefined;

  if (
    !canRecoverHp(player) ||
    !player.hand.includes(action.cardInstanceId) ||
    !instance ||
    instance.ownerId !== player.id ||
    instance.zone.type !== "hand" ||
    instance.zone.playerId !== player.id ||
    !definition ||
    definition.type !== "substance" ||
    !definition.tags.includes("strong-alkali")
  ) {
    return state;
  }

  const healedHp = Math.min(player.maxHp, player.hp + 2);
  const withCostDiscarded: GameState = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === player.id
        ? {
            ...candidate,
            hp: healedHp,
            hand: candidate.hand.filter((cardId) => cardId !== action.cardInstanceId),
          }
        : candidate,
    ),
    cardInstances: {
      ...state.cardInstances,
      [action.cardInstanceId]: {
        ...instance,
        ownerId: undefined,
        zone: { type: "discard" },
      },
    },
    discardPile: [...state.discardPile, action.cardInstanceId],
  };
  const loggedState = appendSkillLog(
    markSkillUsed(
      withCostDiscarded,
      player.id,
      activeSkillSpecs.alkali_recovery.usageKey,
    ),
    `${player.name} 发动碱液回收，弃置 ${definition.name}，回复 ${healedHp - player.hp} HP，本行动结束。`,
  );

  return advanceTurnFromReducer(loggedState, shuffle);
}

function activateExhaustDischarge(
  state: GameState,
  player: Player,
  action: Extract<ActivateCharacterSkillAction, { skillId: "exhaust_discharge" }>,
  shuffle: ShuffleFunction,
): GameState {
  const target = state.players.find((candidate) => candidate.id === action.targetPlayerId);
  if (!target || target.id === player.id || target.eliminated) {
    return state;
  }

  const withStatus = addStatusIfMissing(state, target.id, player.id, "SO2_LEAK");
  const loggedState = appendSkillLog(
    markSkillUsed(
      withStatus,
      player.id,
      activeSkillSpecs.exhaust_discharge.usageKey,
    ),
    `${player.name} 发动排放尾气，使 ${target.name} 获得 SO2_LEAK；不造成即时伤害，本行动结束。`,
  );
  return advanceTurnFromReducer(loggedState, shuffle);
}

function getOtherAlivePlayerIds(state: GameState, sourcePlayerId: PlayerId): PlayerId[] {
  return state.players
    .filter((player) => player.id !== sourcePlayerId && !player.eliminated)
    .map((player) => player.id);
}

function activateExhaustLeak(
  state: GameState,
  player: Player,
  targetPlayerIds: readonly PlayerId[],
): GameState {
  const withUsage = markSkillUsed(
    state,
    player.id,
    activeSkillSpecs.exhaust_leak.usageKey,
  );
  const withLog = appendSkillLog(
    withUsage,
    `${player.name} 发动尾气泄漏，按稳定顺序等待 ${targetPlayerIds.length} 名目标分别进行碱性吸收响应。`,
  );
  return startExhaustLeakResponseSequence(withLog, player.id, targetPlayerIds);
}

function activateLabFire(
  state: GameState,
  player: Player,
  targetPlayerIds: readonly PlayerId[],
  shuffle: ShuffleFunction,
): GameState {
  let withStatuses = state;
  for (const targetPlayerId of targetPlayerIds) {
    withStatuses = addStatusIfMissing(withStatuses, targetPlayerId, player.id, "FIRE");
  }

  const loggedState = appendSkillLog(
    markSkillUsed(withStatuses, player.id, activeSkillSpecs.lab_fire.usageKey),
    `${player.name} 发动实验台起火（lab_fire），以虚拟角色技能效果向所有其他存活玩家施加 FIRE；本行动结束。`,
  );
  return advanceTurnFromReducer(loggedState, shuffle);
}

function activateExothermicAccident(
  state: GameState,
  player: Player,
  targetPlayerIds: readonly PlayerId[],
  shuffle: ShuffleFunction,
): GameState {
  const withUsageAndLog = appendSkillLog(
    markSkillUsed(
      state,
      player.id,
      activeSkillSpecs.exothermic_accident.usageKey,
    ),
    `${player.name} 发动强放热事故，所有其他存活玩家失去 1 点体力。`,
  );
  const resolved = applyLoseHpBatch(
    withUsageAndLog,
    targetPlayerIds.map((targetPlayerId) => ({ targetPlayerId, amount: 1 })),
  );

  return resolved.phase === "gameOver"
    ? resolved
    : advanceTurnFromReducer(resolved, shuffle);
}

export function activateCharacterSkill(
  state: GameState,
  action: ActivateCharacterSkillAction,
  shuffle: ShuffleFunction,
): GameState {
  const player = getCommonSkillActor(state, action);
  if (!player) {
    return state;
  }

  switch (action.skillId) {
    case "extra_lesson":
    case "emergency_supply":
      return activateDrawSkill(state, player, action.skillId, shuffle);
    case "alkali_recovery":
      return activateAlkaliRecovery(state, player, action, shuffle);
    case "exhaust_discharge":
      return activateExhaustDischarge(state, player, action, shuffle);
    case "exhaust_leak": {
      const targets = getOtherAlivePlayerIds(state, player.id);
      return targets.length > 0 ? activateExhaustLeak(state, player, targets) : state;
    }
    case "lab_fire": {
      const targets = getOtherAlivePlayerIds(state, player.id);
      return targets.length > 0 ? activateLabFire(state, player, targets, shuffle) : state;
    }
    case "exothermic_accident": {
      const targets = getOtherAlivePlayerIds(state, player.id);
      return targets.length > 0
        ? activateExothermicAccident(state, player, targets, shuffle)
        : state;
    }
    default: {
      const exhaustiveSkill: never = action;
      return exhaustiveSkill;
    }
  }
}
