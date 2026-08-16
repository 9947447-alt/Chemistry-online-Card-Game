import { describe, expect, it } from "vitest";
import { diyRecipes, type DIYRecipe } from "../data/diyRecipes";
import { analyzeDIYSelection } from "../engine/diy";
import { engineReducer } from "../engine/reducer";
import type {
  CardInstanceId,
  GameState,
  Player,
  PlayerId,
  StatusId,
} from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { createMvp0TestGame } from "./createTestGame";
import { expectCardZonesToBeConsistent } from "./assertCardZones";

function putCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState {
  const card = state.cardInstances[cardInstanceId];
  if (!card) {
    throw new Error(`Missing test card ${cardInstanceId}`);
  }

  const playersWithoutCard = state.players.map((player) => ({
    ...player,
    hand: player.hand.filter((heldCardId) => heldCardId !== cardInstanceId),
  }));

  return {
    ...state,
    players: playersWithoutCard.map((player) =>
      player.id === playerId
        ? { ...player, hand: [...player.hand, cardInstanceId] }
        : player,
    ),
    deck: state.deck.filter((deckCardId) => deckCardId !== cardInstanceId),
    discardPile: state.discardPile.filter((discardCardId) => discardCardId !== cardInstanceId),
    cardInstances: {
      ...state.cardInstances,
      [cardInstanceId]: {
        ...card,
        ownerId: playerId,
        zone: { type: "hand", playerId },
      },
    },
  };
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

function addStatusForTest(
  state: GameState,
  playerId: PlayerId,
  statusId: StatusId,
  createdAt = 1,
): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    statuses: [
      ...player.statuses,
      {
        id: `status_test_${statusId}_${createdAt}`,
        statusId,
        sourcePlayerId: state.players[0].id,
        createdAt,
      },
    ],
  }));
}

function getNormalizedComponentSignature(recipe: DIYRecipe): string {
  const sorted = [...recipe.requiredComponents].sort((a, b) =>
    a.definitionId.localeCompare(b.definitionId),
  );
  return sorted.map((c) => `${c.definitionId}:${c.count}`).join(",");
}

describe("Phase 18D — Authoritative DIY Selection Resolver V1", () => {
  describe("A. Analyzer purity", () => {
    it("never mutates GameState or produces side effects", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");

      const clonedBefore = JSON.parse(JSON.stringify(state));

      const analysis = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_cl_01"],
        opponent.id,
      );

      expect(analysis.status).toBe("EXECUTABLE");
      expect(JSON.parse(JSON.stringify(state))).toEqual(clonedBefore);
      expect(state.phase).toBe("mainAction");
      expect(state.players[0].hand).toContain("ion_h_01");
      expect(state.players[0].hand).toContain("ion_cl_01");
      expect(state.discardPile).toHaveLength(0);
      expect(state.log).toHaveLength(clonedBefore.log.length);
    });
  });

  describe("B. INVALID_SELECTION", () => {
    it("identifies duplicate CardInstanceIds in selection", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");

      const result = analyzeDIYSelection(state, actor.id, ["ion_h_01", "ion_h_01"]);
      expect(result).toEqual({
        status: "INVALID_SELECTION",
        invalidCardInstanceIds: ["ion_h_01"],
      });
    });

    it("identifies unknown CardInstanceId", () => {
      const state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;

      const result = analyzeDIYSelection(state, actor.id, ["nonexistent_card_instance"]);
      expect(result).toEqual({
        status: "INVALID_SELECTION",
        invalidCardInstanceIds: ["nonexistent_card_instance"],
      });
    });

    it("identifies CardInstance not in current player's hand", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, opponent.id, "ion_h_01");

      const result = analyzeDIYSelection(state, actor.id, ["ion_h_01"]);
      expect(result).toEqual({
        status: "INVALID_SELECTION",
        invalidCardInstanceIds: ["ion_h_01"],
      });
    });

    it("identifies CardInstance without diy-component timing", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = putCardInHand(state, actor.id, "substance_h2o_01");

      const result = analyzeDIYSelection(state, actor.id, ["substance_h2o_01"]);
      expect(result).toEqual({
        status: "INVALID_SELECTION",
        invalidCardInstanceIds: ["substance_h2o_01"],
      });
    });

    it("collects all invalid cards deterministically and deduplicated", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "substance_h2o_01");
      state = putCardInHand(state, opponent.id, "ion_cl_01");

      const result = analyzeDIYSelection(state, actor.id, [
        "substance_h2o_01",
        "unknown_card",
        "ion_cl_01",
        "ion_h_01",
        "ion_h_01",
      ]);

      expect(result.status).toBe("INVALID_SELECTION");
      if (result.status === "INVALID_SELECTION") {
        expect(result.invalidCardInstanceIds).toEqual([
          "substance_h2o_01",
          "unknown_card",
          "ion_cl_01",
          "ion_h_01",
        ]);
      }
    });
  });

  describe("C. NO_RECIPE_MATCH", () => {
    it("returns NO_RECIPE_MATCH for empty selection", () => {
      const state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;

      const result = analyzeDIYSelection(state, actor.id, []);
      expect(result).toEqual({ status: "NO_RECIPE_MATCH" });
    });

    it("returns NO_RECIPE_MATCH for valid diy-components with no recipe match", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = putCardInHand(state, actor.id, "element_c_01");
      state = putCardInHand(state, actor.id, "element_s_01");

      const result = analyzeDIYSelection(state, actor.id, ["element_c_01", "element_s_01"]);
      expect(result).toEqual({ status: "NO_RECIPE_MATCH" });
    });

    it("returns NO_RECIPE_MATCH for partial recipe component set", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = putCardInHand(state, actor.id, "element_c_01");
      state = putCardInHand(state, actor.id, "element_o_01");

      // CO2 requires C + O + O; 1 C and 1 O is partial
      const result = analyzeDIYSelection(state, actor.id, ["element_c_01", "element_o_01"]);
      expect(result).toEqual({ status: "NO_RECIPE_MATCH" });
    });

    it("returns NO_RECIPE_MATCH for superset with extra component", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");
      state = putCardInHand(state, actor.id, "ion_na_01");

      const result = analyzeDIYSelection(state, actor.id, [
        "ion_h_01",
        "ion_cl_01",
        "ion_na_01",
      ]);
      expect(result).toEqual({ status: "NO_RECIPE_MATCH" });
    });
  });

  describe("D. MATCHED_NOT_EXECUTABLE and Blocker Precedence", () => {
    it("returns NOT_ACTIVE_PLAYER when acting out of turn", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, opponent.id, "ion_h_01");
      state = putCardInHand(state, opponent.id, "ion_cl_01");

      const result = analyzeDIYSelection(
        state,
        opponent.id,
        ["ion_h_01", "ion_cl_01"],
        actor.id,
      );

      expect(result).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        blockerCode: "NOT_ACTIVE_PLAYER",
      });
    });

    it("returns NOT_ACTIVE_PLAYER when player is eliminated", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = updatePlayer(state, actor.id, (p) => ({ ...p, eliminated: true }));
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_cl_01"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        blockerCode: "NOT_ACTIVE_PLAYER",
      });
    });

    it("returns INVALID_PHASE outside mainAction", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = { ...state, phase: "statusWindow" };
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_cl_01"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        blockerCode: "INVALID_PHASE",
      });
    });

    it("returns DIY_ALREADY_USED_THIS_CYCLE when usedDIYThisCycle is true", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = updatePlayer(state, actor.id, (p) => ({ ...p, usedDIYThisCycle: true }));
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_cl_01"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        blockerCode: "DIY_ALREADY_USED_THIS_CYCLE",
      });
    });

    it("returns OWN_FIRE_REQUIRED for CO2 when player is not on fire", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = putCardInHand(state, actor.id, "element_c_01");
      state = putCardInHand(state, actor.id, "element_o_01");
      state = putCardInHand(state, actor.id, "element_o_02");

      const result = analyzeDIYSelection(state, actor.id, [
        "element_c_01",
        "element_o_01",
        "element_o_02",
      ]);

      expect(result).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_co2_from_c_o_o",
        blockerCode: "OWN_FIRE_REQUIRED",
      });
    });

    it("returns UNEXPECTED_TARGET for CO2 when targetPlayerId is supplied", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = addStatusForTest(state, actor.id, "FIRE");
      state = putCardInHand(state, actor.id, "element_c_01");
      state = putCardInHand(state, actor.id, "element_o_01");
      state = putCardInHand(state, actor.id, "element_o_02");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["element_c_01", "element_o_01", "element_o_02"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_co2_from_c_o_o",
        blockerCode: "UNEXPECTED_TARGET",
      });
    });

    it("returns UNEXPECTED_TARGET before OWN_FIRE_REQUIRED for no-target recipes", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_oh_01");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_oh_01"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_h2o_from_h_oh",
        blockerCode: "UNEXPECTED_TARGET",
      });
    });

    it("returns TARGET_PLAYER_REQUIRED when targeted recipe missing target", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");

      const result = analyzeDIYSelection(state, actor.id, ["ion_h_01", "ion_cl_01"]);

      expect(result).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        blockerCode: "TARGET_PLAYER_REQUIRED",
      });
    });

    it("returns TARGET_PLAYER_INVALID when targeting self", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_cl_01"],
        actor.id,
      );

      expect(result).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        blockerCode: "TARGET_PLAYER_INVALID",
      });
    });

    it("returns TARGET_PLAYER_INVALID when target is eliminated or nonexistent", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = updatePlayer(state, opponent.id, (p) => ({ ...p, eliminated: true }));
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");

      const resultEliminated = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_cl_01"],
        opponent.id,
      );
      expect(resultEliminated).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        blockerCode: "TARGET_PLAYER_INVALID",
      });

      const resultNonexistent = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_cl_01"],
        "ghost_player",
      );
      expect(resultNonexistent).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        blockerCode: "TARGET_PLAYER_INVALID",
      });
    });

    it("respects deterministic blocker priority order", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = { ...state, phase: "statusWindow" };
      state = updatePlayer(state, actor.id, (p) => ({ ...p, usedDIYThisCycle: true }));
      state = putCardInHand(state, opponent.id, "ion_h_01");
      state = putCardInHand(state, opponent.id, "ion_cl_01");

      // 1. Not active player vs wrong phase: NOT_ACTIVE_PLAYER wins
      const res1 = analyzeDIYSelection(
        state,
        opponent.id,
        ["ion_h_01", "ion_cl_01"],
        actor.id,
      );
      expect(res1).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        blockerCode: "NOT_ACTIVE_PLAYER",
      });

      // 2. Active player + wrong phase + used DIY: INVALID_PHASE wins
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");
      const res2 = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_cl_01"],
        opponent.id,
      );
      expect(res2).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        blockerCode: "INVALID_PHASE",
      });

      // 3. Active player + mainAction + used DIY + missing FIRE: DIY_ALREADY_USED_THIS_CYCLE wins
      state = { ...state, phase: "mainAction" };
      state = putCardInHand(state, actor.id, "element_c_01");
      state = putCardInHand(state, actor.id, "element_o_01");
      state = putCardInHand(state, actor.id, "element_o_02");
      const res3 = analyzeDIYSelection(state, actor.id, [
        "element_c_01",
        "element_o_01",
        "element_o_02",
      ]);
      expect(res3).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_co2_from_c_o_o",
        blockerCode: "DIY_ALREADY_USED_THIS_CYCLE",
      });

      // 4. Target semantics are authoritative for no-target recipes, even without FIRE.
      state = updatePlayer(state, actor.id, (p) => ({ ...p, usedDIYThisCycle: false }));
      const res4 = analyzeDIYSelection(
        state,
        actor.id,
        ["element_c_01", "element_o_01", "element_o_02"],
        opponent.id,
      );
      expect(res4).toEqual({
        status: "MATCHED_NOT_EXECUTABLE",
        recipeId: "diy_co2_from_c_o_o",
        blockerCode: "UNEXPECTED_TARGET",
      });
    });
  });

  describe("E. EXECUTABLE: all 8 recipes resolve to exact semantic outcomes", () => {
    it("1. CO2: C + O + O -> CO2_REMOVE_OWN_FIRE", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = addStatusForTest(state, actor.id, "FIRE");
      state = putCardInHand(state, actor.id, "element_c_01");
      state = putCardInHand(state, actor.id, "element_o_01");
      state = putCardInHand(state, actor.id, "element_o_02");

      const result = analyzeDIYSelection(state, actor.id, [
        "element_c_01",
        "element_o_01",
        "element_o_02",
      ]);

      expect(result).toEqual({
        status: "EXECUTABLE",
        recipeId: "diy_co2_from_c_o_o",
        outcome: { kind: "CO2_REMOVE_OWN_FIRE" },
      });
    });

    it("2. H2O: H+ + OH- -> H2O_REMOVE_OWN_FIRE", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = addStatusForTest(state, actor.id, "FIRE");
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_oh_01");

      const result = analyzeDIYSelection(state, actor.id, ["ion_h_01", "ion_oh_01"]);

      expect(result).toEqual({
        status: "EXECUTABLE",
        recipeId: "diy_h2o_from_h_oh",
        outcome: { kind: "H2O_REMOVE_OWN_FIRE" },
      });
    });

    it("3. HCl: H+ + Cl- -> VIRTUAL_ATTACK (acid, 1)", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_cl_01"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "EXECUTABLE",
        recipeId: "diy_hcl_from_h_cl",
        outcome: {
          kind: "VIRTUAL_ATTACK",
          targetPlayerId: opponent.id,
          damageKind: "acid",
          damageAmount: 1,
        },
      });
    });

    it("4. H2SO4: 2H+ + SO4^2- -> VIRTUAL_ATTACK (acid, 1)", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_h_02");
      state = putCardInHand(state, actor.id, "ion_so4_01");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_h_01", "ion_h_02", "ion_so4_01"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "EXECUTABLE",
        recipeId: "diy_h2so4_from_2h_so4",
        outcome: {
          kind: "VIRTUAL_ATTACK",
          targetPlayerId: opponent.id,
          damageKind: "acid",
          damageAmount: 1,
        },
      });
    });

    it("5. NaOH: Na+ + OH- -> VIRTUAL_ATTACK (base, 1)", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_na_01");
      state = putCardInHand(state, actor.id, "ion_oh_01");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_na_01", "ion_oh_01"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "EXECUTABLE",
        recipeId: "diy_naoh_from_na_oh",
        outcome: {
          kind: "VIRTUAL_ATTACK",
          targetPlayerId: opponent.id,
          damageKind: "base",
          damageAmount: 1,
        },
      });
    });

    it("6. KOH: K+ + OH- -> VIRTUAL_ATTACK (base, 1)", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_k_01");
      state = putCardInHand(state, actor.id, "ion_oh_01");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_k_01", "ion_oh_01"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "EXECUTABLE",
        recipeId: "diy_koh_from_k_oh",
        outcome: {
          kind: "VIRTUAL_ATTACK",
          targetPlayerId: opponent.id,
          damageKind: "base",
          damageAmount: 1,
        },
      });
    });

    it("7. Ca(OH)2: Ca2+ + 2OH- -> VIRTUAL_ATTACK (base, 1)", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_ca_01");
      state = putCardInHand(state, actor.id, "ion_oh_01");
      state = putCardInHand(state, actor.id, "ion_oh_02");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "EXECUTABLE",
        recipeId: "diy_limewater_from_ca_2oh",
        outcome: {
          kind: "VIRTUAL_ATTACK",
          targetPlayerId: opponent.id,
          damageKind: "base",
          damageAmount: 1,
        },
      });
    });

    it("8. SO2: S + O + O -> SO2_APPLY_LEAK", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "element_s_01");
      state = putCardInHand(state, actor.id, "element_o_01");
      state = putCardInHand(state, actor.id, "element_o_02");

      const result = analyzeDIYSelection(
        state,
        actor.id,
        ["element_s_01", "element_o_01", "element_o_02"],
        opponent.id,
      );

      expect(result).toEqual({
        status: "EXECUTABLE",
        recipeId: "diy_so2_from_s_o_o",
        outcome: {
          kind: "SO2_APPLY_LEAK",
          targetPlayerId: opponent.id,
        },
      });
    });
  });

  describe("F. Recipe registry invariants", () => {
    it("has exactly 8 active recipes with unique IDs", () => {
      expect(diyRecipes).toHaveLength(8);
      const ids = diyRecipes.map((r) => r.id);
      expect(new Set(ids).size).toBe(8);
    });

    it("all required component counts are positive integers", () => {
      for (const recipe of diyRecipes) {
        expect(recipe.requiredComponents.length).toBeGreaterThan(0);
        for (const req of recipe.requiredComponents) {
          expect(Number.isInteger(req.count)).toBe(true);
          expect(req.count).toBeGreaterThan(0);
        }
      }
    });

    it("has unique normalized component multiset signatures across all recipes", () => {
      const signatures = diyRecipes.map(getNormalizedComponentSignature);
      expect(new Set(signatures).size).toBe(diyRecipes.length);
    });

    it.each(["damageKind", "damageAmount", "displayName"] as const)(
      "rejects a VIRTUAL_ATTACK recipe missing %s instead of inventing gameplay defaults",
      (missingField) => {
        const attackRecipe = diyRecipes.find((recipe) => recipe.id === "diy_hcl_from_h_cl");
        if (!attackRecipe || attackRecipe.result !== "VIRTUAL_ATTACK") {
          throw new Error("Missing HCl DIY recipe fixture");
        }

        const originalAttackMetadata = {
          damageKind: attackRecipe.damageKind,
          damageAmount: attackRecipe.damageAmount,
          displayName: attackRecipe.displayName,
        };

        Reflect.deleteProperty(attackRecipe, missingField);
        try {
          let state = createMvp0TestGame({ shuffle: identityShuffle });
          const [actor, opponent] = state.players;
          state = putCardInHand(state, actor.id, "ion_h_01");
          state = putCardInHand(state, actor.id, "ion_cl_01");

          expect(() =>
            analyzeDIYSelection(
              state,
              actor.id,
              ["ion_h_01", "ion_cl_01"],
              opponent.id,
            ),
          ).toThrow(/Registry invariant violation.*VIRTUAL_ATTACK.*metadata/);
        } finally {
          Object.assign(attackRecipe, originalAttackMetadata);
        }
      },
    );

    it("matching is order-independent with respect to component card order", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_ca_01");
      state = putCardInHand(state, actor.id, "ion_oh_01");
      state = putCardInHand(state, actor.id, "ion_oh_02");

      const res1 = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
        opponent.id,
      );
      const res2 = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_oh_02", "ion_ca_01", "ion_oh_01"],
        opponent.id,
      );
      const res3 = analyzeDIYSelection(
        state,
        actor.id,
        ["ion_oh_01", "ion_oh_02", "ion_ca_01"],
        opponent.id,
      );

      expect(res1).toEqual(res2);
      expect(res2).toEqual(res3);
    });
  });

  describe("G. New Action: PLAY_DIY_SELECTION", () => {
    it("does not require recipeId and executes successfully", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");

      const nextState = engineReducer(state, {
        type: "PLAY_DIY_SELECTION",
        playerId: actor.id,
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
        targetPlayerId: opponent.id,
      });

      expect(nextState.phase).toBe("responseWindow");
      expect(nextState.pendingResponse?.responderId).toBe(opponent.id);
      expect(nextState.pendingResponse?.sourceEffect.context.source).toEqual({
        kind: "diy",
        recipeId: "diy_hcl_from_h_cl",
        sourcePlayerId: actor.id,
      });
      expect(nextState.players[0].hand).not.toContain("ion_h_01");
      expect(nextState.players[0].hand).not.toContain("ion_cl_01");
      expect(nextState.discardPile).toContain("ion_h_01");
      expect(nextState.discardPile).toContain("ion_cl_01");
      expect(nextState.players[0].usedDIYThisCycle).toBe(true);
      expectCardZonesToBeConsistent(nextState);
    });

    it("returns exact original state on invalid selection", () => {
      const state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;

      const nextState = engineReducer(state, {
        type: "PLAY_DIY_SELECTION",
        playerId: actor.id,
        componentCardInstanceIds: ["unknown_card_id"],
        targetPlayerId: opponent.id,
      });

      expect(nextState).toBe(state);
    });

    it("returns exact original state on matched but non-executable selection", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor] = state.players;
      state = putCardInHand(state, actor.id, "element_c_01");
      state = putCardInHand(state, actor.id, "element_o_01");
      state = putCardInHand(state, actor.id, "element_o_02");

      // CO2 without FIRE is non-executable
      const nextState = engineReducer(state, {
        type: "PLAY_DIY_SELECTION",
        playerId: actor.id,
        componentCardInstanceIds: ["element_c_01", "element_o_01", "element_o_02"],
      });

      expect(nextState).toBe(state);
    });
  });

  describe("H. Legacy equivalence: START_ACTIVE_DIY vs PLAY_DIY_SELECTION", () => {
    it("produces identical results for all 8 recipes", () => {
      const recipesToTest = [
        {
          recipeId: "diy_co2_from_c_o_o",
          setup: (s: GameState, actorId: PlayerId) => {
            let next = addStatusForTest(s, actorId, "FIRE");
            next = putCardInHand(next, actorId, "element_c_01");
            next = putCardInHand(next, actorId, "element_o_01");
            return putCardInHand(next, actorId, "element_o_02");
          },
          components: ["element_c_01", "element_o_01", "element_o_02"],
          needsTarget: false,
        },
        {
          recipeId: "diy_h2o_from_h_oh",
          setup: (s: GameState, actorId: PlayerId) => {
            let next = addStatusForTest(s, actorId, "FIRE");
            next = putCardInHand(next, actorId, "ion_h_01");
            return putCardInHand(next, actorId, "ion_oh_01");
          },
          components: ["ion_h_01", "ion_oh_01"],
          needsTarget: false,
        },
        {
          recipeId: "diy_hcl_from_h_cl",
          setup: (s: GameState, actorId: PlayerId) => {
            let next = putCardInHand(s, actorId, "ion_h_01");
            return putCardInHand(next, actorId, "ion_cl_01");
          },
          components: ["ion_h_01", "ion_cl_01"],
          needsTarget: true,
        },
        {
          recipeId: "diy_h2so4_from_2h_so4",
          setup: (s: GameState, actorId: PlayerId) => {
            let next = putCardInHand(s, actorId, "ion_h_01");
            next = putCardInHand(next, actorId, "ion_h_02");
            return putCardInHand(next, actorId, "ion_so4_01");
          },
          components: ["ion_h_01", "ion_h_02", "ion_so4_01"],
          needsTarget: true,
        },
        {
          recipeId: "diy_naoh_from_na_oh",
          setup: (s: GameState, actorId: PlayerId) => {
            let next = putCardInHand(s, actorId, "ion_na_01");
            return putCardInHand(next, actorId, "ion_oh_01");
          },
          components: ["ion_na_01", "ion_oh_01"],
          needsTarget: true,
        },
        {
          recipeId: "diy_koh_from_k_oh",
          setup: (s: GameState, actorId: PlayerId) => {
            let next = putCardInHand(s, actorId, "ion_k_01");
            return putCardInHand(next, actorId, "ion_oh_01");
          },
          components: ["ion_k_01", "ion_oh_01"],
          needsTarget: true,
        },
        {
          recipeId: "diy_limewater_from_ca_2oh",
          setup: (s: GameState, actorId: PlayerId) => {
            let next = putCardInHand(s, actorId, "ion_ca_01");
            next = putCardInHand(next, actorId, "ion_oh_01");
            return putCardInHand(next, actorId, "ion_oh_02");
          },
          components: ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
          needsTarget: true,
        },
        {
          recipeId: "diy_so2_from_s_o_o",
          setup: (s: GameState, actorId: PlayerId) => {
            let next = putCardInHand(s, actorId, "element_s_01");
            next = putCardInHand(next, actorId, "element_o_01");
            return putCardInHand(next, actorId, "element_o_02");
          },
          components: ["element_s_01", "element_o_01", "element_o_02"],
          needsTarget: true,
        },
      ];

      for (const config of recipesToTest) {
        const base = createMvp0TestGame({ shuffle: identityShuffle });
        const [actor, opponent] = base.players;
        const state = config.setup(base, actor.id);
        const targetPlayerId = config.needsTarget ? opponent.id : undefined;

        const stateFromLegacy = engineReducer(state, {
          type: "START_ACTIVE_DIY",
          playerId: actor.id,
          recipeId: config.recipeId,
          componentCardInstanceIds: config.components,
          targetPlayerId,
        });

        const stateFromNew = engineReducer(state, {
          type: "PLAY_DIY_SELECTION",
          playerId: actor.id,
          componentCardInstanceIds: config.components,
          targetPlayerId,
        });

        expect(stateFromLegacy).toEqual(stateFromNew);
        expectCardZonesToBeConsistent(stateFromLegacy);
        expectCardZonesToBeConsistent(stateFromNew);
      }
    });

    it("rejects START_ACTIVE_DIY when recipeId does not match the analyzed selection", () => {
      let state = createMvp0TestGame({ shuffle: identityShuffle });
      const [actor, opponent] = state.players;
      state = putCardInHand(state, actor.id, "ion_h_01");
      state = putCardInHand(state, actor.id, "ion_cl_01");

      // Components form HCl, but recipeId claims NaOH
      const nextState = engineReducer(state, {
        type: "START_ACTIVE_DIY",
        playerId: actor.id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
        targetPlayerId: opponent.id,
      });

      expect(nextState).toBe(state);
    });
  });
});
