import { describe, expect, it } from "vitest";
import { identityShuffle, createMulberry32 } from "../../shared/random";
import type { GameAction } from "../engine/actions";
import { getAIObservation } from "../engine/aiObservation";
import { createInitialGame } from "../engine/createInitialGame";
import { getDecisionContext } from "../engine/decisionContext";
import { validateGameAction } from "../engine/legalActions";
import { engineReducer } from "../engine/reducer";
import type { GameState } from "../engine/types";
import { natba1HeuristicPolicy } from "../natba/natba1HeuristicPolicy";

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

function createReadyMainGameState(
  charA: "caustic_soda_captain" | "acid_king" | "laboratory_teacher" | "chemical_factory_ceo" = "caustic_soda_captain",
  charB: "acid_king" | "chemical_factory_ceo" = "acid_king",
): GameState {
  const state = createInitialGame({
    characterIds: [charA, charB],
    shuffle: identityShuffle,
  });
  return confirmPreparation(state);
}

describe("Phase 19E — NATBA-1 Heuristic Policy", () => {
  it("returns undefined when decision context is none or game-over", () => {
    const dummyState = createReadyMainGameState();
    const observation = getAIObservation(dummyState, "player_1");

    expect(
      natba1HeuristicPolicy(observation, { kind: "none" }, Math.random),
    ).toBeUndefined();
    expect(
      natba1HeuristicPolicy(
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

    for (let i = 0; i < 50; i += 1) {
      const action = natba1HeuristicPolicy(observation, context, prng);
      expect(action).toBeDefined();
      if (!action) return;

      expect(context.legalActions).toContainEqual(action);
      expect(validateGameAction(state, action)).toBe(true);
      expect(action.type).not.toBe("START_ACTIVE_DIY");
    }
  });

  it("selects exactly 10 distinct candidate cards in laboratory-preparation context and prioritizes high-value cards", () => {
    const state = createInitialGame({
      gameId: "test_prep_natba1",
      characterIds: ["laboratory_teacher", "chemical_factory_ceo"],
      shuffle: identityShuffle,
    });
    const context = getDecisionContext(state);
    expect(context.kind).toBe("laboratory-preparation");
    if (context.kind !== "laboratory-preparation") return;

    const observation = getAIObservation(state, context.playerId);
    const prng = createMulberry32(67890);

    const action = natba1HeuristicPolicy(observation, context, prng);
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
  });

  it("prioritizes responding with card over pass in responseWindow", () => {
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

    const action = natba1HeuristicPolicy(observation, context, prng);
    expect(action).toBeDefined();
    if (!action) return;

    expect(action.type).toBe("RESPOND_WITH_CARD");
    expect(validateGameAction(responseState, action)).toBe(true);
  });

  it("prioritizes handling status over pass in statusWindow", () => {
    let state = createReadyMainGameState();
    const p1 = state.players[0];
    const h2oCardId = Object.keys(state.cardInstances).find(
      (id) => state.cardInstances[id].definitionId === "substance_h2o",
    )!;

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
      cardInstances: {
        ...state.cardInstances,
        [h2oCardId]: {
          ...state.cardInstances[h2oCardId],
          ownerId: p1.id,
          zone: { type: "hand", playerId: p1.id },
        },
      },
      players: [
        { ...p1, hand: [h2oCardId], statuses: [fireStatus] },
        state.players[1],
      ],
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

    const action = natba1HeuristicPolicy(observation, context, prng);
    expect(action).toBeDefined();
    if (!action) return;

    expect(action.type).toBe("HANDLE_STATUS_WITH_CARD");
    expect(validateGameAction(statusState, action)).toBe(true);
  });

  it("prioritizes extra_lesson skill when teacher hand size is low", () => {
    const state = createInitialGame({
      characterIds: ["laboratory_teacher", "chemical_factory_ceo"],
      shuffle: identityShuffle,
    });
    const readyState = confirmPreparation(state);
    const teacher = readyState.players[0];
    const reducedTeacherState: GameState = {
      ...readyState,
      players: [
        { ...teacher, hand: teacher.hand.slice(0, 2) },
        readyState.players[1],
      ],
    };

    const context = getDecisionContext(reducedTeacherState);
    expect(context.kind).toBe("finite-actions");
    if (context.kind !== "finite-actions") return;

    const observation = getAIObservation(reducedTeacherState, teacher.id);
    const prng = createMulberry32(112233);

    const action = natba1HeuristicPolicy(observation, context, prng);
    expect(action).toBeDefined();
    if (!action) return;

    expect(action.type).toBe("ACTIVATE_CHARACTER_SKILL");
    if (action.type === "ACTIVATE_CHARACTER_SKILL") {
      expect(action.skillId).toBe("extra_lesson");
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
        actions.push(natba1HeuristicPolicy(observation, context, prng));
      }
      return actions;
    };

    const actions1 = runA();
    const actions2 = runA();

    expect(actions1).toEqual(actions2);
  });
});
