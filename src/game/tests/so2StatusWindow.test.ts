import { describe, expect, it } from "vitest";
import { createMvp0TestGame as createInitialGame } from "./createTestGame";
import { engineReducer } from "../engine/reducer";
import type { CardInstanceId, GameState, Player, PlayerId } from "../engine/types";
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

function createSo2Scenario(
  so2CardId: CardInstanceId = "substance_so2_01",
  handlerCardId?: CardInstanceId,
): GameState {
  let state = createInitialGame({ shuffle: identityShuffle });
  const [attacker, target] = state.players;

  state = putCardInHand(state, attacker.id, so2CardId);
  if (handlerCardId) {
    state = putCardInHand(state, target.id, handlerCardId);
  }

  return state;
}

function playSo2(state: GameState, so2CardId: CardInstanceId = "substance_so2_01"): GameState {
  const [attacker, target] = state.players;

  return engineReducer(state, {
    type: "PLAY_CARD",
    playerId: attacker.id,
    cardInstanceId: so2CardId,
    targetPlayerId: target.id,
  });
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

function addSo2LeakForTest(state: GameState, playerId: PlayerId, statusId = "status_test_so2"): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    statuses: [
      ...player.statuses,
      {
        id: statusId,
        statusId: "SO2_LEAK",
        sourcePlayerId: state.players[0].id,
        createdAt: state.log.length + 1,
      },
    ],
  }));
}

function expectStateCoreUnchanged(actual: GameState, expected: GameState): void {
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

describe("SO2_LEAK status window", () => {
  it("applies SO2_LEAK without immediate damage or response window", () => {
    let state = createSo2Scenario();
    const [attacker, target] = state.players;

    state = playSo2(state);

    expect(state.phase).toBe("statusWindow");
    expect(state.activePlayerId).toBe(target.id);
    expect(state.pendingResponse).toBeUndefined();
    expect(state.pendingStatusHandling).toMatchObject({ playerId: target.id });
    expect(state.players[1].hp).toBe(10);
    expect(state.players[1].statuses).toHaveLength(1);
    expect(state.players[1].statuses[0].statusId).toBe("SO2_LEAK");
    expect(state.discardPile.filter((cardId) => cardId === "substance_so2_01")).toHaveLength(1);
    expect(state.players[0].hand).not.toContain("substance_so2_01");
    expect(state.activePlayerId).not.toBe(attacker.id);
    expectCardZonesToBeConsistent(state);
  });

  it("enters statusWindow at the target's next action start", () => {
    const state = playSo2(createSo2Scenario());

    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling?.playerId).toBe(state.players[1].id);
    expect(state.pendingStatusHandling?.statusInstanceId).toBe(state.players[1].statuses[0].id);
    expectCardZonesToBeConsistent(state);
  });

  it.each([
    ["OH-", "ion_oh_01"],
    ["稀 NaOH", "substance_naoh_dilute_01"],
    ["稀 KOH", "substance_koh_dilute_01"],
    ["石灰水", "substance_caoh2_limewater_01"],
  ] satisfies [string, CardInstanceId][])(
    "uses %s to absorb and remove SO2_LEAK",
    (_name, handlerCardId) => {
      let state = playSo2(createSo2Scenario("substance_so2_01", handlerCardId));
      const target = state.players[1];
      const statusInstanceId = currentStatusId(state);

      state = engineReducer(state, {
        type: "HANDLE_STATUS_WITH_CARD",
        playerId: target.id,
        statusInstanceId,
        cardInstanceId: handlerCardId,
      });

      expect(state.phase).toBe("mainAction");
      expect(state.activePlayerId).toBe(target.id);
      expect(state.pendingStatusHandling).toBeUndefined();
      expect(state.players[1].hp).toBe(10);
      expect(state.players[1].statuses).toHaveLength(0);
      expect(state.discardPile.filter((cardId) => cardId === handlerCardId)).toHaveLength(1);
      expect(state.log.some((entry) => entry.message.includes("碱性吸收"))).toBe(true);
      expectCardZonesToBeConsistent(state);
    },
  );

  it("keeps SO2_LEAK after passing and triggers it again on the next action start", () => {
    let state = playSo2(createSo2Scenario());
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
    expect(state.pendingStatusHandling).toBeUndefined();

    state = passCurrentAction(state);
    state = passCurrentAction(state);

    expect(state.activePlayerId).toBe(target.id);
    expect(state.phase).toBe("statusWindow");
    expect(state.players[1].hp).toBe(8);
    expect(state.pendingStatusHandling?.statusInstanceId).toBe(statusInstanceId);
    expectCardZonesToBeConsistent(state);
  });

  it("eliminates a 2 hp player who passes SO2_LEAK handling", () => {
    let state = createSo2Scenario();
    const targetId = state.players[1].id;
    state = updatePlayer(state, targetId, (player) => ({ ...player, hp: 2 }));
    state = playSo2(state);

    const statusInstanceId = currentStatusId(state);
    state = engineReducer(state, {
      type: "PASS_STATUS_HANDLING",
      playerId: targetId,
      statusInstanceId,
    });

    expect(state.phase).toBe("gameOver");
    expect(state.players[1]).toMatchObject({ hp: 0, eliminated: true });
    expect(state.winnerPlayerId).toBe(state.players[0].id);
    expect(state.pendingStatusHandling).toBeUndefined();
    expect(state.log.some((entry) => entry.message.includes("被淘汰"))).toBe(true);
    expectCardZonesToBeConsistent(state);
  });

  it("rejects invalid SO2_LEAK handling attempts without changing state", () => {
    let state = playSo2(createSo2Scenario("substance_so2_01", "ion_oh_01"));
    const [nonActivePlayer, activePlayer] = state.players;
    const statusInstanceId = currentStatusId(state);
    state = putCardInHand(state, nonActivePlayer.id, "ion_oh_02");

    const rejectedNonActive = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: nonActivePlayer.id,
      statusInstanceId,
      cardInstanceId: "ion_oh_02",
    });
    expect(rejectedNonActive).toBe(state);

    const rejectedWrongStatus = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId: "status_missing",
      cardInstanceId: "ion_oh_01",
    });
    expect(rejectedWrongStatus).toBe(state);

    const rejectedNoWindow = engineReducer(
      {
        ...state,
        phase: "mainAction",
        pendingStatusHandling: undefined,
      },
      {
        type: "HANDLE_STATUS_WITH_CARD",
        playerId: activePlayer.id,
        statusInstanceId,
        cardInstanceId: "ion_oh_01",
      },
    );
    expect(rejectedNoWindow.phase).toBe("mainAction");
    expect(rejectedNoWindow.players[1].statuses).toHaveLength(1);

    state = putCardInHand(state, activePlayer.id, "substance_hcl_dilute_01");
    const rejectedNoAlkalineAbsorb = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId,
      cardInstanceId: "substance_hcl_dilute_01",
    });
    expect(rejectedNoAlkalineAbsorb).toBe(state);
    expect(rejectedNoAlkalineAbsorb.players[1].hp).toBe(10);
    expect(rejectedNoAlkalineAbsorb.discardPile).not.toContain("substance_hcl_dilute_01");
    expectCardZonesToBeConsistent(rejectedNoAlkalineAbsorb);
  });

  it("rejects PASS_ACTION while in statusWindow", () => {
    const state = playSo2(createSo2Scenario());
    const rejected = passCurrentAction(state);

    expect(rejected).toBe(state);
    expect(rejected.phase).toBe("statusWindow");
    expectCardZonesToBeConsistent(rejected);
  });

  it("refreshes duplicate SO2_LEAK without stacking or double damage", () => {
    let state = createSo2Scenario("substance_so2_01");
    const attackerId = state.players[0].id;
    const targetId = state.players[1].id;

    state = playSo2(state);
    const originalStatusId = currentStatusId(state);

    state = engineReducer(state, {
      type: "PASS_STATUS_HANDLING",
      playerId: targetId,
      statusInstanceId: originalStatusId,
    });
    state = passCurrentAction(state);
    state = putCardInHand(state, attackerId, "substance_so2_02");
    state = playSo2(state, "substance_so2_02");

    expect(state.players[1].statuses).toHaveLength(1);
    expect(state.players[1].statuses[0].id).toBe(originalStatusId);
    expect(state.log.some((entry) => entry.message.includes("SO2_LEAK 已刷新/重复施加"))).toBe(true);

    state = engineReducer(state, {
      type: "PASS_STATUS_HANDLING",
      playerId: targetId,
      statusInstanceId: originalStatusId,
    });

    expect(state.players[1].hp).toBe(6);
    expect(state.players[1].statuses).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "substance_so2_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "substance_so2_02")).toHaveLength(1);
    expectCardZonesToBeConsistent(state);
  });

  it("enters statusWindow before mainAction after third-round cleanup starts a new cycle", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const startingPlayer = state.players[0];
    const finalActor = state.players[1];

    state = addSo2LeakForTest(state, startingPlayer.id);
    state = {
      ...state,
      activePlayerId: finalActor.id,
      roundInCycle: 3,
    };

    state = passCurrentAction(state);

    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.activePlayerId).toBe(startingPlayer.id);
    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling).toMatchObject({
      playerId: startingPlayer.id,
      statusInstanceId: "status_test_so2",
    });
    expect(state.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(state.log.filter((entry) => entry.message.includes("进入第 2 实验周期"))).toHaveLength(1);

    state = putCardInHand(state, startingPlayer.id, "ion_oh_01");
    state = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: startingPlayer.id,
      statusInstanceId: "status_test_so2",
      cardInstanceId: "ion_oh_01",
    });

    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.activePlayerId).toBe(startingPlayer.id);
    expect(state.phase).toBe("mainAction");
    expect(state.pendingStatusHandling).toBeUndefined();
    expectCardZonesToBeConsistent(state);
  });

  it("keeps SO2_LEAK through cleanup and triggers it at the new cycle action start", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const startingPlayer = state.players[0];
    const finalActor = state.players[1];
    const startingPlayerHand = [...startingPlayer.hand];

    state = addSo2LeakForTest(state, startingPlayer.id);
    state = {
      ...state,
      activePlayerId: finalActor.id,
      roundInCycle: 3,
    };

    state = passCurrentAction(state);

    expect(state.discardPile).toEqual(expect.arrayContaining(startingPlayerHand));
    expect(state.players[0].statuses).toEqual([
      {
        id: "status_test_so2",
        statusId: "SO2_LEAK",
        sourcePlayerId: "player_1",
        createdAt: 2,
      },
    ]);
    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling?.statusInstanceId).toBe("status_test_so2");
    expectCardZonesToBeConsistent(state);
  });

  it("rejects invalid PASS_STATUS_HANDLING calls without side effects", () => {
    const baseState = playSo2(createSo2Scenario());
    const [nonActivePlayer, activePlayer] = baseState.players;
    const statusInstanceId = currentStatusId(baseState);

    const rejectedNonActive = engineReducer(baseState, {
      type: "PASS_STATUS_HANDLING",
      playerId: nonActivePlayer.id,
      statusInstanceId,
    });

    expect(rejectedNonActive).toBe(baseState);
    expectStateCoreUnchanged(rejectedNonActive, baseState);
    expectCardZonesToBeConsistent(rejectedNonActive);

    const rejectedWrongStatus = engineReducer(baseState, {
      type: "PASS_STATUS_HANDLING",
      playerId: activePlayer.id,
      statusInstanceId: "status_missing",
    });

    expect(rejectedWrongStatus).toBe(baseState);
    expectStateCoreUnchanged(rejectedWrongStatus, baseState);
    expectCardZonesToBeConsistent(rejectedWrongStatus);

    const noPendingStatusState: GameState = {
      ...baseState,
      phase: "mainAction",
      pendingStatusHandling: undefined,
    };
    const rejectedNoPendingStatus = engineReducer(noPendingStatusState, {
      type: "PASS_STATUS_HANDLING",
      playerId: activePlayer.id,
      statusInstanceId,
    });

    expect(rejectedNoPendingStatus).toBe(noPendingStatusState);
    expectStateCoreUnchanged(rejectedNoPendingStatus, noPendingStatusState);
    expectCardZonesToBeConsistent(rejectedNoPendingStatus);
  });
});
