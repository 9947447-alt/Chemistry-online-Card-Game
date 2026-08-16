import { describe, expect, it } from "vitest";
import { identityShuffle } from "../../shared/random";
import { createInitialGame } from "../engine/createInitialGame";
import {
  getAuthoritativeDecisionMaker,
  getDecisionContext,
} from "../engine/decisionContext";
import { engineReducer } from "../engine/reducer";
import { validateGameAction } from "../engine/legalActions";
import type {
  CardInstanceId,
  GameState,
  PlayerId,
} from "../engine/types";

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
    characterIds: ["clumsy_party_secretary", "acid_king"],
    shuffle: identityShuffle,
  });
  return confirmPreparation(state);
}

describe("Phase 19A — DecisionContext & Authoritative Decision Layer", () => {
  describe("Decision maker authority derivation", () => {
    it("identifies authoritative preparing player in preparationSelection", () => {
      const state = createInitialGame({
        characterIds: ["laboratory_teacher", "acid_king"],
        shuffle: identityShuffle,
      });

      expect(state.phase).toBe("preparationSelection");
      expect(state.pendingLaboratoryPreparation).toBeDefined();

      const decisionMakerId = getAuthoritativeDecisionMaker(state);
      expect(decisionMakerId).toBe(state.players[0].id);

      const context = getDecisionContext(state);
      expect(context.kind).toBe("laboratory-preparation");
      if (context.kind === "laboratory-preparation") {
        expect(context.phase).toBe("preparationSelection");
        expect(context.playerId).toBe(state.players[0].id);
        expect(context.candidateCardInstanceIds).toHaveLength(20);
        expect(context.keepCount).toBe(10);
      }
    });

    it("identifies authoritative active player in mainAction", () => {
      const state = createReadyMainGameState();
      expect(state.phase).toBe("mainAction");

      const decisionMakerId = getAuthoritativeDecisionMaker(state);
      expect(decisionMakerId).toBe(state.activePlayerId);

      const context = getDecisionContext(state);
      expect(context.kind).toBe("finite-actions");
      if (context.kind === "finite-actions") {
        expect(context.phase).toBe("mainAction");
        expect(context.playerId).toBe(state.activePlayerId);
        expect(context.legalActions.length).toBeGreaterThan(0);
        // Guaranteed pass action for alive active player
        expect(
          context.legalActions.some((a) => a.type === "PASS_ACTION"),
        ).toBe(true);
      }
    });

    it("identifies authoritative responder in responseWindow", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const hclCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_hcl_dilute",
      )!;
      const naohCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_naoh_dilute",
      )!;

      state = {
        ...state,
        tableReference: undefined,
        cardInstances: {
          ...state.cardInstances,
          [hclCardId]: {
            ...state.cardInstances[hclCardId],
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
          [naohCardId]: {
            ...state.cardInstances[naohCardId],
            ownerId: p2.id,
            zone: { type: "hand", playerId: p2.id },
          },
        },
        players: [
          { ...p1, hand: [hclCardId] },
          { ...p2, hand: [naohCardId] },
        ],
      };

      // p1 attacks p2 with HCl
      state = engineReducer(state, {
        type: "PLAY_CARD",
        playerId: p1.id,
        cardInstanceId: hclCardId,
        targetPlayerId: p2.id,
      });

      expect(state.phase).toBe("responseWindow");
      expect(state.pendingResponse?.responderId).toBe(p2.id);

      const decisionMakerId = getAuthoritativeDecisionMaker(state);
      expect(decisionMakerId).toBe(p2.id);

      const context = getDecisionContext(state);
      expect(context.kind).toBe("finite-actions");
      if (context.kind === "finite-actions") {
        expect(context.phase).toBe("responseWindow");
        expect(context.playerId).toBe(p2.id);
        expect(
          context.legalActions.some(
            (a) => a.type === "RESPOND_WITH_CARD" && a.cardInstanceId === naohCardId,
          ),
        ).toBe(true);
        expect(
          context.legalActions.some((a) => a.type === "PASS_RESPONSE"),
        ).toBe(true);
      }
    });

    it("identifies authoritative status handler in statusWindow", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];
      const fireStatus = {
        id: "status_fire_01",
        statusId: "FIRE" as const,
        sourcePlayerId: p1.id,
        createdAt: 1,
      };

      state = {
        ...state,
        phase: "statusWindow",
        activePlayerId: p1.id,
        players: [{ ...p1, statuses: [fireStatus] }, state.players[1]],
        pendingStatusHandling: {
          playerId: p1.id,
          statusInstanceId: fireStatus.id,
        },
      };

      const decisionMakerId = getAuthoritativeDecisionMaker(state);
      expect(decisionMakerId).toBe(p1.id);

      const context = getDecisionContext(state);
      expect(context.kind).toBe("finite-actions");
      if (context.kind === "finite-actions") {
        expect(context.phase).toBe("statusWindow");
        expect(context.playerId).toBe(p1.id);
        expect(
          context.legalActions.some(
            (a) =>
              a.type === "PASS_STATUS_HANDLING" &&
              a.statusInstanceId === fireStatus.id,
          ),
        ).toBe(true);
      }
    });

    it("identifies authoritative counterattacker in experimentCounterattackWindow", () => {
      let state = createReadyMainGameState();
      const responder = {
        ...state.players[0],
        characterId: "chemistry_enthusiast" as const,
        hp: 10,
        maxHp: 15,
      };
      const attacker = state.players[1];

      state = {
        ...state,
        phase: "experimentCounterattackWindow",
        players: [responder, attacker],
        pendingExperimentCounterattack: {
          responderPlayerId: responder.id,
          attackerPlayerId: attacker.id,
          originalDamageContext: {
            targetPlayerId: responder.id,
            baseAmount: 1,
            source: {
              kind: "card",
              sourcePlayerId: attacker.id,
              cardInstanceId: "card_attack_01",
              cardDefinitionId: "substance_hcl_dilute",
            },
            tags: ["acid"],
            responsePolicy: "acid-base",
          },
          responseType: "acid-base",
          legalOptions: ["recover"],
          legalMetalCardInstanceIds: [],
          legalPursuitCardInstanceIds: [],
          continuation: { kind: "single-response" },
        },
      };

      const decisionMakerId = getAuthoritativeDecisionMaker(state);
      expect(decisionMakerId).toBe(responder.id);

      const context = getDecisionContext(state);
      expect(context.kind).toBe("finite-actions");
      if (context.kind === "finite-actions") {
        expect(context.phase).toBe("experimentCounterattackWindow");
        expect(context.playerId).toBe(responder.id);
        expect(context.legalActions).toEqual([
          {
            type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
            playerId: responder.id,
            option: "recover",
          },
        ]);
      }
    });

    it("returns game-over context with outcome on terminal state", () => {
      let state = createReadyMainGameState();
      state = {
        ...state,
        phase: "gameOver",
        winnerPlayerId: state.players[0].id,
        isDraw: false,
      };

      const decisionMakerId = getAuthoritativeDecisionMaker(state);
      expect(decisionMakerId).toBeUndefined();

      const context = getDecisionContext(state);
      expect(context).toEqual({
        kind: "game-over",
        winnerPlayerId: state.players[0].id,
        isDraw: false,
      });
    });
  });

  describe("Non-decision phases and fail-closed safety", () => {
    it("returns none for setup phase", () => {
      const state: GameState = {
        ...createReadyMainGameState(),
        phase: "setup",
      };
      expect(getDecisionContext(state)).toEqual({ kind: "none" });
      expect(getAuthoritativeDecisionMaker(state)).toBeUndefined();
    });

    it("returns none for cycleStart phase", () => {
      const state: GameState = {
        ...createReadyMainGameState(),
        phase: "cycleStart",
      };
      expect(getDecisionContext(state)).toEqual({ kind: "none" });
      expect(getAuthoritativeDecisionMaker(state)).toBeUndefined();
    });

    it("returns none for actionStart phase", () => {
      const state: GameState = {
        ...createReadyMainGameState(),
        phase: "actionStart",
      };
      expect(getDecisionContext(state)).toEqual({ kind: "none" });
      expect(getAuthoritativeDecisionMaker(state)).toBeUndefined();
    });

    it("returns none for cleanup phase", () => {
      const state: GameState = {
        ...createReadyMainGameState(),
        phase: "cleanup",
      };
      expect(getDecisionContext(state)).toEqual({ kind: "none" });
      expect(getAuthoritativeDecisionMaker(state)).toBeUndefined();
    });

    it("fails closed on malformed preparation state", () => {
      const state: GameState = {
        ...createReadyMainGameState(),
        phase: "preparationSelection",
        pendingLaboratoryPreparation: undefined,
      };
      expect(getDecisionContext(state)).toEqual({ kind: "none" });
    });

    it("fails closed on malformed statusWindow state with non-existent statusInstanceId", () => {
      const p1 = createReadyMainGameState().players[0];
      const state: GameState = {
        ...createReadyMainGameState(),
        phase: "statusWindow",
        activePlayerId: p1.id,
        players: [{ ...p1, statuses: [] }, createReadyMainGameState().players[1]],
        pendingStatusHandling: {
          playerId: p1.id,
          statusInstanceId: "non_existent_status_id",
        },
      };
      expect(getAuthoritativeDecisionMaker(state)).toBeUndefined();
      expect(getDecisionContext(state)).toEqual({ kind: "none" });
    });

    it("fails closed on malformed experimentCounterattackWindow state with broken attacker snapshot", () => {
      const responder = {
        ...createReadyMainGameState().players[0],
        characterId: "chemistry_enthusiast" as const,
      };
      const state: GameState = {
        ...createReadyMainGameState(),
        phase: "experimentCounterattackWindow",
        players: [responder, createReadyMainGameState().players[1]],
        pendingExperimentCounterattack: {
          responderPlayerId: responder.id,
          attackerPlayerId: "missing_attacker_id",
          originalDamageContext: {
            targetPlayerId: responder.id,
            baseAmount: 1,
            source: {
              kind: "card",
              sourcePlayerId: "missing_attacker_id",
              cardInstanceId: "card_attack_01",
              cardDefinitionId: "substance_hcl_dilute",
            },
            tags: ["acid"],
            responsePolicy: "acid-base",
          },
          responseType: "acid-base",
          legalOptions: ["recover"],
          legalMetalCardInstanceIds: [],
          legalPursuitCardInstanceIds: [],
          continuation: { kind: "single-response" },
        },
      };
      expect(getAuthoritativeDecisionMaker(state)).toBeUndefined();
      expect(getDecisionContext(state)).toEqual({ kind: "none" });
    });

    it("fails closed on malformed responseWindow state with missing target", () => {
      const p1 = createReadyMainGameState().players[0];
      const p2 = createReadyMainGameState().players[1];
      const state: GameState = {
        ...createReadyMainGameState(),
        phase: "responseWindow",
        players: [p1, { ...p2, eliminated: true }],
        pendingResponse: {
          responderId: p1.id,
          chainDepth: 1,
          effectsAfterPass: [],
          sourceEffect: {
            type: "DAMAGE",
            context: {
              targetPlayerId: p2.id,
              baseAmount: 1,
              source: {
                kind: "card",
                sourcePlayerId: p1.id,
                cardInstanceId: "card_1",
                cardDefinitionId: "substance_hcl_dilute",
              },
              tags: ["acid"],
              responsePolicy: "acid-base",
            },
          },
        },
      };
      expect(getAuthoritativeDecisionMaker(state)).toBeUndefined();
      expect(getDecisionContext(state)).toEqual({ kind: "none" });
    });
  });

  describe("Deterministic output and action consistency", () => {
    it("produces identical and stable DecisionContext on repeated queries", () => {
      const state = createReadyMainGameState();
      const first = getDecisionContext(state);
      const second = getDecisionContext(state);
      expect(first).toEqual(second);
    });

    it("guarantees every generated finite action is accepted by engineReducer", () => {
      const state = createReadyMainGameState();
      const context = getDecisionContext(state);
      expect(context.kind).toBe("finite-actions");

      if (context.kind === "finite-actions") {
        for (const action of context.legalActions) {
          // Assert that validator agrees
          expect(validateGameAction(state, action)).toBe(true);

          // Assert reducer does not return the exact same unmodified state reference
          const nextState = engineReducer(state, action);
          expect(nextState).not.toBe(state);
        }
      }
    });
  });
});
