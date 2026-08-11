import { describe, expect, it } from "vitest";
import { createMvp0TestGame as createInitialGame } from "./createTestGame";
import { engineReducer } from "../engine/reducer";
import type { CardInstanceId, GameState, Player, PlayerId, StatusId } from "../engine/types";
import { identityShuffle } from "../../shared/random";
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

function createFireScenario(handlerCardId?: CardInstanceId): GameState {
  let state = createInitialGame({ shuffle: identityShuffle });
  const [, target] = state.players;

  if (handlerCardId) {
    state = putCardInHand(state, target.id, handlerCardId);
  }

  state = addStatusForTest(state, target.id, "FIRE", 1);
  return {
    ...state,
    activePlayerId: target.id,
    phase: "statusWindow",
    pendingStatusHandling: {
      playerId: target.id,
      statusInstanceId: "status_test_FIRE_1",
    },
  };
}

function currentStatusId(state: GameState): string {
  const statusInstanceId = state.pendingStatusHandling?.statusInstanceId;

  if (!statusInstanceId) {
    throw new Error("Expected pending status handling");
  }

  return statusInstanceId;
}

function passCurrentAction(state: GameState): GameState {
  return engineReducer(state, {
    type: "PASS_ACTION",
    playerId: state.activePlayerId,
  });
}

function addStatusForTest(
  state: GameState,
  playerId: PlayerId,
  statusId: StatusId,
  createdAt: number,
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

function countCardDefinition(state: GameState, definitionId: string): number {
  return Object.values(state.cardInstances).filter(
    (cardInstance) => cardInstance.definitionId === definitionId,
  ).length;
}

function expectNoCoreSideEffects(actual: GameState, expected: GameState): void {
  expect(actual.players.map((player) => player.hp)).toEqual(expected.players.map((player) => player.hp));
  expect(actual.players.map((player) => player.statuses)).toEqual(
    expected.players.map((player) => player.statuses),
  );
  expect(actual.players.map((player) => player.hand)).toEqual(expected.players.map((player) => player.hand));
  expect(actual.discardPile).toEqual(expected.discardPile);
  expect(actual.log).toEqual(expected.log);
  expect(actual.phase).toBe(expected.phase);
  expect(actual.activePlayerId).toBe(expected.activePlayerId);
  expect(actual.cycleNumber).toBe(expected.cycleNumber);
  expect(actual.roundInCycle).toBe(expected.roundInCycle);
}

describe("FIRE status window", () => {
  it("processes an existing FIRE status without immediate damage or response window", () => {
    const state = createFireScenario();
    const [, target] = state.players;

    expect(state.phase).toBe("statusWindow");
    expect(state.activePlayerId).toBe(target.id);
    expect(state.pendingResponse).toBeUndefined();
    expect(state.pendingStatusHandling).toMatchObject({ playerId: target.id });
    expect(state.players[1].hp).toBe(10);
    expect(state.players[1].statuses).toHaveLength(1);
    expect(state.players[1].statuses[0].statusId).toBe("FIRE");
    expectCardZonesToBeConsistent(state);
  });

  it("enters statusWindow at the target's next action start", () => {
    const state = createFireScenario();

    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling?.playerId).toBe(state.players[1].id);
    expect(state.pendingStatusHandling?.statusInstanceId).toBe(state.players[1].statuses[0].id);
    expectCardZonesToBeConsistent(state);
  });

  it("uses H2O to remove FIRE without damage", () => {
    let state = createFireScenario("substance_h2o_01");
    const target = state.players[1];
    const statusInstanceId = currentStatusId(state);

    state = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: target.id,
      statusInstanceId,
      cardInstanceId: "substance_h2o_01",
    });

    expect(state.phase).toBe("mainAction");
    expect(state.players[1].hp).toBe(10);
    expect(state.players[1].statuses).toHaveLength(0);
    expect(state.discardPile.filter((cardId) => cardId === "substance_h2o_01")).toHaveLength(1);
    expect(state.log.some((entry) => entry.message.includes("处理 FIRE"))).toBe(true);
    expectCardZonesToBeConsistent(state);
  });

  it("uses a hand CO2 card to remove FIRE without creating extra CO2", () => {
    let state = createFireScenario("substance_co2_01");
    const initialCardInstanceCount = Object.keys(state.cardInstances).length;
    const initialCo2Count = countCardDefinition(state, "substance_co2");
    const target = state.players[1];
    const statusInstanceId = currentStatusId(state);

    state = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: target.id,
      statusInstanceId,
      cardInstanceId: "substance_co2_01",
    });

    expect(state.phase).toBe("mainAction");
    expect(state.players[1].hp).toBe(10);
    expect(state.players[1].statuses).toHaveLength(0);
    expect(state.discardPile.filter((cardId) => cardId === "substance_co2_01")).toHaveLength(1);
    expect(Object.keys(state.cardInstances)).toHaveLength(initialCardInstanceCount);
    expect(countCardDefinition(state, "substance_co2")).toBe(initialCo2Count);
    expect(state.log.some((entry) => entry.message.includes("生成 CO2"))).toBe(false);
    expectCardZonesToBeConsistent(state);
  });

  it("keeps FIRE after passing and triggers it again on the next action start", () => {
    let state = createFireScenario();
    const target = state.players[1];
    const statusInstanceId = currentStatusId(state);

    state = engineReducer(state, {
      type: "PASS_STATUS_HANDLING",
      playerId: target.id,
      statusInstanceId,
    });

    expect(state.phase).toBe("mainAction");
    expect(state.players[1].hp).toBe(8);
    expect(state.players[1].statuses).toHaveLength(1);

    state = passCurrentAction(state);
    state = passCurrentAction(state);

    expect(state.activePlayerId).toBe(target.id);
    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling?.statusInstanceId).toBe(statusInstanceId);
    expectCardZonesToBeConsistent(state);
  });

  it("eliminates a 2 hp player who passes FIRE handling", () => {
    let state = createFireScenario();
    const targetId = state.players[1].id;
    state = updatePlayer(state, targetId, (player) => ({ ...player, hp: 2 }));

    state = engineReducer(state, {
      type: "PASS_STATUS_HANDLING",
      playerId: targetId,
      statusInstanceId: currentStatusId(state),
    });

    expect(state.phase).toBe("gameOver");
    expect(state.players[1]).toMatchObject({ hp: 0, eliminated: true });
    expect(state.winnerPlayerId).toBe(state.players[0].id);
    expect(state.pendingStatusHandling).toBeUndefined();
    expectCardZonesToBeConsistent(state);
  });

  it("processes SO2_LEAK and FIRE in createdAt order before mainAction", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const activePlayer = state.players[0];
    state = addStatusForTest(state, activePlayer.id, "SO2_LEAK", 1);
    state = addStatusForTest(state, activePlayer.id, "FIRE", 2);
    state = putCardInHand(state, activePlayer.id, "ion_oh_01");
    state = putCardInHand(state, activePlayer.id, "substance_h2o_01");
    state = {
      ...state,
      activePlayerId: state.players[1].id,
    };

    state = passCurrentAction(state);
    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling?.statusInstanceId).toBe("status_test_SO2_LEAK_1");

    const fireWithOhRejected = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId: "status_test_SO2_LEAK_1",
      cardInstanceId: "substance_h2o_01",
    });
    expect(fireWithOhRejected).toBe(state);

    state = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId: "status_test_SO2_LEAK_1",
      cardInstanceId: "ion_oh_01",
    });
    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling?.statusInstanceId).toBe("status_test_FIRE_2");

    const fireWithBaseRejected = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId: "status_test_FIRE_2",
      cardInstanceId: "ion_oh_01",
    });
    expect(fireWithBaseRejected).toBe(state);

    state = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId: "status_test_FIRE_2",
      cardInstanceId: "substance_h2o_01",
    });

    expect(state.phase).toBe("mainAction");
    expect(state.players[0].statuses).toHaveLength(0);
    expectCardZonesToBeConsistent(state);
  });

  it("rejects invalid FIRE handling attempts without side effects", () => {
    let state = createFireScenario("substance_h2o_01");
    const [nonActivePlayer, activePlayer] = state.players;
    const statusInstanceId = currentStatusId(state);

    const rejectedNonActive = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: nonActivePlayer.id,
      statusInstanceId,
      cardInstanceId: "substance_h2o_01",
    });
    expect(rejectedNonActive).toBe(state);
    expectNoCoreSideEffects(rejectedNonActive, state);

    const rejectedWrongStatus = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId: "status_missing",
      cardInstanceId: "substance_h2o_01",
    });
    expect(rejectedWrongStatus).toBe(state);
    expectNoCoreSideEffects(rejectedWrongStatus, state);

    let noPendingState: GameState = {
      ...state,
      phase: "mainAction",
      pendingStatusHandling: undefined,
    };
    const rejectedNoPending = engineReducer(noPendingState, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId,
      cardInstanceId: "substance_h2o_01",
    });
    expect(rejectedNoPending).toBe(noPendingState);
    expectNoCoreSideEffects(rejectedNoPending, noPendingState);

    state = putCardInHand(state, activePlayer.id, "ion_oh_01");
    state = putCardInHand(state, activePlayer.id, "substance_naoh_dilute_01");
    state = putCardInHand(state, activePlayer.id, "substance_koh_dilute_01");
    state = putCardInHand(state, activePlayer.id, "substance_caoh2_limewater_01");
    state = putCardInHand(state, activePlayer.id, "substance_na2co3_01");

    for (const invalidCardId of [
      "ion_oh_01",
      "substance_naoh_dilute_01",
      "substance_koh_dilute_01",
      "substance_caoh2_limewater_01",
      "substance_na2co3_01",
    ] satisfies CardInstanceId[]) {
      const rejected = engineReducer(state, {
        type: "HANDLE_STATUS_WITH_CARD",
        playerId: activePlayer.id,
        statusInstanceId,
        cardInstanceId: invalidCardId,
      });
      expect(rejected).toBe(state);
      expectNoCoreSideEffects(rejected, state);
    }

    noPendingState = updatePlayer(noPendingState, activePlayer.id, (player) => ({
      ...player,
      hp: 0,
      eliminated: true,
    }));
    const rejectedEliminated = engineReducer(
      {
        ...noPendingState,
        phase: "statusWindow",
        pendingStatusHandling: { playerId: activePlayer.id, statusInstanceId },
      },
      {
        type: "HANDLE_STATUS_WITH_CARD",
        playerId: activePlayer.id,
        statusInstanceId,
        cardInstanceId: "substance_h2o_01",
      },
    );
    expect(rejectedEliminated.players[1].eliminated).toBe(true);
    expect(rejectedEliminated.discardPile).toEqual(noPendingState.discardPile);
    expectCardZonesToBeConsistent(rejectedEliminated);
  });

  it("keeps FIRE through cleanup and triggers FIRE statusWindow in the new cycle", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const startingPlayer = state.players[0];
    const finalActor = state.players[1];
    const startingPlayerHand = [...startingPlayer.hand];

    state = addStatusForTest(state, startingPlayer.id, "FIRE", 1);
    state = {
      ...state,
      activePlayerId: finalActor.id,
      roundInCycle: 3,
    };

    state = passCurrentAction(state);

    expect(state.discardPile).toEqual(expect.arrayContaining(startingPlayerHand));
    expect(state.players[0].statuses).toEqual([
      {
        id: "status_test_FIRE_1",
        statusId: "FIRE",
        sourcePlayerId: "player_1",
        createdAt: 1,
      },
    ]);
    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.activePlayerId).toBe(startingPlayer.id);
    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling?.statusInstanceId).toBe("status_test_FIRE_1");
    expectCardZonesToBeConsistent(state);
  });

  it("rejects invalid PASS_STATUS_HANDLING calls for FIRE without side effects", () => {
    const baseState = createFireScenario();
    const [nonActivePlayer, activePlayer] = baseState.players;
    const statusInstanceId = currentStatusId(baseState);

    const rejectedNonActive = engineReducer(baseState, {
      type: "PASS_STATUS_HANDLING",
      playerId: nonActivePlayer.id,
      statusInstanceId,
    });

    expect(rejectedNonActive).toBe(baseState);
    expectNoCoreSideEffects(rejectedNonActive, baseState);
    expectCardZonesToBeConsistent(rejectedNonActive);

    const rejectedWrongStatus = engineReducer(baseState, {
      type: "PASS_STATUS_HANDLING",
      playerId: activePlayer.id,
      statusInstanceId: "status_missing",
    });

    expect(rejectedWrongStatus).toBe(baseState);
    expectNoCoreSideEffects(rejectedWrongStatus, baseState);
    expectCardZonesToBeConsistent(rejectedWrongStatus);

    const noPendingState: GameState = {
      ...baseState,
      phase: "mainAction",
      pendingStatusHandling: undefined,
    };
    const rejectedNoPending = engineReducer(noPendingState, {
      type: "PASS_STATUS_HANDLING",
      playerId: activePlayer.id,
      statusInstanceId,
    });

    expect(rejectedNoPending).toBe(noPendingState);
    expectNoCoreSideEffects(rejectedNoPending, noPendingState);
    expectCardZonesToBeConsistent(rejectedNoPending);

    const eliminatedState = updatePlayer(baseState, activePlayer.id, (player) => ({
      ...player,
      hp: 0,
      eliminated: true,
    }));
    const rejectedEliminated = engineReducer(eliminatedState, {
      type: "PASS_STATUS_HANDLING",
      playerId: activePlayer.id,
      statusInstanceId,
    });

    expect(rejectedEliminated).toBe(eliminatedState);
    expectNoCoreSideEffects(rejectedEliminated, eliminatedState);
    expectCardZonesToBeConsistent(rejectedEliminated);
  });

  it("continues to SO2_LEAK statusWindow after passing an earlier FIRE", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const activePlayer = state.players[0];

    state = addStatusForTest(state, activePlayer.id, "FIRE", 1);
    state = addStatusForTest(state, activePlayer.id, "SO2_LEAK", 2);
    state = {
      ...state,
      activePlayerId: state.players[1].id,
    };

    state = passCurrentAction(state);
    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling?.statusInstanceId).toBe("status_test_FIRE_1");

    state = engineReducer(state, {
      type: "PASS_STATUS_HANDLING",
      playerId: activePlayer.id,
      statusInstanceId: "status_test_FIRE_1",
    });

    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling?.statusInstanceId).toBe("status_test_SO2_LEAK_2");
    expect(state.players[0].hp).toBe(8);
    expect(state.players[0].statuses.map((status) => status.statusId)).toEqual(["FIRE", "SO2_LEAK"]);

    state = engineReducer(state, {
      type: "PASS_STATUS_HANDLING",
      playerId: activePlayer.id,
      statusInstanceId: "status_test_SO2_LEAK_2",
    });

    expect(state.phase).toBe("mainAction");
    expect(state.players[0].hp).toBe(6);
    expect(state.players[0].statuses.map((status) => status.statusId)).toEqual(["FIRE", "SO2_LEAK"]);
    expectCardZonesToBeConsistent(state);
  });
});
