import { describe, expect, it } from "vitest";
import { identityShuffle, createMulberry32 } from "../../shared/random";
import type { GameAction } from "../engine/actions";
import { getAIObservation } from "../engine/aiObservation";
import { createInitialGame } from "../engine/createInitialGame";
import { getDecisionContext } from "../engine/decisionContext";
import { validateGameAction } from "../engine/legalActions";
import { engineReducer } from "../engine/reducer";
import type { GameState } from "../engine/types";
import { natba0RandomLegalPolicy } from "../natba/natba0Policy";

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
    characterIds: ["caustic_soda_captain", "acid_king"],
    shuffle: identityShuffle,
  });
  return confirmPreparation(state);
}

describe("Phase 19C — NATBA-0 Random Legal Policy", () => {
  it("returns undefined when decision context is none or game-over", () => {
    const dummyState = createReadyMainGameState();
    const observation = getAIObservation(dummyState, "player_1");

    expect(
      natba0RandomLegalPolicy(observation, { kind: "none" }, Math.random),
    ).toBeUndefined();
    expect(
      natba0RandomLegalPolicy(
        observation,
        { kind: "game-over", winnerPlayerId: "player_1" },
        Math.random,
      ),
    ).toBeUndefined();
  });

  it("selects a strictly legal action from finite-actions decision context in mainAction", () => {
    const state = createReadyMainGameState();
    const context = getDecisionContext(state);
    expect(context.kind).toBe("finite-actions");
    if (context.kind !== "finite-actions") return;

    const observation = getAIObservation(state, context.playerId);
    const prng = createMulberry32(12345);

    // Call policy 50 times with PRNG and verify every chosen action is in legalActions and validated by engine
    for (let i = 0; i < 50; i += 1) {
      const action = natba0RandomLegalPolicy(observation, context, prng);
      expect(action).toBeDefined();
      if (!action) return;

      expect(context.legalActions).toContainEqual(action);
      expect(validateGameAction(state, action)).toBe(true);
      expect(action.type).not.toBe("START_ACTIVE_DIY");
      expect(context.legalActions.some((legal) => legal.type === "START_ACTIVE_DIY")).toBe(
        false,
      );
    }
  });

  it("selects exactly 10 distinct candidate cards in laboratory-preparation context", () => {
    const state = createInitialGame({
      gameId: "test_prep",
      characterIds: ["laboratory_teacher", "chemical_factory_ceo"],
      shuffle: identityShuffle,
    });
    const context = getDecisionContext(state);
    expect(context.kind).toBe("laboratory-preparation");
    if (context.kind !== "laboratory-preparation") return;

    const observation = getAIObservation(state, context.playerId);
    const prng = createMulberry32(67890);

    for (let i = 0; i < 20; i += 1) {
      const action = natba0RandomLegalPolicy(observation, context, prng);
      expect(action).toBeDefined();
      if (!action) return;

      expect(action.type).toBe("CONFIRM_LABORATORY_PREPARATION");
      if (action.type !== "CONFIRM_LABORATORY_PREPARATION") return;

      expect(action.playerId).toBe(context.playerId);
      expect(action.keptCardInstanceIds).toHaveLength(10);
      const uniqueKept = new Set(action.keptCardInstanceIds);
      expect(uniqueKept.size).toBe(10);
      for (const cardId of action.keptCardInstanceIds) {
        expect(context.candidateCardInstanceIds).toContain(cardId);
      }
      expect(validateGameAction(state, action)).toBe(true);
    }
  });

  it("selects a legal response in responseWindow", () => {
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

    // p1 attacks p2 with HCl to create formal responseWindow
    const responseState = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: p1.id,
      cardInstanceId: hclCardId,
      targetPlayerId: p2.id,
    });

    expect(responseState.phase).toBe("responseWindow");
    const context = getDecisionContext(responseState);
    expect(context.kind).toBe("finite-actions");
    if (context.kind !== "finite-actions") return;

    const observation = getAIObservation(responseState, p2.id);
    const prng = createMulberry32(445566);

    for (let i = 0; i < 20; i += 1) {
      const action = natba0RandomLegalPolicy(observation, context, prng);
      expect(action).toBeDefined();
      if (!action) return;

      expect(context.legalActions).toContainEqual(action);
      expect(validateGameAction(responseState, action)).toBe(true);
      expect(
        action.type === "RESPOND_WITH_CARD" || action.type === "PASS_RESPONSE",
      ).toBe(true);
    }
  });

  it("selects a legal status handling in statusWindow", () => {
    let state = createReadyMainGameState();
    const p1 = state.players[0];
    const fireStatus = {
      id: "status_fire_01",
      statusId: "FIRE" as const,
      sourcePlayerId: p1.id,
      createdAt: 1,
    };

    const statusState: GameState = {
      ...state,
      phase: "statusWindow",
      activePlayerId: p1.id,
      players: [{ ...p1, statuses: [fireStatus] }, state.players[1]],
      pendingStatusHandling: {
        playerId: p1.id,
        statusInstanceId: fireStatus.id,
      },
    };

    const context = getDecisionContext(statusState);
    expect(context.kind).toBe("finite-actions");
    if (context.kind !== "finite-actions") return;

    const observation = getAIObservation(statusState, p1.id);
    const prng = createMulberry32(778899);

    for (let i = 0; i < 20; i += 1) {
      const action = natba0RandomLegalPolicy(observation, context, prng);
      expect(action).toBeDefined();
      if (!action) return;

      expect(context.legalActions).toContainEqual(action);
      expect(validateGameAction(statusState, action)).toBe(true);
      expect(
        action.type === "HANDLE_STATUS_WITH_CARD" ||
          action.type === "PASS_STATUS_HANDLING",
      ).toBe(true);
    }
  });

  it("selects a legal counterattack in experimentCounterattackWindow and never generates metal-counterattack", () => {
    let state = createReadyMainGameState();
    const responder = {
      ...state.players[0],
      characterId: "chemistry_enthusiast" as const,
      hp: 10,
      maxHp: 15,
    };
    const attacker = state.players[1];

    const counterState: GameState = {
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

    const context = getDecisionContext(counterState);
    expect(context.kind).toBe("finite-actions");
    if (context.kind !== "finite-actions") return;

    const observation = getAIObservation(counterState, responder.id);
    const prng = createMulberry32(990011);

    for (let i = 0; i < 20; i += 1) {
      const action = natba0RandomLegalPolicy(observation, context, prng);
      expect(action).toBeDefined();
      if (!action) return;

      expect(context.legalActions).toContainEqual(action);
      expect(validateGameAction(counterState, action)).toBe(true);
      expect(action.type).toBe("RESOLVE_EXPERIMENT_COUNTERATTACK");
      if (action.type === "RESOLVE_EXPERIMENT_COUNTERATTACK") {
        expect((action as any).option).not.toBe("metal-counterattack");
      }
    }
  });

  it("produces deterministic decision sequences given the same PRNG seed", () => {
    const state = createReadyMainGameState();
    const context = getDecisionContext(state);
    const observation = getAIObservation(state, "player_1");

    const runA = () => {
      const prng = createMulberry32(424242);
      const actions: (GameAction | undefined)[] = [];
      for (let i = 0; i < 10; i += 1) {
        actions.push(natba0RandomLegalPolicy(observation, context, prng));
      }
      return actions;
    };

    const actions1 = runA();
    const actions2 = runA();

    expect(actions1).toEqual(actions2);
  });
});
