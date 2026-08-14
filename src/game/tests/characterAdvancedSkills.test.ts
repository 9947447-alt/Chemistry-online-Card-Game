import { describe, expect, it } from "vitest";
import { starterDeckSize } from "../data/starterDeck";
import type { GameAction } from "../engine/actions";
import { createInitialGame } from "../engine/createInitialGame";
import { engineReducer } from "../engine/reducer";
import type {
  CardInstanceId,
  CharacterId,
  GameState,
  Player,
  PlayerId,
  StatusId,
} from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";
import { renderGameLogEntry } from "../../features/local-game/gameLogRenderer";

type CharacterPair = [CharacterId, CharacterId];

function createRoleGame(characterIds: CharacterPair): GameState {
  return createInitialGame({ characterIds, shuffle: identityShuffle });
}

function updatePlayer(
  state: GameState,
  playerId: PlayerId,
  update: (player: Player) => Player,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? update(player) : player)),
  };
}

function putCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState {
  const instance = state.cardInstances[cardInstanceId];
  if (!instance) {
    throw new Error(`Missing real card ${cardInstanceId}.`);
  }

  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand:
        player.id === playerId
          ? [...player.hand.filter((cardId) => cardId !== cardInstanceId), cardInstanceId]
          : player.hand.filter((cardId) => cardId !== cardInstanceId),
    })),
    deck: state.deck.filter((cardId) => cardId !== cardInstanceId),
    discardPile: state.discardPile.filter((cardId) => cardId !== cardInstanceId),
    cardInstances: {
      ...state.cardInstances,
      [cardInstanceId]: {
        ...instance,
        ownerId: playerId,
        zone: { type: "hand", playerId },
      },
    },
  };
}

function setHp(state: GameState, playerId: PlayerId, hp: number): GameState {
  return updatePlayer(state, playerId, (player) => ({ ...player, hp }));
}

function addStatus(
  state: GameState,
  playerId: PlayerId,
  statusId: StatusId,
): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    statuses: [
      ...player.statuses,
      {
        id: `status_advanced_${statusId}`,
        statusId,
        sourcePlayerId: state.players[0].id,
        createdAt: state.log.length + 1,
      },
    ],
  }));
}

function withTableReference(state: GameState): GameState {
  const referenceCardId = state.players[1].hand[0];
  const instance = state.cardInstances[referenceCardId];
  return {
    ...state,
    tableReference: {
      cardInstanceId: referenceCardId,
      definitionId: instance.definitionId,
      displayName: "测试基准",
      playedBy: state.players[1].id,
      cycle: state.cycleNumber,
      round: state.roundInCycle,
    },
  };
}

function activateRecovery(state: GameState, cardInstanceId: CardInstanceId): GameState {
  return engineReducer(state, {
    type: "ACTIVATE_CHARACTER_SKILL",
    playerId: state.activePlayerId,
    skillId: "alkali_recovery",
    cardInstanceId,
  });
}

function activateSecretary(
  state: GameState,
  skillId: "exhaust_leak" | "lab_fire" | "exothermic_accident",
): GameState {
  return engineReducer(state, {
    type: "ACTIVATE_CHARACTER_SKILL",
    playerId: state.activePlayerId,
    skillId,
  });
}

function passResponse(state: GameState): GameState {
  const responderId = state.pendingResponse?.responderId;
  if (!responderId) {
    throw new Error("Expected response window.");
  }
  return engineReducer(state, { type: "PASS_RESPONSE", playerId: responderId });
}

function expectRejected(state: GameState, action: GameAction): void {
  const resolved = engineReducer(state, action);
  expect(resolved).toBe(state);
  expectCardZonesToBeConsistent(resolved);
}

function advanceToNextCycle(state: GameState): GameState {
  let nextState = state;
  const currentCycle = state.cycleNumber;
  for (let step = 0; step < 8 && nextState.cycleNumber === currentCycle; step += 1) {
    if (nextState.phase !== "mainAction") {
      throw new Error(`Unexpected phase while advancing cycle: ${nextState.phase}`);
    }
    nextState = engineReducer(nextState, {
      type: "PASS_ACTION",
      playerId: nextState.activePlayerId,
    });
  }
  return nextState;
}

function confirmAllLaboratoryPreparation(state: GameState): GameState {
  let nextState = state;
  while (nextState.pendingLaboratoryPreparation) {
    const pending = nextState.pendingLaboratoryPreparation;
    nextState = engineReducer(nextState, {
      type: "CONFIRM_LABORATORY_PREPARATION",
      playerId: pending.playerId,
      keptCardInstanceIds: pending.candidateCardInstanceIds.slice(0, pending.keepCount),
    });
  }
  return nextState;
}

describe("Phase 8C-3 remaining active character skills", () => {
  describe("alkali recovery", () => {
    it.each([
      "substance_naoh_dilute_01",
      "substance_koh_dilute_01",
      "substance_caoh2_limewater_01",
    ])("discards real strong-alkali cost %s once and heals up to 2", (cardInstanceId) => {
      let state = createRoleGame(["caustic_soda_captain", "acid_king"]);
      state = setHp(putCardInHand(state, "player_1", cardInstanceId), "player_1", 7);
      state = withTableReference(state);
      const reference = state.tableReference;
      const usedDIY = state.players[0].usedDIYThisCycle;

      const resolved = activateRecovery(state, cardInstanceId);

      expect(resolved.players[0].hp).toBe(9);
      expect(resolved.players[0].characterUsage.perCycle.caustic_soda_captain_alkali_recovery).toBe(1);
      expect(resolved.discardPile.filter((id) => id === cardInstanceId)).toHaveLength(1);
      expect(resolved.cardInstances[cardInstanceId].zone).toEqual({ type: "discard" });
      expect(resolved.tableReference).toEqual(reference);
      expect(resolved.players[0].usedDIYThisCycle).toBe(usedDIY);
      expect(resolved.activePlayerId).toBe("player_2");
      expectCardZonesToBeConsistent(resolved);
    });

    it("heals only the missing 1 HP and still consumes the action and usage", () => {
      let state = createRoleGame(["caustic_soda_captain", "acid_king"]);
      state = setHp(putCardInHand(state, "player_1", "substance_naoh_dilute_01"), "player_1", 9);
      const resolved = activateRecovery(state, "substance_naoh_dilute_01");

      expect(resolved.players[0].hp).toBe(10);
      expect(resolved.players[0].characterUsage.perCycle.caustic_soda_captain_alkali_recovery).toBe(1);
      expect(resolved.log.some((entry) => renderGameLogEntry(entry).includes("回复 1 HP"))).toBe(true);
    });

    it.each(["FIRE", "SO2_LEAK"] as const)("atomically rejects recovery while %s blocks healing", (statusId) => {
      let state = createRoleGame(["caustic_soda_captain", "acid_king"]);
      state = setHp(putCardInHand(state, "player_1", "substance_naoh_dilute_01"), "player_1", 8);
      state = addStatus(state, "player_1", statusId);

      expectRejected(state, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "alkali_recovery",
        cardInstanceId: "substance_naoh_dilute_01",
      });
    });

    it("atomically rejects full HP, ions, another player's card, missing card, and wrong zone", () => {
      const full = putCardInHand(
        createRoleGame(["caustic_soda_captain", "acid_king"]),
        "player_1",
        "substance_naoh_dilute_01",
      );
      expectRejected(full, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "alkali_recovery",
        cardInstanceId: "substance_naoh_dilute_01",
      });

      let ion = setHp(full, "player_1", 8);
      ion = putCardInHand(ion, "player_1", "ion_oh_01");
      for (const cardInstanceId of ["ion_oh_01", "missing_card"] as const) {
        expectRejected(ion, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: "player_1",
          skillId: "alkali_recovery",
          cardInstanceId,
        });
      }

      const otherCard = putCardInHand(ion, "player_2", "substance_koh_dilute_01");
      expectRejected(otherCard, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "alkali_recovery",
        cardInstanceId: "substance_koh_dilute_01",
      });

      const wrongZone: GameState = {
        ...ion,
        cardInstances: {
          ...ion.cardInstances,
          substance_naoh_dilute_01: {
            ...ion.cardInstances.substance_naoh_dilute_01,
            ownerId: undefined,
            zone: { type: "deck" },
          },
        },
      };
      expect(engineReducer(wrongZone, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "alkali_recovery",
        cardInstanceId: "substance_naoh_dilute_01",
      })).toBe(wrongZone);
    });

    it("keeps per-cycle usage in a new round and resets it in a new cycle", () => {
      let state = createRoleGame(["caustic_soda_captain", "acid_king"]);
      state = setHp(putCardInHand(state, "player_1", "substance_naoh_dilute_01"), "player_1", 8);
      state = activateRecovery(state, "substance_naoh_dilute_01");
      state = engineReducer(state, { type: "PASS_ACTION", playerId: state.activePlayerId });

      expect(state.roundInCycle).toBe(2);
      expect(state.players[0].characterUsage.perCycle.caustic_soda_captain_alkali_recovery).toBe(1);

      state = advanceToNextCycle(state);
      expect(state.cycleNumber).toBe(2);
      expect(state.players[0].characterUsage.perCycle.caustic_soda_captain_alkali_recovery).toBeUndefined();
    });
  });

  describe("exhaust discharge", () => {
    it("adds SO2_LEAK without immediate damage or response and enters the target status window", () => {
      const initial = withTableReference(
        createRoleGame(["sulfuric_acid_factory_director", "acid_king"]),
      );
      const reference = initial.tableReference;
      const resolved = engineReducer(initial, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "exhaust_discharge",
        targetPlayerId: "player_2",
      });

      expect(resolved.players[1].hp).toBe(10);
      expect(resolved.players[1].statuses.map((status) => status.statusId)).toEqual(["SO2_LEAK"]);
      expect(resolved.phase).toBe("statusWindow");
      expect(resolved.pendingResponse).toBeUndefined();
      expect(resolved.pendingStatusHandling?.playerId).toBe("player_2");
      expect(resolved.players[0].characterUsage.perCycle.sulfuric_acid_factory_director_exhaust_discharge).toBe(1);
      expect(resolved.tableReference).toEqual(reference);
    });

    it("preserves one existing SO2_LEAK under the frozen duplicate-state behavior", () => {
      let state = createRoleGame(["sulfuric_acid_factory_director", "acid_king"]);
      state = addStatus(state, "player_2", "SO2_LEAK");
      const originalStatus = state.players[1].statuses[0];
      const resolved = engineReducer(state, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "exhaust_discharge",
        targetPlayerId: "player_2",
      });

      expect(resolved.players[1].statuses).toEqual([originalStatus]);
      expect(resolved.log.some((entry) => renderGameLogEntry(entry).includes("重复施加"))).toBe(true);
    });

    it.each(["player_1", "player_missing"])("rejects invalid target %s", (targetPlayerId) => {
      const state = createRoleGame(["sulfuric_acid_factory_director", "acid_king"]);
      expectRejected(state, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "exhaust_discharge",
        targetPlayerId,
      });
    });

    it("rejects an eliminated target", () => {
      const state = updatePlayer(
        createRoleGame(["sulfuric_acid_factory_director", "acid_king"]),
        "player_2",
        (player) => ({ ...player, eliminated: true, hp: 0 }),
      );
      expectRejected(state, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "exhaust_discharge",
        targetPlayerId: "player_2",
      });
    });
  });

  describe("secretary shared skills and multi-target response", () => {
    it("creates the frozen character-skill SO2 context and stable target snapshot", () => {
      const pending = activateSecretary(
        createRoleGame(["clumsy_party_secretary", "acid_king"]),
        "exhaust_leak",
      );
      const response = pending.pendingResponse;

      expect(pending.phase).toBe("responseWindow");
      expect(response?.responderId).toBe("player_2");
      expect(response?.sourceEffect.context).toEqual({
        targetPlayerId: "player_2",
        baseAmount: 2,
        source: {
          kind: "character-skill",
          sourcePlayerId: "player_1",
          skillId: "exhaust_leak",
        },
        tags: ["so2"],
        responsePolicy: "alkali-absorption",
      });
      expect(response?.multiTargetSequence).toEqual({
        sourcePlayerId: "player_1",
        sourceSkillId: "exhaust_leak",
        targetPlayerIds: ["player_2"],
        remainingTargetPlayerIds: [],
        completedResults: [],
        finishBehavior: "exhaust-leak",
      });
    });

    it.each(["ion_oh_01", "substance_naoh_dilute_01"])(
      "allows real alkaline absorption card %s and makes the secretary lose 1 HP",
      (cardInstanceId) => {
        let pending = activateSecretary(
          createRoleGame(["clumsy_party_secretary", "acid_king"]),
          "exhaust_leak",
        );
        pending = putCardInHand(pending, "player_2", cardInstanceId);
        const resolved = engineReducer(pending, {
          type: "RESPOND_WITH_CARD",
          playerId: "player_2",
          cardInstanceId,
        });

        expect(resolved.players[1].hp).toBe(10);
        expect(resolved.players[0].hp).toBe(9);
        expect(resolved.log.some((entry) => renderGameLogEntry(entry).includes("失去 1 点体力"))).toBe(true);
        expect(resolved.discardPile.filter((id) => id === cardInstanceId)).toHaveLength(1);
        expect(resolved.pendingResponse).toBeUndefined();
        expect(resolved.activePlayerId).toBe("player_2");
        expectCardZonesToBeConsistent(resolved);
      },
    );

    it("applies 2 ordinary SO2 DAMAGE after pass and does not penalize the secretary", () => {
      const pending = activateSecretary(
        createRoleGame(["clumsy_party_secretary", "acid_king"]),
        "exhaust_leak",
      );
      const resolved = passResponse(pending);

      expect(resolved.players[1].hp).toBe(8);
      expect(resolved.players[0].hp).toBe(10);
      expect(resolved.log.some((entry) => renderGameLogEntry(entry).includes("2 点 SO2 伤害"))).toBe(true);
      expect(resolved.players[1].statuses).toEqual([]);
    });

    it("atomically rejects wrong card, player, phase, and card zone", () => {
      let pending = activateSecretary(
        createRoleGame(["clumsy_party_secretary", "acid_king"]),
        "exhaust_leak",
      );
      pending = putCardInHand(pending, "player_2", "substance_hcl_dilute_01");
      expectRejected(pending, {
        type: "RESPOND_WITH_CARD",
        playerId: "player_2",
        cardInstanceId: "substance_hcl_dilute_01",
      });
      expectRejected(pending, {
        type: "RESPOND_WITH_CARD",
        playerId: "player_1",
        cardInstanceId: "substance_hcl_dilute_01",
      });

      const wrongPhase: GameState = { ...pending, phase: "mainAction" };
      expect(engineReducer(wrongPhase, {
        type: "PASS_RESPONSE",
        playerId: "player_2",
      })).toBe(wrongPhase);

      let wrongZone = putCardInHand(pending, "player_2", "ion_oh_01");
      wrongZone = {
        ...wrongZone,
        cardInstances: {
          ...wrongZone.cardInstances,
          ion_oh_01: {
            ...wrongZone.cardInstances.ion_oh_01,
            ownerId: undefined,
            zone: { type: "deck" },
          },
        },
      };
      expect(engineReducer(wrongZone, {
        type: "RESPOND_WITH_CARD",
        playerId: "player_2",
        cardInstanceId: "ion_oh_01",
      })).toBe(wrongZone);

      const otherPlayerCard = putCardInHand(pending, "player_1", "substance_naoh_dilute_01");
      expect(engineReducer(otherPlayerCard, {
        type: "RESPOND_WITH_CARD",
        playerId: "player_2",
        cardInstanceId: "substance_naoh_dilute_01",
      })).toBe(otherPlayerCard);
    });

    it("finishes game only after the exhaust-leak target completes", () => {
      let pending = createRoleGame(["clumsy_party_secretary", "acid_king"]);
      pending = setHp(pending, "player_2", 2);
      pending = activateSecretary(pending, "exhaust_leak");
      expect(pending.phase).toBe("responseWindow");

      const resolved = passResponse(pending);
      expect(resolved.players[1]).toMatchObject({ hp: 0, eliminated: true });
      expect(resolved.phase).toBe("gameOver");
      expect(resolved.winnerPlayerId).toBe("player_1");
    });

    it("applies virtual lab fire without damage, response, or event CardInstance", () => {
      const initial = withTableReference(
        createRoleGame(["clumsy_party_secretary", "acid_king"]),
      );
      const reference = initial.tableReference;
      const resolved = activateSecretary(initial, "lab_fire");

      expect(resolved.players[1].hp).toBe(10);
      expect(resolved.players[1].statuses.map((status) => status.statusId)).toEqual(["FIRE"]);
      expect(resolved.phase).toBe("statusWindow");
      expect(resolved.pendingResponse).toBeUndefined();
      expect(resolved.tableReference).toEqual(reference);
      expect(Object.keys(resolved.cardInstances)).toHaveLength(starterDeckSize);
      expect(Object.values(resolved.cardInstances).filter(
        (instance) => instance.definitionId === "event_lab_fire",
      )).toHaveLength(0);
    });

    it("does not duplicate an existing FIRE status", () => {
      let state = createRoleGame(["clumsy_party_secretary", "acid_king"]);
      state = addStatus(state, "player_2", "FIRE");
      const original = state.players[1].statuses[0];
      const resolved = activateSecretary(state, "lab_fire");
      expect(resolved.players[1].statuses).toEqual([original]);
    });

    it("uses the lose-HP batch for exothermic accident without response or DAMAGE", () => {
      let initial = withTableReference(
        createRoleGame(["clumsy_party_secretary", "caustic_soda_captain"]),
      );
      initial = updatePlayer(initial, "player_1", (player) => ({
        ...player,
        usedDIYThisCycle: true,
      }));
      const reference = initial.tableReference;
      const usedDIY = initial.players[0].usedDIYThisCycle;
      const resolved = activateSecretary(initial, "exothermic_accident");

      expect(resolved.players[1].hp).toBe(9);
      expect(resolved.pendingResponse).toBeUndefined();
      expect(resolved.log.some((entry) => renderGameLogEntry(entry).includes("失去 1 点体力"))).toBe(true);
      expect(resolved.tableReference).toEqual(reference);
      expect(resolved.players[0].usedDIYThisCycle).toBe(usedDIY);
    });

    it("resolves exothermic elimination and gameOver as one batch", () => {
      let state = createRoleGame(["clumsy_party_secretary", "acid_king"]);
      state = setHp(state, "player_2", 1);
      const resolved = activateSecretary(state, "exothermic_accident");
      expect(resolved.players[1]).toMatchObject({ hp: 0, eliminated: true });
      expect(resolved.phase).toBe("gameOver");
      expect(resolved.winnerPlayerId).toBe("player_1");
    });

    it.each(["exhaust_leak", "lab_fire", "exothermic_accident"] as const)(
      "shares one per-cycle usage after successful %s",
      (skillId) => {
        let state = activateSecretary(
          createRoleGame(["clumsy_party_secretary", "acid_king"]),
          skillId,
        );
        if (state.phase === "responseWindow") {
          state = passResponse(state);
        } else if (state.phase === "statusWindow") {
          state = { ...state, phase: "mainAction", pendingStatusHandling: undefined };
        }
        state = { ...state, activePlayerId: "player_1", phase: "mainAction" };

        expect(state.players[0].characterUsage.perCycle.clumsy_party_secretary_shared_active).toBe(1);
        for (const otherSkill of ["exhaust_leak", "lab_fire", "exothermic_accident"] as const) {
          expect(engineReducer(state, {
            type: "ACTIVATE_CHARACTER_SKILL",
            playerId: "player_1",
            skillId: otherSkill,
          })).toBe(state);
        }
      },
    );

    it("does not consume shared usage when no other living target exists", () => {
      const state = updatePlayer(
        createRoleGame(["clumsy_party_secretary", "acid_king"]),
        "player_2",
        (player) => ({ ...player, hp: 0, eliminated: true }),
      );
      for (const skillId of ["exhaust_leak", "lab_fire", "exothermic_accident"] as const) {
        expect(engineReducer(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: "player_1",
          skillId,
        })).toBe(state);
      }
      expect(state.players[0].characterUsage.perCycle.clumsy_party_secretary_shared_active).toBeUndefined();
    });

    it("keeps shared usage in a new round and resets it in a new cycle", () => {
      let state = activateSecretary(
        createRoleGame(["clumsy_party_secretary", "acid_king"]),
        "exothermic_accident",
      );
      state = engineReducer(state, { type: "PASS_ACTION", playerId: state.activePlayerId });

      expect(state.roundInCycle).toBe(2);
      expect(state.activePlayerId).toBe("player_1");
      expect(state.players[0].characterUsage.perCycle.clumsy_party_secretary_shared_active).toBe(1);
      expect(engineReducer(state, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "lab_fire",
      })).toBe(state);

      state = advanceToNextCycle(state);
      expect(state.cycleNumber).toBe(2);
      expect(state.players[0].characterUsage.perCycle.clumsy_party_secretary_shared_active).toBeUndefined();
    });
  });

  it("rejects wrong role, non-active player, wrong phase, eliminated actor, and gameOver", () => {
    const state = createRoleGame(["acid_king", "clumsy_party_secretary"]);
    expectRejected(state, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: "player_1",
      skillId: "lab_fire",
    });
    expectRejected(state, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: "player_2",
      skillId: "lab_fire",
    });

    const wrongPhase: GameState = { ...state, phase: "responseWindow" };
    expect(engineReducer(wrongPhase, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: "player_1",
      skillId: "exothermic_accident",
    })).toBe(wrongPhase);

    const eliminated = updatePlayer(state, "player_1", (player) => ({ ...player, eliminated: true }));
    expect(engineReducer(eliminated, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: "player_1",
      skillId: "exothermic_accident",
    })).toBe(eliminated);

    const gameOver: GameState = { ...state, phase: "gameOver" };
    expect(engineReducer(gameOver, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: "player_1",
      skillId: "exothermic_accident",
    })).toBe(gameOver);
  });

  it("advances a last-player third-round skill into the next cycle preparation phase", () => {
    let state = confirmAllLaboratoryPreparation(
      createRoleGame(["laboratory_teacher", "clumsy_party_secretary"]),
    );
    state = {
      ...state,
      activePlayerId: "player_2",
      startingPlayerId: "player_1",
      roundInCycle: 3,
      phase: "mainAction",
    };

    const resolved = activateSecretary(state, "exothermic_accident");
    expect(resolved.cycleNumber).toBe(2);
    expect(resolved.roundInCycle).toBe(1);
    expect(resolved.phase).toBe("preparationSelection");
    expect(resolved.pendingLaboratoryPreparation?.playerId).toBe("player_1");
    expect(resolved.players[1].characterUsage.perCycle.clumsy_party_secretary_shared_active).toBeUndefined();
  });
});
