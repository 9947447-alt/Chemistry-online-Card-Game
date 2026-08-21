import { describe, expect, it } from "vitest";
import { identityShuffle } from "../../shared/random";
import { createInitialGame } from "../engine/createInitialGame";
import {
  getLegalActions,
  validateGameAction,
  validateHandleStatusWithCardAction,
  validatePassAction,
  validatePassResponseAction,
  validatePassStatusHandlingAction,
  validatePlayCardAction,
  validatePlayDiySelectionAction,
  validatePlayReferenceCardAction,
  validateRespondWithCardAction,
} from "../engine/legalActions";
import { engineReducer } from "../engine/reducer";
import type { GameState, PlayerId } from "../engine/types";

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

function createReadyMainGameState(characters?: [string, string]): GameState {
  const state = createInitialGame({
    characterIds: (characters as any) ?? ["clumsy_party_secretary", "acid_king"],
    shuffle: identityShuffle,
  });
  return confirmPreparation(state);
}

describe("Phase 19A — LegalActions & Legality Validation", () => {
  describe("Single Authority Alignment (Validators & Executors)", () => {
    it("aligns PLAY_CARD validator and executor on valid and invalid payloads", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const hclCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_hcl_dilute",
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
        },
        players: [{ ...p1, hand: [hclCardId] }, p2],
      };

      // Valid attack payload -> validator true -> executor transforms state
      const validAction = {
        type: "PLAY_CARD" as const,
        playerId: p1.id,
        cardInstanceId: hclCardId,
        targetPlayerId: p2.id,
      };
      expect(validateGameAction(state, validAction)).toBe(true);
      const afterPlay = engineReducer(state, validAction);
      expect(afterPlay).not.toBe(state);
      expect(afterPlay.phase).toBe("responseWindow");

      // Invalid self-target payload -> validator false -> executor rejects (returns state)
      const invalidAction = {
        type: "PLAY_CARD" as const,
        playerId: p1.id,
        cardInstanceId: hclCardId,
        targetPlayerId: p1.id,
      };
      expect(validateGameAction(state, invalidAction)).toBe(false);
      expect(engineReducer(state, invalidAction)).toBe(state);
    });

    it("aligns PLAY_REFERENCE_CARD validator and executor on valid and unassociated payloads", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];

      const h2oCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_h2o",
      )!;

      state = {
        ...state,
        tableReference: undefined,
        cardInstances: {
          ...state.cardInstances,
          [h2oCardId]: {
            ...state.cardInstances[h2oCardId],
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
        },
        players: [{ ...p1, hand: [h2oCardId] }, state.players[1]],
      };

      // Valid reference play -> validator true -> executor transforms state
      const validAction = {
        type: "PLAY_REFERENCE_CARD" as const,
        playerId: p1.id,
        cardInstanceId: h2oCardId,
      };
      expect(validateGameAction(state, validAction)).toBe(true);
      const afterPlay = engineReducer(state, validAction);
      expect(afterPlay).not.toBe(state);
      expect(afterPlay.tableReference?.cardInstanceId).toBe(h2oCardId);

      // Card not in hand -> validator false -> executor rejects
      const invalidAction = {
        type: "PLAY_REFERENCE_CARD" as const,
        playerId: p1.id,
        cardInstanceId: "card_not_in_hand",
      };
      expect(validateGameAction(state, invalidAction)).toBe(false);
      expect(engineReducer(state, invalidAction)).toBe(state);
    });

    it("rejects injected event instance as a reference card", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];
      const eventCardInstanceId = "event_lab_fire_injected";
      state = {
        ...state,
        tableReference: undefined,
        cardInstances: {
          ...state.cardInstances,
          [eventCardInstanceId]: {
            id: eventCardInstanceId,
            definitionId: "event_lab_fire",
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
        },
        players: [{ ...p1, hand: [eventCardInstanceId] }, state.players[1]],
      };
      const action = {
        type: "PLAY_REFERENCE_CARD" as const,
        playerId: p1.id,
        cardInstanceId: eventCardInstanceId,
      };

      expect(validateGameAction(state, action)).toBe(false);
      expect(
        getLegalActions(state, p1.id).some(
          (candidate) =>
            candidate.type === "PLAY_REFERENCE_CARD" &&
            candidate.cardInstanceId === eventCardInstanceId,
        ),
      ).toBe(false);
      expect(engineReducer(state, action)).toBe(state);
    });

    it("aligns RESPOND_WITH_CARD and PASS_RESPONSE validator and executor", () => {
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

      // p1 attacks p2 with HCl -> transitions to responseWindow
      state = engineReducer(state, {
        type: "PLAY_CARD",
        playerId: p1.id,
        cardInstanceId: hclCardId,
        targetPlayerId: p2.id,
      });

      expect(state.phase).toBe("responseWindow");

      // Valid response -> validator true -> executor transforms
      const validResponse = {
        type: "RESPOND_WITH_CARD" as const,
        playerId: p2.id,
        cardInstanceId: naohCardId,
      };
      expect(validateGameAction(state, validResponse)).toBe(true);
      expect(engineReducer(state, validResponse)).not.toBe(state);

      // Invalid responder -> validator false -> executor rejects
      const invalidResponder = {
        type: "RESPOND_WITH_CARD" as const,
        playerId: p1.id,
        cardInstanceId: naohCardId,
      };
      expect(validateGameAction(state, invalidResponder)).toBe(false);
      expect(engineReducer(state, invalidResponder)).toBe(state);

      // Valid pass response -> validator true -> executor transforms
      const passAction = {
        type: "PASS_RESPONSE" as const,
        playerId: p2.id,
      };
      expect(validateGameAction(state, passAction)).toBe(true);
      expect(engineReducer(state, passAction)).not.toBe(state);
    });

    it("aligns HANDLE_STATUS_WITH_CARD and PASS_STATUS_HANDLING validator and executor", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];

      const fireStatus = {
        id: "status_fire_01",
        statusId: "FIRE" as const,
        sourcePlayerId: p1.id,
        createdAt: 1,
      };
      const h2oCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_h2o",
      )!;

      state = {
        ...state,
        phase: "statusWindow",
        activePlayerId: p1.id,
        cardInstances: {
          ...state.cardInstances,
          [h2oCardId]: {
            ...state.cardInstances[h2oCardId],
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
        },
        players: [{ ...p1, statuses: [fireStatus], hand: [h2oCardId] }, state.players[1]],
        pendingStatusHandling: {
          playerId: p1.id,
          statusInstanceId: fireStatus.id,
        },
      };

      // Valid handle -> validator true -> executor removes status
      const validHandle = {
        type: "HANDLE_STATUS_WITH_CARD" as const,
        playerId: p1.id,
        statusInstanceId: fireStatus.id,
        cardInstanceId: h2oCardId,
      };
      expect(validateGameAction(state, validHandle)).toBe(true);
      const afterHandle = engineReducer(state, validHandle);
      expect(afterHandle).not.toBe(state);
      expect(afterHandle.players[0].statuses).toHaveLength(0);

      // Invalid status ID -> validator false -> executor rejects
      const invalidHandle = {
        type: "HANDLE_STATUS_WITH_CARD" as const,
        playerId: p1.id,
        statusInstanceId: "wrong_status_id",
        cardInstanceId: h2oCardId,
      };
      expect(validateGameAction(state, invalidHandle)).toBe(false);
      expect(engineReducer(state, invalidHandle)).toBe(state);

      // Valid pass -> validator true -> executor applies status damage
      const validPass = {
        type: "PASS_STATUS_HANDLING" as const,
        playerId: p1.id,
        statusInstanceId: fireStatus.id,
      };
      expect(validateGameAction(state, validPass)).toBe(true);
      const afterPass = engineReducer(state, validPass);
      expect(afterPass).not.toBe(state);
      expect(afterPass.players[0].hp).toBe(p1.hp - 2);
    });
  });

  describe("Main Action Legal Space", () => {
    it("generates PASS_ACTION, PLAY_CARD, PLAY_REFERENCE_CARD, and ACTIVATE_CHARACTER_SKILL for active player", () => {
      const state = createReadyMainGameState(["clumsy_party_secretary", "acid_king"]);
      const activeId = state.activePlayerId;
      const actions = getLegalActions(state, activeId);

      // PASS_ACTION must be present
      expect(actions.some((a) => a.type === "PASS_ACTION" && a.playerId === activeId)).toBe(true);

      // Clumsy party secretary has active skills
      expect(
        actions.some(
          (a) =>
            a.type === "ACTIVATE_CHARACTER_SKILL" &&
            a.playerId === activeId &&
            a.skillId === "lab_fire",
        ),
      ).toBe(true);

      // Inactive player gets empty legal actions in mainAction
      const opponentId = state.players.find((p) => p.id !== activeId)!.id;
      expect(getLegalActions(state, opponentId)).toEqual([]);
    });

    it("excludes cards not adhering to table reference association", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];

      // Set table reference to something unrelated or specific
      state = {
        ...state,
        tableReference: {
          cardInstanceId: "ref_card_1",
          definitionId: "substance_h2o",
          displayName: "H2O",
          playedBy: state.players[1].id,
          cycle: 1,
          round: 1,
        },
      };

      const actions = getLegalActions(state, p1.id);
      const referenceActions = actions.filter((a) => a.type === "PLAY_REFERENCE_CARD");

      for (const refAction of referenceActions) {
        expect(validateGameAction(state, refAction)).toBe(true);
      }
    });

    it("properly validates and generates O2 recovery with self-target only when HP < maxHP", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];
      const o2CardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_o2",
      )!;

      // When at full HP: O2 cannot be played
      state = {
        ...state,
        tableReference: undefined,
        cardInstances: {
          ...state.cardInstances,
          [o2CardId]: {
            ...state.cardInstances[o2CardId],
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
        },
        players: [{ ...p1, hp: 15, maxHp: 15, hand: [o2CardId] }, state.players[1]],
      };
      expect(validatePlayCardAction(state, p1.id, o2CardId, p1.id)).toBe(false);
      expect(getLegalActions(state, p1.id).some((a) => a.type === "PLAY_CARD")).toBe(false);

      // When damaged (HP < maxHP): O2 can be played with self-target
      state = {
        ...state,
        players: [{ ...p1, hp: 10, maxHp: 15, hand: [o2CardId] }, state.players[1]],
      };
      expect(validatePlayCardAction(state, p1.id, o2CardId, p1.id)).toBe(true);
      expect(
        getLegalActions(state, p1.id).some(
          (a) =>
            a.type === "PLAY_CARD" &&
            a.cardInstanceId === o2CardId &&
            a.targetPlayerId === p1.id,
        ),
      ).toBe(true);
    });

    it("rejects O2 recovery without an explicit self target", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];
      const o2CardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_o2",
      )!;
      state = {
        ...state,
        tableReference: undefined,
        cardInstances: {
          ...state.cardInstances,
          [o2CardId]: {
            ...state.cardInstances[o2CardId],
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
        },
        players: [{ ...p1, hp: 10, maxHp: 15, hand: [o2CardId] }, state.players[1]],
      };
      const action = {
        type: "PLAY_CARD" as const,
        playerId: p1.id,
        cardInstanceId: o2CardId,
      };

      expect(validateGameAction(state, action)).toBe(false);
      expect(engineReducer(state, action)).toBe(state);
    });
  });

  describe("DIY Legal Action Generation & Exclusion of Legacy START_ACTIVE_DIY", () => {
    it("strictly rejects START_ACTIVE_DIY in validateGameAction and never generates it", () => {
      const state = createReadyMainGameState();
      const p1 = state.players[0];

      expect(
        validateGameAction(state, {
          type: "START_ACTIVE_DIY",
          playerId: p1.id,
          recipeId: "diy_neutralize_water",
          componentCardInstanceIds: ["c1", "c2"],
        }),
      ).toBe(false);

      const actions = getLegalActions(state, p1.id);
      expect(actions.some((a: any) => a.type === "START_ACTIVE_DIY")).toBe(false);
    });

    it("generates PLAY_DIY_SELECTION when valid DIY components exist in hand", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const hCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "ion_h",
      )!;
      const clCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "ion_cl",
      )!;

      state = {
        ...state,
        tableReference: undefined,
        cardInstances: {
          ...state.cardInstances,
          [hCardId]: {
            ...state.cardInstances[hCardId],
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
          [clCardId]: {
            ...state.cardInstances[clCardId],
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
        },
        players: [{ ...p1, hand: [hCardId, clCardId] }, p2],
      };

      const actions = getLegalActions(state, p1.id);
      const diyActions = actions.filter((a) => a.type === "PLAY_DIY_SELECTION");

      for (const diyAction of diyActions) {
        expect(
          validatePlayDiySelectionAction(
            state,
            p1.id,
            diyAction.componentCardInstanceIds,
            diyAction.targetPlayerId,
          ),
        ).toBe(true);
      }
    });

    it("handles duplicate CardInstances with separate identity in DIY selection", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];

      const hCard1 = "card_test_h_1";
      const hCard2 = "card_test_h_2";
      const clCard = "card_test_cl_1";

      state = {
        ...state,
        cardInstances: {
          ...state.cardInstances,
          [hCard1]: {
            id: hCard1,
            definitionId: "ion_h",
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
          [hCard2]: {
            id: hCard2,
            definitionId: "ion_h",
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
          [clCard]: {
            id: clCard,
            definitionId: "ion_cl",
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
        },
        players: [
          { ...p1, hand: [hCard1, hCard2, clCard] },
          state.players[1],
        ],
      };

      const actions = getLegalActions(state, p1.id);
      const diyActions = actions.filter((a) => a.type === "PLAY_DIY_SELECTION");

      const hasH1 = diyActions.some(
        (a) =>
          a.componentCardInstanceIds.includes(hCard1) &&
          a.componentCardInstanceIds.includes(clCard),
      );
      const hasH2 = diyActions.some(
        (a) =>
          a.componentCardInstanceIds.includes(hCard2) &&
          a.componentCardInstanceIds.includes(clCard),
      );
      expect(hasH1).toBe(true);
      expect(hasH2).toBe(true);
    });
  });

  describe("Response Window & Multi-Target Response", () => {
    it("generates alkaline absorption responses in multi-target response sequence", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const naohCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_naoh_dilute",
      )!;

      state = {
        ...state,
        phase: "responseWindow",
        cardInstances: {
          ...state.cardInstances,
          [naohCardId]: {
            ...state.cardInstances[naohCardId],
            ownerId: p2.id,
            zone: { type: "hand", playerId: p2.id },
          },
        },
        players: [p1, { ...p2, hand: [naohCardId] }],
        pendingResponse: {
          responderId: p2.id,
          chainDepth: 1,
          effectsAfterPass: [],
          sourceEffect: {
            type: "DAMAGE",
            context: {
              targetPlayerId: p2.id,
              baseAmount: 1,
              source: {
                kind: "character-skill",
                sourcePlayerId: p1.id,
                skillId: "exhaust_leak",
              },
              tags: ["so2"],
              responsePolicy: "alkali-absorption",
            },
          },
          multiTargetSequence: {
            sourcePlayerId: p1.id,
            sourceSkillId: "exhaust_leak",
            targetPlayerIds: [p2.id],
            remainingTargetPlayerIds: [],
            completedResults: [],
            finishBehavior: "exhaust-leak",
          },
        },
      };

      const actions = getLegalActions(state, p2.id);
      expect(
        actions.some(
          (a) => a.type === "RESPOND_WITH_CARD" && a.cardInstanceId === naohCardId,
        ),
      ).toBe(true);
      expect(actions.some((a) => a.type === "PASS_RESPONSE")).toBe(true);
    });
  });

  describe("Status Window Legal Space", () => {
    it("binds exactly to current pending statusInstanceId and validates extinguish card", () => {
      let state = createReadyMainGameState();
      const p1 = state.players[0];

      const fireStatus = {
        id: "status_fire_99",
        statusId: "FIRE" as const,
        sourcePlayerId: p1.id,
        createdAt: 10,
      };

      const h2oCardId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_h2o",
      )!;

      state = {
        ...state,
        phase: "statusWindow",
        activePlayerId: p1.id,
        cardInstances: {
          ...state.cardInstances,
          [h2oCardId]: {
            ...state.cardInstances[h2oCardId],
            ownerId: p1.id,
            zone: { type: "hand", playerId: p1.id },
          },
        },
        players: [{ ...p1, statuses: [fireStatus], hand: [h2oCardId] }, state.players[1]],
        pendingStatusHandling: {
          playerId: p1.id,
          statusInstanceId: fireStatus.id,
        },
      };

      const actions = getLegalActions(state, p1.id);
      expect(
        actions.some(
          (a) =>
            a.type === "HANDLE_STATUS_WITH_CARD" &&
            a.statusInstanceId === fireStatus.id &&
            a.cardInstanceId === h2oCardId,
        ),
      ).toBe(true);
      expect(
        actions.some(
          (a) =>
            a.type === "PASS_STATUS_HANDLING" &&
            a.statusInstanceId === fireStatus.id,
        ),
      ).toBe(true);

      // Wrong statusInstanceId must be rejected
      expect(
        validateGameAction(state, {
          type: "HANDLE_STATUS_WITH_CARD",
          playerId: p1.id,
          statusInstanceId: "wrong_status_id",
          cardInstanceId: h2oCardId,
        }),
      ).toBe(false);
    });
  });

  describe("Experiment Counterattack Window", () => {
    it("never generates metal-counterattack and rejects it", () => {
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

      const actions = getLegalActions(state, responder.id);
      expect(actions.some((a: any) => a.option === "metal-counterattack")).toBe(false);

      expect(
        validateGameAction(state, {
          type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
          playerId: responder.id,
          option: "metal-counterattack",
          cardInstanceId: "metal_card_01",
        }),
      ).toBe(false);
    });

    it("does not generate acid-base pursuit for a pending card absent from responder hand", () => {
      let state = createReadyMainGameState();
      const responder = {
        ...state.players[0],
        characterId: "chemistry_enthusiast" as const,
        hp: 15,
        maxHp: 15,
        hand: [],
      };
      const attacker = state.players[1];
      const pursuitCardInstanceId = Object.keys(state.cardInstances).find(
        (id) => state.cardInstances[id].definitionId === "substance_hcl_dilute",
      )!;

      state = {
        ...state,
        phase: "experimentCounterattackWindow",
        players: [responder, attacker],
        cardInstances: {
          ...state.cardInstances,
          [pursuitCardInstanceId]: {
            ...state.cardInstances[pursuitCardInstanceId],
            ownerId: responder.id,
            zone: { type: "hand", playerId: responder.id },
          },
        },
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
          legalOptions: ["acid-base-pursuit"],
          legalMetalCardInstanceIds: [],
          legalPursuitCardInstanceIds: [pursuitCardInstanceId],
          continuation: { kind: "single-response" },
        },
      };

      expect(getLegalActions(state, responder.id)).toEqual([]);
    });
  });
});
