import { describe, expect, it } from "vitest";
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

function putCo2ComponentsInHand(state: GameState, playerId: PlayerId): GameState {
  let nextState = putCardInHand(state, playerId, "element_c_01");
  nextState = putCardInHand(nextState, playerId, "element_o_01");
  return putCardInHand(nextState, playerId, "element_o_02");
}

function putSo2ComponentsInHand(state: GameState, playerId: PlayerId): GameState {
  let nextState = putCardInHand(state, playerId, "element_s_01");
  nextState = putCardInHand(nextState, playerId, "element_o_01");
  return putCardInHand(nextState, playerId, "element_o_02");
}

function putH2oComponentsInHand(state: GameState, playerId: PlayerId): GameState {
  let nextState = putCardInHand(state, playerId, "ion_h_01");
  return putCardInHand(nextState, playerId, "ion_oh_01");
}

function countCardDefinition(state: GameState, definitionId: string): number {
  return Object.values(state.cardInstances).filter(
    (cardInstance) => cardInstance.definitionId === definitionId,
  ).length;
}

function expectTotalCardInstances(state: GameState): void {
  expect(Object.keys(state.cardInstances)).toHaveLength(70);
}

function expectNoCoreSideEffects(actual: GameState, expected: GameState): void {
  expect(actual.players).toEqual(expected.players);
  expect(actual.deck).toEqual(expected.deck);
  expect(actual.discardPile).toEqual(expected.discardPile);
  expect(actual.cardInstances).toEqual(expected.cardInstances);
  expect(actual.log).toEqual(expected.log);
  expect(actual.phase).toBe(expected.phase);
  expect(actual.activePlayerId).toBe(expected.activePlayerId);
  expect(actual.cycleNumber).toBe(expected.cycleNumber);
  expect(actual.roundInCycle).toBe(expected.roundInCycle);
}

function startCo2DIY(state: GameState, playerId: PlayerId): GameState {
  return engineReducer(state, {
    type: "START_ACTIVE_DIY",
    playerId,
    recipeId: "diy_co2_from_c_o_o",
    componentCardInstanceIds: ["element_c_01", "element_o_01", "element_o_02"],
  });
}

function startSo2DIY(state: GameState, playerId: PlayerId, targetPlayerId: PlayerId): GameState {
  return engineReducer(state, {
    type: "START_ACTIVE_DIY",
    playerId,
    recipeId: "diy_so2_from_s_o_o",
    componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_02"],
    targetPlayerId,
  });
}

function startH2oDIY(state: GameState, playerId: PlayerId): GameState {
  return engineReducer(state, {
    type: "START_ACTIVE_DIY",
    playerId,
    recipeId: "diy_h2o_from_h_oh",
    componentCardInstanceIds: ["ion_h_01", "ion_oh_01"],
  });
}

function passCurrentAction(state: GameState): GameState {
  return engineReducer(state, {
    type: "PASS_ACTION",
    playerId: state.activePlayerId,
  });
}

describe("active DIY", () => {
  it("uses C + O + O to generate CO2 and remove own FIRE", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const player = state.players[0];
    state = addStatusForTest(state, player.id, "FIRE");
    state = putCo2ComponentsInHand(state, player.id);
    const initialCo2Count = countCardDefinition(state, "substance_co2");

    state = startCo2DIY(state, player.id);

    expect(state.players[0].statuses.some((status) => status.statusId === "FIRE")).toBe(false);
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expect(state.discardPile.filter((cardId) => cardId === "element_c_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "element_o_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "element_o_02")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_co2")).toBe(initialCo2Count);
    expect(state.activePlayerId).toBe(state.players[1].id);
    expect(state.roundInCycle).toBe(1);
    expect(state.log.some((entry) => entry.message.includes("主动 DIY 生成 CO2 并移除 FIRE"))).toBe(true);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("rejects C + O + O without own FIRE without side effects", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const player = state.players[0];
    state = putCo2ComponentsInHand(state, player.id);

    const rejected = startCo2DIY(state, player.id);

    expect(rejected).toBe(state);
    expectNoCoreSideEffects(rejected, state);
    expect(rejected.players[0].usedDIYThisCycle).toBe(false);
    expect(rejected.log.some((entry) => entry.message.includes("主动 DIY 生成 CO2"))).toBe(false);
    expectCardZonesToBeConsistent(rejected);
  });

  it("rejects C + O + O with a target player without side effects", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;
    state = addStatusForTest(state, player.id, "FIRE");
    state = putCo2ComponentsInHand(state, player.id);

    const rejected = engineReducer(state, {
      type: "START_ACTIVE_DIY",
      playerId: player.id,
      recipeId: "diy_co2_from_c_o_o",
      componentCardInstanceIds: ["element_c_01", "element_o_01", "element_o_02"],
      targetPlayerId: target.id,
    });

    expect(rejected).toBe(state);
    expectNoCoreSideEffects(rejected, state);
    expect(rejected.players[0].usedDIYThisCycle).toBe(false);
    expect(rejected.players[0].statuses.some((status) => status.statusId === "FIRE")).toBe(true);
    expect(rejected.discardPile).not.toContain("element_c_01");
    expect(rejected.discardPile).not.toContain("element_o_01");
    expect(rejected.discardPile).not.toContain("element_o_02");
    expect(rejected.log.some((entry) => entry.message.includes("主动 DIY 生成 CO2"))).toBe(false);
    expectTotalCardInstances(rejected);
    expectCardZonesToBeConsistent(rejected);
  });

  it("rejects active DIY with extra components without side effects", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const player = state.players[0];
    state = addStatusForTest(state, player.id, "FIRE");
    state = putCo2ComponentsInHand(state, player.id);
    state = putCardInHand(state, player.id, "element_o_03");

    const rejected = engineReducer(state, {
      type: "START_ACTIVE_DIY",
      playerId: player.id,
      recipeId: "diy_co2_from_c_o_o",
      componentCardInstanceIds: ["element_c_01", "element_o_01", "element_o_02", "element_o_03"],
    });

    expect(rejected).toBe(state);
    expectNoCoreSideEffects(rejected, state);
    expect(rejected.players[0].usedDIYThisCycle).toBe(false);
    expect(rejected.players[0].statuses.some((status) => status.statusId === "FIRE")).toBe(true);
    expect(rejected.discardPile).not.toContain("element_c_01");
    expect(rejected.discardPile).not.toContain("element_o_01");
    expect(rejected.discardPile).not.toContain("element_o_02");
    expect(rejected.discardPile).not.toContain("element_o_03");
    expect(rejected.log.some((entry) => entry.message.includes("主动 DIY 生成 CO2"))).toBe(false);
    expectTotalCardInstances(rejected);
    expectCardZonesToBeConsistent(rejected);
  });

  it("rejects START_ACTIVE_DIY during statusWindow without handling status", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const player = state.players[0];
    state = addStatusForTest(state, player.id, "FIRE");
    state = putCo2ComponentsInHand(state, player.id);
    state = {
      ...state,
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId: player.id,
        statusInstanceId: "status_test_FIRE_1",
      },
    };

    const rejected = startCo2DIY(state, player.id);

    expect(rejected).toBe(state);
    expectNoCoreSideEffects(rejected, state);
    expect(rejected.pendingStatusHandling).toEqual(state.pendingStatusHandling);
    expect(rejected.players[0].usedDIYThisCycle).toBe(false);
    expect(rejected.players[0].statuses.some((status) => status.statusId === "FIRE")).toBe(true);
    expect(rejected.discardPile).not.toContain("element_c_01");
    expect(rejected.discardPile).not.toContain("element_o_01");
    expect(rejected.discardPile).not.toContain("element_o_02");
    expect(rejected.log.some((entry) => entry.message.includes("主动 DIY 生成 CO2"))).toBe(false);
    expectTotalCardInstances(rejected);
    expectCardZonesToBeConsistent(rejected);
  });

  it("uses S + O + O to generate SO2 and apply SO2_LEAK", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;
    state = putSo2ComponentsInHand(state, player.id);
    const initialSo2Count = countCardDefinition(state, "substance_so2");

    state = startSo2DIY(state, player.id, target.id);

    expect(state.players[1].statuses).toHaveLength(1);
    expect(state.players[1].statuses[0].statusId).toBe("SO2_LEAK");
    expect(state.players[1].hp).toBe(10);
    expect(state.phase).toBe("statusWindow");
    expect(state.pendingResponse).toBeUndefined();
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expect(state.discardPile.filter((cardId) => cardId === "element_s_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "element_o_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "element_o_02")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_so2")).toBe(initialSo2Count);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("refreshes existing SO2_LEAK from S + O + O without stacking or double damage", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;
    state = putSo2ComponentsInHand(state, player.id);
    state = addStatusForTest(state, target.id, "SO2_LEAK");

    state = startSo2DIY(state, player.id, target.id);

    expect(state.players[1].statuses).toHaveLength(1);
    expect(state.players[1].statuses[0].id).toBe("status_test_SO2_LEAK_1");
    expect(state.log.some((entry) => entry.message.includes("SO2_LEAK 已刷新/重复施加"))).toBe(true);

    state = engineReducer(state, {
      type: "PASS_STATUS_HANDLING",
      playerId: target.id,
      statusInstanceId: "status_test_SO2_LEAK_1",
    });

    expect(state.players[1].hp).toBe(8);
    expect(state.players[1].statuses).toHaveLength(1);
    expectCardZonesToBeConsistent(state);
  });

  it("removes only the acting player's FIRE when C + O + O generates CO2", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, opponent] = state.players;
    state = addStatusForTest(state, player.id, "FIRE", 1);
    state = addStatusForTest(state, player.id, "SO2_LEAK", 2);
    state = addStatusForTest(state, opponent.id, "FIRE", 3);
    state = putCo2ComponentsInHand(state, player.id);

    state = startCo2DIY(state, player.id);

    expect(state.players[0].statuses.some((status) => status.statusId === "FIRE")).toBe(false);
    expect(state.players[0].statuses.some((status) => status.statusId === "SO2_LEAK")).toBe(true);
    expect(state.players[1].statuses.some((status) => status.statusId === "FIRE")).toBe(true);
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("uses H+ + OH- to generate H2O and remove own FIRE", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const player = state.players[0];
    state = addStatusForTest(state, player.id, "FIRE");
    state = putH2oComponentsInHand(state, player.id);
    const initialH2oCount = countCardDefinition(state, "substance_h2o");

    state = startH2oDIY(state, player.id);

    expect(state.players[0].statuses.some((status) => status.statusId === "FIRE")).toBe(false);
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expect(state.discardPile.filter((cardId) => cardId === "ion_h_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_h2o")).toBe(initialH2oCount);
    expect(state.pendingResponse).toBeUndefined();
    expect(state.activePlayerId).toBe(state.players[1].id);
    expect(state.roundInCycle).toBe(1);
    expect(state.log.some((entry) => entry.message.includes("主动 DIY 生成 H2O 并移除 FIRE"))).toBe(true);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("H+ + OH- removes only the acting player's FIRE", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, opponent] = state.players;
    state = addStatusForTest(state, player.id, "FIRE", 1);
    state = addStatusForTest(state, player.id, "SO2_LEAK", 2);
    state = addStatusForTest(state, opponent.id, "FIRE", 3);
    state = addStatusForTest(state, opponent.id, "SO2_LEAK", 4);
    state = putH2oComponentsInHand(state, player.id);

    state = startH2oDIY(state, player.id);

    expect(state.players[0].statuses.map((status) => status.statusId)).toEqual(["SO2_LEAK"]);
    expect(state.players[1].statuses.map((status) => status.statusId)).toEqual([
      "FIRE",
      "SO2_LEAK",
    ]);
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("rejects H+ + OH- without own FIRE without side effects", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const player = state.players[0];
    state = putH2oComponentsInHand(state, player.id);

    const rejected = startH2oDIY(state, player.id);

    expect(rejected).toBe(state);
    expectNoCoreSideEffects(rejected, state);
    expect(rejected.players[0].usedDIYThisCycle).toBe(false);
    expect(rejected.discardPile).not.toContain("ion_h_01");
    expect(rejected.discardPile).not.toContain("ion_oh_01");
    expect(rejected.log.some((entry) => entry.message.includes("主动 DIY 生成 H2O"))).toBe(false);
    expectTotalCardInstances(rejected);
    expectCardZonesToBeConsistent(rejected);
  });

  it("rejects malformed H+ + OH- DIY calls without side effects", () => {
    const createReadyH2oState = () => {
      let state = createInitialGame({ shuffle: identityShuffle });
      state = addStatusForTest(state, state.players[0].id, "FIRE");
      state = putH2oComponentsInHand(state, state.players[0].id);
      return state;
    };

    const cases: { name: string; state: GameState; action: Parameters<typeof engineReducer>[1] }[] = [];

    let extraComponent = createReadyH2oState();
    extraComponent = putCardInHand(extraComponent, extraComponent.players[0].id, "ion_oh_02");
    cases.push({
      name: "extra component",
      state: extraComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: extraComponent.players[0].id,
        recipeId: "diy_h2o_from_h_oh",
        componentCardInstanceIds: ["ion_h_01", "ion_oh_01", "ion_oh_02"],
      },
    });

    const missingComponent = createReadyH2oState();
    cases.push({
      name: "missing component",
      state: missingComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: missingComponent.players[0].id,
        recipeId: "diy_h2o_from_h_oh",
        componentCardInstanceIds: ["ion_h_01"],
      },
    });

    const duplicateComponent = createReadyH2oState();
    cases.push({
      name: "duplicate component",
      state: duplicateComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: duplicateComponent.players[0].id,
        recipeId: "diy_h2o_from_h_oh",
        componentCardInstanceIds: ["ion_h_01", "ion_h_01"],
      },
    });

    const withTarget = createReadyH2oState();
    cases.push({
      name: "target player supplied",
      state: withTarget,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: withTarget.players[0].id,
        recipeId: "diy_h2o_from_h_oh",
        componentCardInstanceIds: ["ion_h_01", "ion_oh_01"],
        targetPlayerId: withTarget.players[1].id,
      },
    });

    let nonActive = createInitialGame({ shuffle: identityShuffle });
    nonActive = addStatusForTest(nonActive, nonActive.players[1].id, "FIRE");
    nonActive = putH2oComponentsInHand(nonActive, nonActive.players[1].id);
    cases.push({
      name: "non-active player",
      state: nonActive,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: nonActive.players[1].id,
        recipeId: "diy_h2o_from_h_oh",
        componentCardInstanceIds: ["ion_h_01", "ion_oh_01"],
      },
    });

    let statusWindow = createReadyH2oState();
    statusWindow = {
      ...statusWindow,
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId: statusWindow.players[0].id,
        statusInstanceId: "status_test_FIRE_1",
      },
    };
    cases.push({
      name: "statusWindow",
      state: statusWindow,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: statusWindow.players[0].id,
        recipeId: "diy_h2o_from_h_oh",
        componentCardInstanceIds: ["ion_h_01", "ion_oh_01"],
      },
    });

    let responseWindow = createReadyH2oState();
    responseWindow = { ...responseWindow, phase: "responseWindow" };
    cases.push({
      name: "responseWindow",
      state: responseWindow,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: responseWindow.players[0].id,
        recipeId: "diy_h2o_from_h_oh",
        componentCardInstanceIds: ["ion_h_01", "ion_oh_01"],
      },
    });

    let gameOver = createReadyH2oState();
    gameOver = { ...gameOver, phase: "gameOver", winnerPlayerId: gameOver.players[0].id };
    cases.push({
      name: "gameOver",
      state: gameOver,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: gameOver.players[0].id,
        recipeId: "diy_h2o_from_h_oh",
        componentCardInstanceIds: ["ion_h_01", "ion_oh_01"],
      },
    });

    for (const { state, action } of cases) {
      const rejected = engineReducer(state, action);
      expect(rejected).toBe(state);
      expectNoCoreSideEffects(rejected, state);
      expect(rejected.discardPile).not.toContain("ion_h_01");
      expect(rejected.discardPile).not.toContain("ion_oh_01");
      expect(rejected.log.some((entry) => entry.message.includes("主动 DIY 生成 H2O"))).toBe(false);
      expectTotalCardInstances(rejected);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("cleans up exactly once after final third-round H+ + OH- DIY", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const finalActor = state.players[1];
    state = addStatusForTest(state, finalActor.id, "FIRE");
    state = putH2oComponentsInHand(state, finalActor.id);
    state = {
      ...state,
      activePlayerId: finalActor.id,
      roundInCycle: 3,
    };

    state = startH2oDIY(state, finalActor.id);

    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.phase).toBe("mainAction");
    expect(state.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_h_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("allows only one successful active DIY per cycle and resets after cleanup", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const playerId = state.players[0].id;
    state = addStatusForTest(state, playerId, "FIRE");
    state = putCo2ComponentsInHand(state, playerId);

    state = startCo2DIY(state, playerId);
    expect(state.players[0].usedDIYThisCycle).toBe(true);

    let sameCycleAttempt: GameState = {
      ...state,
      activePlayerId: playerId,
      phase: "mainAction",
      pendingStatusHandling: undefined,
    };
    sameCycleAttempt = addStatusForTest(sameCycleAttempt, playerId, "FIRE", 2);
    sameCycleAttempt = putCo2ComponentsInHand(sameCycleAttempt, playerId);

    const rejected = startCo2DIY(sameCycleAttempt, playerId);
    expect(rejected).toBe(sameCycleAttempt);
    expectNoCoreSideEffects(rejected, sameCycleAttempt);
    expectCardZonesToBeConsistent(rejected);

    state = passCurrentAction(state);
    state = passCurrentAction(state);
    state = passCurrentAction(state);
    state = passCurrentAction(state);
    state = passCurrentAction(state);
    expect(state.cycleNumber).toBe(2);
    expect(state.players[0].usedDIYThisCycle).toBe(false);

    state = addStatusForTest(state, playerId, "FIRE", 3);
    state = putCo2ComponentsInHand(state, playerId);
    state = startCo2DIY(state, playerId);

    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expect(state.players[0].statuses.some((status) => status.statusId === "FIRE")).toBe(false);
    expectCardZonesToBeConsistent(state);
  });

  it("resets both players' usedDIYThisCycle flags after cleanup", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    state = updatePlayer(state, state.players[0].id, (player) => ({
      ...player,
      usedDIYThisCycle: true,
    }));
    state = updatePlayer(state, state.players[1].id, (player) => ({
      ...player,
      usedDIYThisCycle: true,
    }));

    state = passCurrentAction(state);
    state = passCurrentAction(state);
    state = passCurrentAction(state);
    state = passCurrentAction(state);
    state = passCurrentAction(state);
    state = passCurrentAction(state);

    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.players[0].usedDIYThisCycle).toBe(false);
    expect(state.players[1].usedDIYThisCycle).toBe(false);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("rejects invalid active DIY calls without side effects", () => {
    const createReadySo2State = () => {
      let state = createInitialGame({ shuffle: identityShuffle });
      state = putSo2ComponentsInHand(state, state.players[0].id);
      return state;
    };

    const cases: { name: string; state: GameState; action: Parameters<typeof engineReducer>[1] }[] = [];

    let nonActive = createReadySo2State();
    cases.push({
      name: "non-active player",
      state: nonActive,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: nonActive.players[1].id,
        recipeId: "diy_so2_from_s_o_o",
        componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_02"],
        targetPlayerId: nonActive.players[0].id,
      },
    });

    let nonMainAction = createReadySo2State();
    nonMainAction = { ...nonMainAction, phase: "responseWindow" };
    cases.push({
      name: "non-main phase",
      state: nonMainAction,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: nonMainAction.players[0].id,
        recipeId: "diy_so2_from_s_o_o",
        componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_02"],
        targetPlayerId: nonMainAction.players[1].id,
      },
    });

    let eliminated = createReadySo2State();
    eliminated = updatePlayer(eliminated, eliminated.players[0].id, (player) => ({
      ...player,
      hp: 0,
      eliminated: true,
    }));
    cases.push({
      name: "eliminated player",
      state: eliminated,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: eliminated.players[0].id,
        recipeId: "diy_so2_from_s_o_o",
        componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_02"],
        targetPlayerId: eliminated.players[1].id,
      },
    });

    let gameOver = createReadySo2State();
    gameOver = { ...gameOver, phase: "gameOver", winnerPlayerId: gameOver.players[0].id };
    cases.push({
      name: "gameOver",
      state: gameOver,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: gameOver.players[0].id,
        recipeId: "diy_so2_from_s_o_o",
        componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_02"],
        targetPlayerId: gameOver.players[1].id,
      },
    });

    let wrongRecipe = createReadySo2State();
    cases.push({
      name: "wrong recipe id",
      state: wrongRecipe,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: wrongRecipe.players[0].id,
        recipeId: "diy_co2_from_c_o_o",
        componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_02"],
        targetPlayerId: wrongRecipe.players[1].id,
      },
    });

    let wrongComponents = createInitialGame({ shuffle: identityShuffle });
    wrongComponents = putCardInHand(wrongComponents, wrongComponents.players[0].id, "element_c_01");
    wrongComponents = putCardInHand(wrongComponents, wrongComponents.players[0].id, "element_o_01");
    wrongComponents = putCardInHand(wrongComponents, wrongComponents.players[0].id, "element_s_01");
    cases.push({
      name: "wrong component combo",
      state: wrongComponents,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: wrongComponents.players[0].id,
        recipeId: "diy_co2_from_c_o_o",
        componentCardInstanceIds: ["element_c_01", "element_o_01", "element_s_01"],
      },
    });

    let duplicateComponent = createReadySo2State();
    cases.push({
      name: "duplicate component id",
      state: duplicateComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: duplicateComponent.players[0].id,
        recipeId: "diy_so2_from_s_o_o",
        componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_01"],
        targetPlayerId: duplicateComponent.players[1].id,
      },
    });

    let missingComponent = createReadySo2State();
    missingComponent = updatePlayer(missingComponent, missingComponent.players[0].id, (player) => ({
      ...player,
      hand: player.hand.filter((cardId) => cardId !== "element_o_02"),
    }));
    missingComponent = {
      ...missingComponent,
      cardInstances: {
        ...missingComponent.cardInstances,
        element_o_02: {
          ...missingComponent.cardInstances.element_o_02,
          ownerId: undefined,
          zone: { type: "deck" },
        },
      },
      deck: [...missingComponent.deck, "element_o_02"],
    };
    cases.push({
      name: "component not in hand",
      state: missingComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: missingComponent.players[0].id,
        recipeId: "diy_so2_from_s_o_o",
        componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_02"],
        targetPlayerId: missingComponent.players[1].id,
      },
    });

    for (const targetCase of [
      { name: "self target", targetPlayerId: "player_1" },
      { name: "missing target", targetPlayerId: undefined },
      { name: "unknown target", targetPlayerId: "player_missing" },
    ] satisfies { name: string; targetPlayerId?: string }[]) {
      const state = createReadySo2State();
      cases.push({
        name: targetCase.name,
        state,
        action: {
          type: "START_ACTIVE_DIY",
          playerId: state.players[0].id,
          recipeId: "diy_so2_from_s_o_o",
          componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_02"],
          targetPlayerId: targetCase.targetPlayerId,
        },
      });
    }

    let eliminatedTarget = createReadySo2State();
    eliminatedTarget = updatePlayer(eliminatedTarget, eliminatedTarget.players[1].id, (player) => ({
      ...player,
      hp: 0,
      eliminated: true,
    }));
    cases.push({
      name: "eliminated target",
      state: eliminatedTarget,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: eliminatedTarget.players[0].id,
        recipeId: "diy_so2_from_s_o_o",
        componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_02"],
        targetPlayerId: eliminatedTarget.players[1].id,
      },
    });

    for (const { state, action } of cases) {
      const rejected = engineReducer(state, action);
      expect(rejected).toBe(state);
      expectNoCoreSideEffects(rejected, state);
      expectCardZonesToBeConsistent(rejected);
    }
  });
});
