import { cardDefinitions } from "../data/cardDefinitions";
import type { ActivateCharacterSkillAction } from "./actions";
import { applyLoseHpBatch } from "./loseHp";
import { startExhaustLeakResponseSequence } from "./multiTargetResponse";
import { canRecoverHp } from "./recovery";
import type {
  CardDefinition,
  CharacterId,
  CharacterSkillId,
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
import { appendEvent } from "./logEvents";

type ActiveSkillId = ActivateCharacterSkillAction["skillId"];

type ActiveSkillSpec = Readonly<{
  characterId: CharacterId;
  usageKey: CharacterUsageKey;
}>;

function createSecretarySkillSpec(): ActiveSkillSpec {
  return {
    characterId: "clumsy_party_secretary",
    usageKey: "clumsy_party_secretary_shared_active",
  };
}

const activeSkillSpecs: Record<ActiveSkillId, ActiveSkillSpec> = {
  extra_lesson: {
    characterId: "laboratory_teacher",
    usageKey: "laboratory_teacher_extra_lesson",
  },
  emergency_supply: {
    characterId: "chemical_factory_ceo",
    usageKey: "chemical_factory_ceo_emergency_supply",
  },
  exhaust_leak: createSecretarySkillSpec(),
  lab_fire: createSecretarySkillSpec(),
  exothermic_accident: createSecretarySkillSpec(),
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

function getCommonSkillActor(
  state: GameState,
  action: ActivateCharacterSkillAction,
): Player | undefined {
  const spec = activeSkillSpecs[action.skillId];
  if (!spec) {
    return undefined;
  }

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

export function validateCharacterSkillAction(
  state: GameState,
  action: ActivateCharacterSkillAction,
): boolean {
  const player = getCommonSkillActor(state, action);
  if (!player) {
    return false;
  }

  switch (action.skillId) {
    case "extra_lesson":
    case "emergency_supply": {
      return player.hand.length <= 4 && getAvailableDrawCardCount(state) > 0;
    }
    case "alkali_recovery": {
      if (!canRecoverHp(player)) {
        return false;
      }
      if (!action.cardInstanceId || !player.hand.includes(action.cardInstanceId)) {
        return false;
      }
      const instance = state.cardInstances[action.cardInstanceId];
      if (
        !instance ||
        instance.ownerId !== player.id ||
        instance.zone.type !== "hand" ||
        instance.zone.playerId !== player.id
      ) {
        return false;
      }
      const definition = definitionsById.get(instance.definitionId);
      return Boolean(
        definition &&
          definition.type === "substance" &&
          definition.tags.includes("strong-alkali"),
      );
    }
    case "exhaust_discharge": {
      if (!action.targetPlayerId) {
        return false;
      }
      const target = state.players.find((candidate) => candidate.id === action.targetPlayerId);
      return Boolean(target && target.id !== player.id && !target.eliminated);
    }
    case "exhaust_leak":
    case "lab_fire":
    case "exothermic_accident": {
      return getOtherAlivePlayerIds(state, player.id).length > 0;
    }
    default: {
      const exhaustiveSkill: never = action;
      return exhaustiveSkill;
    }
  }
}

export function getLegalCharacterSkillActions(
  state: GameState,
  playerId: PlayerId,
): readonly ActivateCharacterSkillAction[] {
  if (state.phase !== "mainAction" || state.activePlayerId !== playerId) {
    return [];
  }

  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.eliminated) {
    return [];
  }

  const legalActions: ActivateCharacterSkillAction[] = [];

  switch (player.characterId) {
    case "laboratory_teacher": {
      const action: ActivateCharacterSkillAction = {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId,
        skillId: "extra_lesson",
      };
      if (validateCharacterSkillAction(state, action)) {
        legalActions.push(action);
      }
      break;
    }
    case "chemical_factory_ceo": {
      const action: ActivateCharacterSkillAction = {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId,
        skillId: "emergency_supply",
      };
      if (validateCharacterSkillAction(state, action)) {
        legalActions.push(action);
      }
      break;
    }
    case "caustic_soda_captain": {
      for (const cardInstanceId of player.hand) {
        const action: ActivateCharacterSkillAction = {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId,
          skillId: "alkali_recovery",
          cardInstanceId,
        };
        if (validateCharacterSkillAction(state, action)) {
          legalActions.push(action);
        }
      }
      break;
    }
    case "sulfuric_acid_factory_director": {
      for (const targetPlayerId of getOtherAlivePlayerIds(state, playerId)) {
        const action: ActivateCharacterSkillAction = {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId,
          skillId: "exhaust_discharge",
          targetPlayerId,
        };
        if (validateCharacterSkillAction(state, action)) {
          legalActions.push(action);
        }
      }
      break;
    }
    case "clumsy_party_secretary": {
      const skills: readonly ["exhaust_leak", "lab_fire", "exothermic_accident"] = [
        "exhaust_leak",
        "lab_fire",
        "exothermic_accident",
      ];
      for (const skillId of skills) {
        const action: ActivateCharacterSkillAction = {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId,
          skillId,
        };
        if (validateCharacterSkillAction(state, action)) {
          legalActions.push(action);
        }
      }
      break;
    }
    default:
      break;
  }

  return legalActions;
}

export function canActivateCharacterSkill(
  state: GameState,
  playerId: PlayerId,
  skillId: CharacterSkillId,
): boolean {
  const actions = getLegalCharacterSkillActions(state, playerId);
  return actions.some((action) => action.skillId === skillId);
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

function activateDrawSkill(
  state: GameState,
  player: Player,
  skillId: "extra_lesson" | "emergency_supply",
  shuffle: ShuffleFunction,
): GameState {
  const drawCount = skillId === "extra_lesson" ? 4 : 3;
  const usageKey = activeSkillSpecs[skillId].usageKey;

  const handSizeBefore = player.hand.length;
  const drawnState = drawCardsForPlayer(state, player.id, drawCount, shuffle);
  const drawnPlayer = drawnState.players.find((candidate) => candidate.id === player.id);
  const actualDrawCount = (drawnPlayer?.hand.length ?? handSizeBefore) - handSizeBefore;
  if (!drawnPlayer || actualDrawCount <= 0) {
    return state;
  }

  const loggedState = appendEvent(
    markSkillUsed(drawnState, player.id, usageKey),
    {
      eventKey: "skill_draw",
      params: { playerId: player.id, skillId, amount: actualDrawCount },
    },
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

  if (!instance || !definition) {
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
  const loggedState = appendEvent(
    markSkillUsed(
      withCostDiscarded,
      player.id,
      activeSkillSpecs.alkali_recovery.usageKey,
    ),
    {
      eventKey: "skill_alkali_recovery",
      params: {
        playerId: player.id,
        cardDefinitionId: definition.id,
        amount: healedHp - player.hp,
      },
    },
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
  if (!target) {
    return state;
  }

  const withStatus = addStatusIfMissing(state, target.id, player.id, "SO2_LEAK");
  const loggedState = appendEvent(
    markSkillUsed(
      withStatus,
      player.id,
      activeSkillSpecs.exhaust_discharge.usageKey,
    ),
    {
      eventKey: "skill_exhaust_discharge",
      params: { actorId: player.id, targetId: target.id },
    },
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
  const withLog = appendEvent(withUsage, {
    eventKey: "skill_exhaust_leak",
    params: { playerId: player.id, targetCount: targetPlayerIds.length },
  });
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

  const loggedState = appendEvent(
    markSkillUsed(withStatuses, player.id, activeSkillSpecs.lab_fire.usageKey),
    {
      eventKey: "skill_lab_fire",
      params: { playerId: player.id },
    },
  );
  return advanceTurnFromReducer(loggedState, shuffle);
}

function activateExothermicAccident(
  state: GameState,
  player: Player,
  targetPlayerIds: readonly PlayerId[],
  shuffle: ShuffleFunction,
): GameState {
  const withUsageAndLog = appendEvent(
    markSkillUsed(
      state,
      player.id,
      activeSkillSpecs.exothermic_accident.usageKey,
    ),
    {
      eventKey: "skill_exothermic_accident",
      params: { playerId: player.id, amount: 1 },
    },
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
  if (!validateCharacterSkillAction(state, action)) {
    return state;
  }

  const player = state.players.find((candidate) => candidate.id === action.playerId);
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
