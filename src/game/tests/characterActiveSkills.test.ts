import { describe, expect, it } from "vitest";
import { starterDeckSize } from "../data/starterDeck";
import type { GameAction } from "../engine/actions";
import { createInitialGame } from "../engine/createInitialGame";
import { engineReducer } from "../engine/reducer";
import type {
  CardInstanceId,
  CharacterSkillId,
  GameState,
  PlayerId,
} from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";

type SkillTestCase = {
  characterId: "laboratory_teacher" | "chemical_factory_ceo";
  skillId: "extra_lesson" | "emergency_supply";
  usageKey:
    | "laboratory_teacher_extra_lesson"
    | "chemical_factory_ceo_emergency_supply";
  drawCount: number;
};

const teacherSkill: SkillTestCase = {
  characterId: "laboratory_teacher",
  skillId: "extra_lesson",
  usageKey: "laboratory_teacher_extra_lesson",
  drawCount: 4,
};

const ceoSkill: SkillTestCase = {
  characterId: "chemical_factory_ceo",
  skillId: "emergency_supply",
  usageKey: "chemical_factory_ceo_emergency_supply",
  drawCount: 3,
};

function confirmPreparation(state: GameState): GameState {
  const pending = state.pendingLaboratoryPreparation;

  if (!pending) {
    return state;
  }

  return engineReducer(state, {
    type: "CONFIRM_LABORATORY_PREPARATION",
    playerId: pending.playerId,
    keptCardInstanceIds: pending.candidateCardInstanceIds.slice(0, 10),
  });
}

function createSkillState(skill: SkillTestCase, handSize: number): GameState {
  let state = createInitialGame({
    characterIds: [skill.characterId, "acid_king"],
    shuffle: identityShuffle,
  });
  state = confirmPreparation(state);
  return setPlayerHandSize(state, state.players[0].id, handSize);
}

function setPlayerHandSize(
  state: GameState,
  playerId: PlayerId,
  handSize: number,
): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (!player || handSize > player.hand.length) {
    throw new Error(`Cannot set ${playerId} hand size to ${handSize}.`);
  }

  const discardedIds = player.hand.slice(handSize);
  const discardedIdSet = new Set(discardedIds);
  const cardInstances = { ...state.cardInstances };

  for (const cardId of discardedIds) {
    cardInstances[cardId] = {
      ...cardInstances[cardId],
      ownerId: undefined,
      zone: { type: "discard" },
    };
  }

  return {
    ...state,
    cardInstances,
    discardPile: [...state.discardPile, ...discardedIds],
    players: state.players.map((candidate) =>
      candidate.id === playerId
        ? { ...candidate, hand: candidate.hand.filter((cardId) => !discardedIdSet.has(cardId)) }
        : candidate,
    ),
  };
}

function moveAvailableCardsToPlayer(
  state: GameState,
  playerId: PlayerId,
  cardsToLeaveInDeck: number,
): GameState {
  const availableIds = [...state.deck, ...state.discardPile];
  const deck = availableIds.slice(0, cardsToLeaveInDeck);
  const movedIds = availableIds.slice(cardsToLeaveInDeck);
  const movedIdSet = new Set(movedIds);
  const cardInstances = { ...state.cardInstances };

  for (const cardId of deck) {
    cardInstances[cardId] = {
      ...cardInstances[cardId],
      ownerId: undefined,
      zone: { type: "deck" },
    };
  }

  for (const cardId of movedIds) {
    cardInstances[cardId] = {
      ...cardInstances[cardId],
      ownerId: playerId,
      zone: { type: "hand", playerId },
    };
  }

  return {
    ...state,
    cardInstances,
    deck,
    discardPile: [],
    players: state.players.map((player) => ({
      ...player,
      hand: [
        ...player.hand.filter((cardId) => !movedIdSet.has(cardId)),
        ...(player.id === playerId ? movedIds : []),
      ],
    })),
  };
}

function activateSkill(
  state: GameState,
  skillId: CharacterSkillId,
  playerId = state.activePlayerId,
): GameState {
  return engineReducer(state, {
    type: "ACTIVATE_CHARACTER_SKILL",
    playerId,
    skillId,
  });
}

function passAction(state: GameState): GameState {
  return engineReducer(state, { type: "PASS_ACTION", playerId: state.activePlayerId });
}

function expectRejected(state: GameState, action: GameAction): void {
  const result = engineReducer(state, action);

  expect(result).toBe(state);
  expectCardZonesToBeConsistent(result);
}

describe("Phase 8B-2 active draw skills", () => {
  it.each([
    [teacherSkill, 0],
    [teacherSkill, 4],
    [ceoSkill, 0],
    [ceoSkill, 4],
  ] satisfies [SkillTestCase, number][])(
    "allows $skillId with $handSize cards",
    (skill, handSize) => {
      let state = createSkillState(skill, handSize);
      state = {
        ...state,
        players: state.players.map((player) =>
          player.id === state.activePlayerId
            ? {
                ...player,
                usedDIYThisCycle: true,
                characterUsage: {
                  perCycle: { clumsy_party_secretary_shared_active: 1 },
                  perRound: { sulfuric_acid_factory_director_sulfate_byproduct: 1 },
                },
              }
            : player,
        ),
      };
      const activePlayerId = state.activePlayerId;
      const referenceCardId = state.players[1].hand[0];
      const referenceCard = state.cardInstances[referenceCardId];
      state = {
        ...state,
        tableReference: {
          cardInstanceId: referenceCardId,
          definitionId: referenceCard.definitionId,
          displayName: "测试场面基准",
          playedBy: state.players[1].id,
          cycle: state.cycleNumber,
          round: state.roundInCycle,
        },
      };
      const tableReference = state.tableReference;

      const result = activateSkill(state, skill.skillId);
      const player = result.players.find((candidate) => candidate.id === activePlayerId)!;

      expect(player.hand).toHaveLength(handSize + skill.drawCount);
      expect(player.characterUsage.perCycle[skill.usageKey]).toBe(1);
      expect(player.characterUsage.perCycle.clumsy_party_secretary_shared_active).toBe(1);
      expect(player.characterUsage.perRound).toEqual({
        sulfuric_acid_factory_director_sulfate_byproduct: 1,
      });
      expect(player.usedDIYThisCycle).toBe(true);
      expect(result.activePlayerId).toBe(result.players[1].id);
      expect(result.tableReference).toBe(tableReference);
      expect(result.log.some((entry) => entry.message.includes(`实际摸 ${skill.drawCount} 张`))).toBe(true);
      expectCardZonesToBeConsistent(result);
    },
  );

  it.each([teacherSkill, ceoSkill])("rejects $skillId with five cards", (skill) => {
    const state = createSkillState(skill, 5);

    expectRejected(state, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: state.activePlayerId,
      skillId: skill.skillId,
    });
  });

  it("rejects mismatched roles, non-active players, and unimplemented skills", () => {
    const teacherState = createSkillState(teacherSkill, 4);
    const ceoState = createSkillState(ceoSkill, 4);

    expectRejected(teacherState, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: teacherState.activePlayerId,
      skillId: "emergency_supply",
    });
    expectRejected(ceoState, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: ceoState.activePlayerId,
      skillId: "extra_lesson",
    });
    const eliminatedTeacher: GameState = {
      ...teacherState,
      players: teacherState.players.map((player) =>
        player.id === teacherState.activePlayerId
          ? { ...player, eliminated: true }
          : player,
      ),
    };
    expectRejected(eliminatedTeacher, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: eliminatedTeacher.activePlayerId,
      skillId: "extra_lesson",
    });
    expectRejected(teacherState, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: teacherState.players[1].id,
      skillId: "extra_lesson",
    });

    for (const skillId of ["lab_fire", "alkali_recovery", "sulfate_byproduct"] satisfies CharacterSkillId[]) {
      expectRejected(teacherState, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: teacherState.activePlayerId,
        skillId,
      });
    }
  });

  it.each(["preparationSelection", "responseWindow", "statusWindow", "gameOver"] as const)(
    "rejects active skills during %s",
    (phase) => {
      const baseState = phase === "preparationSelection"
        ? createInitialGame({ shuffle: identityShuffle })
        : createSkillState(teacherSkill, 4);
      const state: GameState = { ...baseState, phase };

      expectRejected(state, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: state.activePlayerId,
        skillId: "extra_lesson",
      });
    },
  );

  it("rejects a second activation in the same cycle and after a new round starts", () => {
    let state = createSkillState(teacherSkill, 0);
    state = activateSkill(state, teacherSkill.skillId);
    state = passAction(state);

    expect(state.roundInCycle).toBe(2);
    expect(state.activePlayerId).toBe(state.players[0].id);
    expectRejected(state, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: state.activePlayerId,
      skillId: teacherSkill.skillId,
    });
  });

  it("resets per-cycle usage at the next cycle and allows activation again", () => {
    let state = createSkillState(teacherSkill, 0);
    state = activateSkill(state, teacherSkill.skillId);
    state = passAction(state);
    state = passAction(state);
    state = passAction(state);
    state = passAction(state);
    state = passAction(state);

    expect(state.cycleNumber).toBe(2);
    expect(state.phase).toBe("preparationSelection");
    state = confirmPreparation(state);
    state = setPlayerHandSize(state, state.players[0].id, 4);

    expect(state.players[0].characterUsage.perCycle[teacherSkill.usageKey]).toBeUndefined();
    const result = activateSkill(state, teacherSkill.skillId);

    expect(result).not.toBe(state);
    expect(result.log.filter((entry) => entry.message.includes("发动补课"))).toHaveLength(2);
    expectCardZonesToBeConsistent(result);
  });

  it("enters the next player's existing status window after a successful skill", () => {
    let state = createSkillState(teacherSkill, 0);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === state.players[1].id
          ? {
              ...player,
              statuses: [
                {
                  id: "status_test_fire",
                  statusId: "FIRE",
                  sourcePlayerId: state.players[0].id,
                  createdAt: 1,
                },
              ],
            }
          : player,
      ),
    };

    const result = activateSkill(state, teacherSkill.skillId);

    expect(result.phase).toBe("statusWindow");
    expect(result.activePlayerId).toBe(state.players[1].id);
    expect(result.pendingStatusHandling?.statusInstanceId).toBe("status_test_fire");
    expectCardZonesToBeConsistent(result);
  });

  it("advances the round when the last player uses a skill", () => {
    let state = createInitialGame({
      characterIds: ["acid_king", "chemical_factory_ceo"],
      shuffle: identityShuffle,
    });
    state = setPlayerHandSize(state, state.players[1].id, 4);
    state = { ...state, activePlayerId: state.players[1].id };

    const result = activateSkill(state, ceoSkill.skillId);

    expect(result.roundInCycle).toBe(2);
    expect(result.activePlayerId).toBe(result.players[0].id);
    expect(result.players[1].characterUsage.perCycle[ceoSkill.usageKey]).toBe(1);
    expectCardZonesToBeConsistent(result);
  });

  it("starts the next cycle preparation when the third-round last player uses a skill", () => {
    let state = createInitialGame({
      characterIds: ["acid_king", "laboratory_teacher"],
      shuffle: identityShuffle,
    });
    state = confirmPreparation(state);
    state = setPlayerHandSize(state, state.players[1].id, 4);
    state = {
      ...state,
      activePlayerId: state.players[1].id,
      roundInCycle: 3,
    };

    const result = activateSkill(state, teacherSkill.skillId);

    expect(result.cycleNumber).toBe(2);
    expect(result.roundInCycle).toBe(1);
    expect(result.phase).toBe("preparationSelection");
    expect(result.pendingLaboratoryPreparation?.playerId).toBe(result.players[1].id);
    expect(result.players[1].characterUsage.perCycle[teacherSkill.usageKey]).toBeUndefined();
    expectCardZonesToBeConsistent(result);
  });

  it("counts a partial draw as a successful activation", () => {
    let state = createSkillState(teacherSkill, 0);
    state = moveAvailableCardsToPlayer(state, state.players[1].id, 2);

    const result = activateSkill(state, teacherSkill.skillId);

    expect(result.players[0].hand).toHaveLength(2);
    expect(result.players[0].characterUsage.perCycle[teacherSkill.usageKey]).toBe(1);
    expect(result.activePlayerId).toBe(result.players[1].id);
    expect(result.log.some((entry) => entry.message.includes("实际摸 2 张"))).toBe(true);
    expect(Object.keys(result.cardInstances)).toHaveLength(68);
    expectCardZonesToBeConsistent(result);
  });

  it("uses the existing discard recycle path when the deck is empty", () => {
    let state = createSkillState(ceoSkill, 0);
    const discardPile = [...state.deck, ...state.discardPile];
    const cardInstances = { ...state.cardInstances };

    for (const cardId of discardPile) {
      cardInstances[cardId] = {
        ...cardInstances[cardId],
        ownerId: undefined,
        zone: { type: "discard" },
      };
    }
    state = { ...state, cardInstances, deck: [], discardPile };

    const result = activateSkill(state, ceoSkill.skillId);

    expect(result.players[0].hand).toHaveLength(3);
    expect(result.players[0].characterUsage.perCycle[ceoSkill.usageKey]).toBe(1);
    expect(result.log.some((entry) => entry.message.includes("弃牌堆洗回主牌堆"))).toBe(true);
    expectCardZonesToBeConsistent(result);
  });

  it("rejects activation with zero available cards without side effects", () => {
    let state = createSkillState(teacherSkill, 0);
    state = moveAvailableCardsToPlayer(state, state.players[1].id, 0);

    expectRejected(state, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: state.activePlayerId,
      skillId: teacherSkill.skillId,
    });
  });

  it("keeps the ordinary pool at 68 with zero lab-fire instances", () => {
    const state = createSkillState(teacherSkill, 4);

    expect(starterDeckSize).toBe(68);
    expect(Object.keys(state.cardInstances)).toHaveLength(68);
    expect(
      Object.values(state.cardInstances).some(
        (instance) => instance.definitionId === "event_lab_fire",
      ),
    ).toBe(false);
  });
});
