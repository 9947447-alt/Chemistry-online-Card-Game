import { describe, expect, it } from "vitest";
import { identityShuffle } from "../../shared/random";
import { createInitialGame } from "../engine/createInitialGame";
import { getAIObservation } from "../engine/aiObservation";
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

function createReadyMainGameState(): GameState {
  const state = createInitialGame({
    characterIds: ["laboratory_teacher", "acid_king"],
    shuffle: identityShuffle,
  });
  return confirmPreparation(state);
}

describe("Phase 19A — Fair AI Observation Projection", () => {
  describe("Information Visibility & Privacy Boundary", () => {
    it("exposes own hand with definitions and hides opponent hand contents", () => {
      const state = createReadyMainGameState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const obs1 = getAIObservation(state, p1.id);

      // Self information is complete
      expect(obs1.viewerPlayerId).toBe(p1.id);
      expect(obs1.self.playerId).toBe(p1.id);
      expect(obs1.self.characterId).toBe(p1.characterId);
      expect(obs1.self.hand).toEqual(p1.hand);
      expect(obs1.self.handCards.length).toBe(p1.hand.length);

      // Opponent information has only handCount
      expect(obs1.opponents.length).toBe(1);
      const opp = obs1.opponents[0];
      expect(opp.playerId).toBe(p2.id);
      expect(opp.characterId).toBe(p2.characterId);
      expect(opp.handCount).toBe(p2.hand.length);

      // Privacy verification: opponent hand array or card IDs/definitions are not present
      expect((opp as any).hand).toBeUndefined();
      expect((opp as any).handCards).toBeUndefined();
      expect((opp as any).cardInstances).toBeUndefined();
    });

    it("exposes deck count and strictly hides future deck ordering and card identities", () => {
      const state = createReadyMainGameState();
      const obs = getAIObservation(state, state.players[0].id);

      expect(obs.deckCount).toBe(state.deck.length);
      expect((obs as any).deck).toBeUndefined();
      expect((obs as any).cardInstances).toBeUndefined();
    });

    it("hides preparation candidate IDs from opponent while exposing them to preparing player", () => {
      const state = createInitialGame({
        characterIds: ["laboratory_teacher", "acid_king"],
        shuffle: identityShuffle,
      });

      expect(state.phase).toBe("preparationSelection");
      const teacherId = state.players[0].id;
      const acidKingId = state.players[1].id;

      // Teacher view
      const teacherObs = getAIObservation(state, teacherId);
      expect(teacherObs.pendingContext.kind).toBe("laboratoryPreparation");
      if (teacherObs.pendingContext.kind === "laboratoryPreparation") {
        expect(teacherObs.pendingContext.playerId).toBe(teacherId);
        expect(teacherObs.pendingContext.keepCount).toBe(10);
        expect(teacherObs.pendingContext.candidateCardInstanceIds).toHaveLength(20);
      }

      // Acid king view (opponent)
      const oppObs = getAIObservation(state, acidKingId);
      expect(oppObs.pendingContext.kind).toBe("laboratoryPreparation");
      if (oppObs.pendingContext.kind === "laboratoryPreparation") {
        expect(oppObs.pendingContext.playerId).toBe(teacherId);
        expect(oppObs.pendingContext.keepCount).toBe(10);
        expect(oppObs.pendingContext.candidateCardInstanceIds).toBeUndefined();
      }
    });
  });

  describe("Mutation Isolation", () => {
    it("guarantees that mutating observation arrays does not alter underlying GameState", () => {
      const state = createReadyMainGameState();
      const originalP1Hand = [...state.players[0].hand];
      const originalDiscardPile = [...state.discardPile];
      const originalLogLength = state.log.length;

      const obs = getAIObservation(state, state.players[0].id);

      // Mutate arrays in observation
      (obs.self.hand as string[]).push("fake_card_id");
      (obs.self.hand as string[]).sort();
      (obs.discardPile as string[]).push("fake_discard_id");
      (obs.log as any[]).pop();
      (obs.opponents as any[]).push({ playerId: "fake_opp" });

      // Assert GameState remains completely unchanged
      expect(state.players[0].hand).toEqual(originalP1Hand);
      expect(state.discardPile).toEqual(originalDiscardPile);
      expect(state.log.length).toBe(originalLogLength);
      expect(state.players.length).toBe(2);
    });

    it("guarantees that mutating observation statuses does not alter GameState statuses", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];
      state = {
        ...state,
        players: [
          {
            ...p1,
            statuses: [
              {
                id: "status_fire_1",
                statusId: "FIRE",
                sourcePlayerId: p1.id,
                createdAt: 1,
              },
            ],
          },
          state.players[1],
        ],
      };

      const obs = getAIObservation(state, p1.id);
      expect(obs.self.statuses.length).toBe(1);

      // Mutate status object in observation
      (obs.self.statuses[0] as any).statusId = "SO2_LEAK";
      (obs.self.statuses as any[]).push({ id: "status_2" });

      expect(state.players[0].statuses.length).toBe(1);
      expect(state.players[0].statuses[0].statusId).toBe("FIRE");
    });
  });
});
