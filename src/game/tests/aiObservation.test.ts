import { describe, expect, it } from "vitest";
import { cardDefinitions } from "../data/cardDefinitions";
import { identityShuffle } from "../../shared/random";
import { createInitialGame } from "../engine/createInitialGame";
import { getAIObservation } from "../engine/aiObservation";
import { engineReducer } from "../engine/reducer";
import type { CardInstanceId, GameState, PlayerId } from "../engine/types";

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

function putCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState {
  const card = state.cardInstances[cardInstanceId];
  if (!card) {
    throw new Error(`Missing card ${cardInstanceId}`);
  }
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand: player.id === playerId
        ? [...player.hand.filter((id) => id !== cardInstanceId), cardInstanceId]
        : player.hand.filter((id) => id !== cardInstanceId),
    })),
    deck: state.deck.filter((id) => id !== cardInstanceId),
    discardPile: state.discardPile.filter((id) => id !== cardInstanceId),
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

    it("exposes discard pile with card IDs and fully public definitions", () => {
      let state = createReadyMainGameState();
      const hclCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_hcl_dilute",
      )!;

      state = {
        ...state,
        discardPile: [hclCardId],
      };

      const obs = getAIObservation(state, state.players[0].id);
      expect(obs.discardPile).toEqual([hclCardId]);
      expect(obs.discardPileCards).toHaveLength(1);
      expect(obs.discardPileCards[0].cardInstanceId).toBe(hclCardId);
      expect(obs.discardPileCards[0].definition.id).toBe("substance_hcl_dilute");
      expect(obs.discardPileCards[0].definition.tags).toContain("acid");

      // Verify that full state.cardInstances is NOT attached to the observation
      expect((obs as any).cardInstances).toBeUndefined();
    });
  });

  describe("Deep Mutation Isolation", () => {
    it("guarantees that mutating observation CardDefinition arrays does not pollute global static card definitions", () => {
      const state = createReadyMainGameState();
      const obs = getAIObservation(state, state.players[0].id);
      const firstHandCard = obs.self.handCards[0];
      const globalDef = cardDefinitions.find((d) => d.id === firstHandCard.id)!;

      const originalGlobalTags = [...globalDef.tags];
      const originalGlobalTimings = [...globalDef.allowedTimings];
      const originalGlobalElements = globalDef.elements ? [...globalDef.elements] : undefined;

      // Aggressively mutate array fields in observation
      (firstHandCard.tags as string[]).push("polluted_tag");
      (firstHandCard.allowedTimings as string[]).push("polluted_timing" as any);
      if (firstHandCard.elements) {
        (firstHandCard.elements as string[]).push("X");
      }

      // Assert global card definitions remain completely unpolluted
      expect(globalDef.tags).toEqual(originalGlobalTags);
      expect(globalDef.allowedTimings).toEqual(originalGlobalTimings);
      if (globalDef.elements) {
        expect(globalDef.elements).toEqual(originalGlobalElements);
      }
    });

    it("guarantees that mutating observation reaction logs does not alter GameState log reaction data", () => {
      let state = createReadyMainGameState();
      const [p1, p2] = state.players;

      const hclCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_hcl_dilute",
      )!;
      const naohCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_naoh_dilute",
      )!;

      state = putCardInHand(state, p1.id, hclCardId);
      state = putCardInHand(state, p2.id, naohCardId);

      // p1 attacks with HCl
      state = engineReducer(state, {
        type: "PLAY_CARD",
        playerId: p1.id,
        cardInstanceId: hclCardId,
        targetPlayerId: p2.id,
      });

      // p2 responds with NaOH -> produces reaction in log
      state = engineReducer(state, {
        type: "RESPOND_WITH_CARD",
        playerId: p2.id,
        cardInstanceId: naohCardId,
      });

      const reactionEntry = state.log.find((entry) => entry.eventKey === "reaction");
      expect(reactionEntry?.reaction).toBeDefined();

      const originalReactionParticipants = [...reactionEntry!.reaction!.participants];

      const obs = getAIObservation(state, p1.id);
      const obsReaction = obs.log.find((entry) => entry.eventKey === "reaction")?.reaction!;
      expect(obsReaction).toBeDefined();

      // Mutate reaction fields in observation
      (obsReaction.participants as any).push({ role: "fake", displayName: "Fake" });
      (obsReaction as any).outcome = { fake: true };

      // Verify GameState log reaction is untouched
      expect(reactionEntry!.reaction!.participants).toEqual(originalReactionParticipants);
      expect(reactionEntry!.reaction!.outcome).not.toEqual({ fake: true });
    });

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
