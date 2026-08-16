import { describe, expect, it } from "vitest";
import { identityShuffle } from "../../shared/random";
import { createInitialGame } from "../engine/createInitialGame";
import {
  canActivateCharacterSkill,
  getLegalCharacterSkillActions,
  validateCharacterSkillAction,
} from "../engine/characterSkills";
import { engineReducer } from "../engine/reducer";
import type { GameState } from "../engine/types";

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

function createReadyMainGameState(characters: [string, string]): GameState {
  const state = createInitialGame({
    characterIds: characters as any,
    shuffle: identityShuffle,
  });
  return confirmPreparation(state);
}

describe("Phase 19A — Parameterized Character Skill Legality", () => {
  describe("Laboratory Teacher (extra_lesson)", () => {
    it("validates extra_lesson when hand <= 4 and draw deck has cards", () => {
      let state = createReadyMainGameState(["laboratory_teacher", "acid_king"]);
      const p1 = state.players[0];

      // Initially p1 has 10 cards in hand from preparation -> hand > 4 -> extra_lesson is illegal
      expect(
        validateCharacterSkillAction(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "extra_lesson",
        }),
      ).toBe(false);
      expect(canActivateCharacterSkill(state, p1.id, "extra_lesson")).toBe(false);

      // Reduce hand to 4 cards
      state = {
        ...state,
        players: [{ ...p1, hand: p1.hand.slice(0, 4) }, state.players[1]],
      };

      expect(
        validateCharacterSkillAction(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "extra_lesson",
        }),
      ).toBe(true);
      expect(canActivateCharacterSkill(state, p1.id, "extra_lesson")).toBe(true);

      const actions = getLegalCharacterSkillActions(state, p1.id);
      expect(actions).toEqual([
        {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "extra_lesson",
        },
      ]);
    });
  });

  describe("Chemical Factory CEO (emergency_supply)", () => {
    it("validates emergency_supply when hand <= 4", () => {
      let state = createReadyMainGameState(["chemical_factory_ceo", "acid_king"]);
      const p1 = state.players[0];

      // Hand <= 4
      state = {
        ...state,
        players: [{ ...p1, hand: p1.hand.slice(0, 3) }, state.players[1]],
      };

      expect(
        validateCharacterSkillAction(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "emergency_supply",
        }),
      ).toBe(true);
      expect(canActivateCharacterSkill(state, p1.id, "emergency_supply")).toBe(true);
    });
  });

  describe("Caustic Soda Captain (alkali_recovery)", () => {
    it("validates alkali_recovery requiring strong-alkali substance card and HP < maxHP", () => {
      let state = createReadyMainGameState(["caustic_soda_captain", "acid_king"]);
      const p1 = state.players[0];

      const naohCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_naoh_dilute",
      )!;
      const hclCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_hcl_dilute",
      )!;

      state = {
        ...state,
        cardInstances: {
          ...state.cardInstances,
          [naohCardId]: {
            ...state.cardInstances[naohCardId],
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
          [hclCardId]: {
            ...state.cardInstances[hclCardId],
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
        },
      };

      // When full HP: illegal
      state = {
        ...state,
        players: [{ ...p1, hp: 14, maxHp: 14, hand: [naohCardId, hclCardId] }, state.players[1]],
      };
      expect(
        validateCharacterSkillAction(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "alkali_recovery",
          cardInstanceId: naohCardId,
        }),
      ).toBe(false);

      // When damaged: legal with NaOH, illegal with HCl (not strong alkali)
      state = {
        ...state,
        players: [{ ...p1, hp: 10, maxHp: 14, hand: [naohCardId, hclCardId] }, state.players[1]],
      };
      expect(
        validateCharacterSkillAction(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "alkali_recovery",
          cardInstanceId: naohCardId,
        }),
      ).toBe(true);

      expect(
        validateCharacterSkillAction(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "alkali_recovery",
          cardInstanceId: hclCardId,
        }),
      ).toBe(false);

      const actions = getLegalCharacterSkillActions(state, p1.id);
      expect(actions).toEqual([
        {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "alkali_recovery",
          cardInstanceId: naohCardId,
        },
      ]);
    });
  });

  describe("Sulfuric Acid Factory Director (exhaust_discharge)", () => {
    it("validates exhaust_discharge requiring living opponent target", () => {
      let state = createReadyMainGameState(["sulfuric_acid_factory_director", "acid_king"]);
      const p1 = state.players[0];
      const p2 = state.players[1];

      // Valid opponent
      expect(
        validateCharacterSkillAction(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "exhaust_discharge",
          targetPlayerId: p2.id,
        }),
      ).toBe(true);

      // Self-target is invalid
      expect(
        validateCharacterSkillAction(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "exhaust_discharge",
          targetPlayerId: p1.id,
        }),
      ).toBe(false);

      // Eliminated opponent is invalid
      const stateWithEliminatedTarget: GameState = {
        ...state,
        players: [p1, { ...p2, eliminated: true }],
      };
      expect(
        validateCharacterSkillAction(stateWithEliminatedTarget, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "exhaust_discharge",
          targetPlayerId: p2.id,
        }),
      ).toBe(false);
    });
  });

  describe("Clumsy Party Secretary Shared Active Skills & Usage Limits", () => {
    it("generates all 3 active skills initially, and blocks all 3 after any one is used in cycle", () => {
      let state = createReadyMainGameState(["clumsy_party_secretary", "acid_king"]);
      const p1 = state.players[0];

      let actions = getLegalCharacterSkillActions(state, p1.id);
      expect(actions.map((a) => a.skillId)).toEqual([
        "exhaust_leak",
        "lab_fire",
        "exothermic_accident",
      ]);

      // Use lab_fire
      state = engineReducer(state, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: p1.id,
        skillId: "lab_fire",
      });

      // Now all 3 skills should be illegal because clumsy_party_secretary_shared_active is used
      actions = getLegalCharacterSkillActions(state, p1.id);
      expect(actions).toEqual([]);
      expect(canActivateCharacterSkill(state, p1.id, "lab_fire")).toBe(false);
      expect(canActivateCharacterSkill(state, p1.id, "exhaust_leak")).toBe(false);
      expect(canActivateCharacterSkill(state, p1.id, "exothermic_accident")).toBe(false);
    });
  });

  describe("Character Ownership and Phase Enforcement", () => {
    it("rejects skill activation by a character that does not own the skill", () => {
      const state = createReadyMainGameState(["laboratory_teacher", "acid_king"]);
      const p1 = state.players[0];

      expect(
        validateCharacterSkillAction(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "emergency_supply" as any,
        }),
      ).toBe(false);
    });

    it("rejects skill activation in responseWindow or statusWindow", () => {
      let state = createReadyMainGameState(["laboratory_teacher", "acid_king"]);
      const p1 = state.players[0];

      state = {
        ...state,
        phase: "responseWindow",
        players: [{ ...p1, hand: p1.hand.slice(0, 3) }, state.players[1]],
      };

      expect(
        validateCharacterSkillAction(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: p1.id,
          skillId: "extra_lesson",
        }),
      ).toBe(false);
      expect(getLegalCharacterSkillActions(state, p1.id)).toEqual([]);
    });
  });
});
