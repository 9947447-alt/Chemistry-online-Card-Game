import { describe, expect, it } from "vitest";
import { starterDeck, starterDeckSize } from "../data/starterDeck";
import { createInitialGame } from "../engine/createInitialGame";
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

function addStatusForTest(
  state: GameState,
  playerId: PlayerId,
  statusId: StatusId,
): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    statuses: [
      ...player.statuses,
      {
        id: `status_test_${statusId}`,
        statusId,
        sourcePlayerId: state.players[1].id,
        createdAt: 1,
      },
    ],
  }));
}

function setHp(state: GameState, playerId: PlayerId, hp: number): GameState {
  return updatePlayer(state, playerId, (player) => ({ ...player, hp }));
}

function countCardDefinition(state: GameState, definitionId: string): number {
  return Object.values(state.cardInstances).filter(
    (cardInstance) => cardInstance.definitionId === definitionId,
  ).length;
}

function expectNoSideEffects(actual: GameState, expected: GameState): void {
  expect(actual.players).toEqual(expected.players);
  expect(actual.deck).toEqual(expected.deck);
  expect(actual.discardPile).toEqual(expected.discardPile);
  expect(actual.cardInstances).toEqual(expected.cardInstances);
  expect(actual.log).toEqual(expected.log);
  expect(actual.phase).toBe(expected.phase);
  expect(actual.activePlayerId).toBe(expected.activePlayerId);
  expect(actual.cycleNumber).toBe(expected.cycleNumber);
  expect(actual.roundInCycle).toBe(expected.roundInCycle);
  expect(actual.pendingResponse).toEqual(expected.pendingResponse);
  expect(actual.pendingStatusHandling).toEqual(expected.pendingStatusHandling);
}

function playO2(
  state: GameState,
  playerId: PlayerId,
  targetPlayerId: PlayerId,
  cardInstanceId: CardInstanceId = "substance_o2_01",
): GameState {
  return engineReducer(state, {
    type: "PLAY_CARD",
    playerId,
    cardInstanceId,
    targetPlayerId,
  });
}

function createO2State(hp: number): GameState {
  let state = createInitialGame({ shuffle: identityShuffle });
  const playerId = state.players[0].id;
  state = putCardInHand(state, playerId, "substance_o2_01");
  state = setHp(state, playerId, hp);
  expectCardZonesToBeConsistent(state);
  return state;
}

describe("O2 recovery", () => {
  it("recovers 2 HP below max HP and advances once", () => {
    let state = createO2State(7);
    const playerId = state.players[0].id;

    state = playO2(state, playerId, playerId);

    expect(state.players[0].hp).toBe(9);
    expect(state.discardPile.filter((cardId) => cardId === "substance_o2_01")).toHaveLength(1);
    expect(state.players[0].hand).not.toContain("substance_o2_01");
    expect(state.pendingResponse).toBeUndefined();
    expect(state.activePlayerId).toBe(state.players[1].id);
    expect(state.roundInCycle).toBe(1);
    expect(state.log.some((entry) => entry.message.includes("使用 O2"))).toBe(true);
    expectCardZonesToBeConsistent(state);
  });

  it("does not recover above max HP", () => {
    let state = createO2State(9);
    const playerId = state.players[0].id;

    state = playO2(state, playerId, playerId);

    expect(state.players[0].hp).toBe(10);
    expect(state.players[0].maxHp).toBe(10);
    expect(state.discardPile.filter((cardId) => cardId === "substance_o2_01")).toHaveLength(1);
    expectCardZonesToBeConsistent(state);
  });

  it("rejects O2 at full HP without side effects", () => {
    const state = createO2State(10);
    const playerId = state.players[0].id;

    const rejected = playO2(state, playerId, playerId);

    expect(rejected).toBe(state);
    expectNoSideEffects(rejected, state);
    expect(rejected.discardPile).not.toContain("substance_o2_01");
    expectCardZonesToBeConsistent(rejected);
  });

  it.each([
    ["FIRE", "FIRE"],
    ["SO2_LEAK", "SO2_LEAK"],
  ] satisfies [string, StatusId][])(
    "rejects O2 while the player has %s without side effects",
    (_name, statusId) => {
      let state = createO2State(7);
      const playerId = state.players[0].id;
      state = addStatusForTest(state, playerId, statusId);

      const rejected = playO2(state, playerId, playerId);

      expect(rejected).toBe(state);
      expectNoSideEffects(rejected, state);
      expect(rejected.players[0].hp).toBe(7);
      expect(rejected.discardPile).not.toContain("substance_o2_01");
      expect(rejected.log.some((entry) => entry.message.includes("使用 O2"))).toBe(false);
      expectCardZonesToBeConsistent(rejected);
    },
  );

  it("rejects invalid O2 recovery calls without side effects", () => {
    const cases: { name: string; state: GameState; playerId: PlayerId; targetPlayerId: PlayerId }[] = [];

    let nonActive = createInitialGame({ shuffle: identityShuffle });
    nonActive = putCardInHand(nonActive, nonActive.players[1].id, "substance_o2_01");
    nonActive = setHp(nonActive, nonActive.players[1].id, 7);
    cases.push({
      name: "non-active player",
      state: nonActive,
      playerId: nonActive.players[1].id,
      targetPlayerId: nonActive.players[1].id,
    });

    let wrongTarget = createO2State(7);
    cases.push({
      name: "wrong target",
      state: wrongTarget,
      playerId: wrongTarget.players[0].id,
      targetPlayerId: wrongTarget.players[1].id,
    });

    let responseWindow = createO2State(7);
    responseWindow = { ...responseWindow, phase: "responseWindow" };
    cases.push({
      name: "responseWindow",
      state: responseWindow,
      playerId: responseWindow.players[0].id,
      targetPlayerId: responseWindow.players[0].id,
    });

    let statusWindow = createO2State(7);
    statusWindow = {
      ...statusWindow,
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId: statusWindow.players[0].id,
        statusInstanceId: "status_missing",
      },
    };
    cases.push({
      name: "statusWindow",
      state: statusWindow,
      playerId: statusWindow.players[0].id,
      targetPlayerId: statusWindow.players[0].id,
    });

    let gameOver = createO2State(7);
    gameOver = { ...gameOver, phase: "gameOver", winnerPlayerId: gameOver.players[0].id };
    cases.push({
      name: "gameOver",
      state: gameOver,
      playerId: gameOver.players[0].id,
      targetPlayerId: gameOver.players[0].id,
    });

    let eliminated = createO2State(7);
    eliminated = updatePlayer(eliminated, eliminated.players[0].id, (player) => ({
      ...player,
      hp: 0,
      eliminated: true,
    }));
    cases.push({
      name: "eliminated player",
      state: eliminated,
      playerId: eliminated.players[0].id,
      targetPlayerId: eliminated.players[0].id,
    });

    for (const targetCase of cases) {
      const rejected = playO2(targetCase.state, targetCase.playerId, targetCase.targetPlayerId);

      expect(rejected, targetCase.name).toBe(targetCase.state);
      expectNoSideEffects(rejected, targetCase.state);
      expect(rejected.discardPile).not.toContain("substance_o2_01");
      expect(rejected.log.some((entry) => entry.message.includes("使用 O2"))).toBe(false);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("keeps O/O2 counts while excluding the role-only lab fire skill from the starter deck", () => {
    const state = createInitialGame({ shuffle: identityShuffle });

    expect(starterDeckSize).toBe(68);
    expect(starterDeck.find((entry) => entry.definitionId === "element_o")?.count).toBe(4);
    expect(starterDeck.find((entry) => entry.definitionId === "substance_o2")?.count).toBe(2);
    expect(starterDeck.some((entry) => entry.definitionId === "event_lab_fire")).toBe(false);
    expect(Object.keys(state.cardInstances)).toHaveLength(starterDeckSize);
    expect(countCardDefinition(state, "element_o")).toBe(4);
    expect(countCardDefinition(state, "substance_o2")).toBe(2);
    expect(countCardDefinition(state, "event_lab_fire")).toBe(0);
    expectCardZonesToBeConsistent(state);
  });
});
