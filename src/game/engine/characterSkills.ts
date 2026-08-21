import { cardDefinitionsById } from "../data/cardDefinitions";
import type { ActivateCharacterSkillAction } from "./actions";
import { applyLoseHpBatch } from "./loseHp";
import { startExhaustLeakResponseSequence } from "./multiTargetResponse";
import { canRecoverHp } from "./recovery";
import type {
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
import {
  addStatusIfMissing,
  moveCardFromHandToDiscard,
  replacePlayer,
} from "./resolution";

type ActiveSkillId = ActivateCharacterSkillAction["skillId"];

type ActiveSkillSpec = Readonly<{
  characterId: CharacterId;
  usageKey: CharacterUsageKey;
}>;

const secSpec: ActiveSkillSpec = {
  characterId: "clumsy_party_secretary",
  usageKey: "clumsy_party_secretary_shared_active",
};

const activeSkillSpecs: Record<ActiveSkillId, ActiveSkillSpec> = {
  extra_lesson: { characterId: "laboratory_teacher", usageKey: "laboratory_teacher_extra_lesson" },
  emergency_supply: { characterId: "chemical_factory_ceo", usageKey: "chemical_factory_ceo_emergency_supply" },
  exhaust_leak: secSpec,
  lab_fire: secSpec,
  exothermic_accident: secSpec,
  alkali_recovery: { characterId: "caustic_soda_captain", usageKey: "caustic_soda_captain_alkali_recovery" },
  exhaust_discharge: { characterId: "sulfuric_acid_factory_director", usageKey: "sulfuric_acid_factory_director_exhaust_discharge" },
};

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
      const definition = cardDefinitionsById.get(instance.definitionId);
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
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return [];
  }

  const legalActions: ActivateCharacterSkillAction[] = [];
  const skillIds = (Object.keys(activeSkillSpecs) as ActiveSkillId[]).filter(
    (skillId) => activeSkillSpecs[skillId].characterId === player.characterId,
  );

  for (const skillId of skillIds) {
    if (skillId === "alkali_recovery") {
      for (const cardInstanceId of player.hand) {
        const action: ActivateCharacterSkillAction = {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId,
          skillId,
          cardInstanceId,
        };
        if (validateCharacterSkillAction(state, action)) {
          legalActions.push(action);
        }
      }
    } else if (skillId === "exhaust_discharge") {
      for (const targetPlayerId of getOtherAlivePlayerIds(state, playerId)) {
        const action: ActivateCharacterSkillAction = {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId,
          skillId,
          targetPlayerId,
        };
        if (validateCharacterSkillAction(state, action)) {
          legalActions.push(action);
        }
      }
    } else {
      const action: ActivateCharacterSkillAction = {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId,
        skillId,
      };
      if (validateCharacterSkillAction(state, action)) {
        legalActions.push(action);
      }
    }
  }

  return legalActions;
}

export function canActivateCharacterSkill(
  state: GameState,
  playerId: PlayerId,
  skillId: CharacterSkillId,
): boolean {
  return getLegalCharacterSkillActions(state, playerId).some((action) => action.skillId === skillId);
}

function markSkillUsed(state: GameState, playerId: PlayerId, usageKey: CharacterUsageKey): GameState {
  const p = state.players.find((c) => c.id === playerId);
  if (!p) return state;
  return replacePlayer(state, playerId, {
    ...p,
    characterUsage: { ...p.characterUsage, perCycle: { ...p.characterUsage.perCycle, [usageKey]: 1 } },
  });
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
  const definition = instance ? cardDefinitionsById.get(instance.definitionId) : undefined;
  const withDiscarded = moveCardFromHandToDiscard(state, action.cardInstanceId);

  if (!definition || !withDiscarded) {
    return state;
  }

  const healedHp = Math.min(player.maxHp, player.hp + 2);
  const updatedPlayer = withDiscarded.players.find((p) => p.id === player.id)!;
  const withHealing = replacePlayer(withDiscarded, player.id, {
    ...updatedPlayer,
    hp: healedHp,
  });
  const loggedState = appendEvent(
    markSkillUsed(
      withHealing,
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
    case "exhaust_leak":
    case "lab_fire":
    case "exothermic_accident": {
      const targets = getOtherAlivePlayerIds(state, player.id);
      if (targets.length === 0) return state;
      if (action.skillId === "exhaust_leak") return activateExhaustLeak(state, player, targets);
      if (action.skillId === "lab_fire") return activateLabFire(state, player, targets, shuffle);
      return activateExothermicAccident(state, player, targets, shuffle);
    }
    default: {
      const exhaustiveSkill: never = action;
      return exhaustiveSkill;
    }
  }
}
