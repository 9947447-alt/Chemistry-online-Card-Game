import { describe, expect, it } from "vitest";
import { starterDeckSize } from "../data/starterDeck";
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

function putHclDIYComponentsInHand(state: GameState, playerId: PlayerId): GameState {
  let nextState = putCardInHand(state, playerId, "ion_h_01");
  return putCardInHand(nextState, playerId, "ion_cl_01");
}

function putH2so4DIYComponentsInHand(state: GameState, playerId: PlayerId): GameState {
  let nextState = putCardInHand(state, playerId, "ion_h_01");
  nextState = putCardInHand(nextState, playerId, "ion_h_02");
  return putCardInHand(nextState, playerId, "ion_so4_01");
}

function putNaohDIYComponentsInHand(state: GameState, playerId: PlayerId): GameState {
  let nextState = putCardInHand(state, playerId, "ion_na_01");
  return putCardInHand(nextState, playerId, "ion_oh_01");
}

function putKohDIYComponentsInHand(state: GameState, playerId: PlayerId): GameState {
  let nextState = putCardInHand(state, playerId, "ion_k_01");
  return putCardInHand(nextState, playerId, "ion_oh_01");
}

function putLimewaterDIYComponentsInHand(state: GameState, playerId: PlayerId): GameState {
  let nextState = putCardInHand(state, playerId, "ion_ca_01");
  nextState = putCardInHand(nextState, playerId, "ion_oh_01");
  return putCardInHand(nextState, playerId, "ion_oh_02");
}

function countCardDefinition(state: GameState, definitionId: string): number {
  return Object.values(state.cardInstances).filter(
    (cardInstance) => cardInstance.definitionId === definitionId,
  ).length;
}

function expectTotalCardInstances(state: GameState): void {
  expect(Object.keys(state.cardInstances)).toHaveLength(starterDeckSize);
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

function startHclAttackDIY(
  state: GameState,
  playerId: PlayerId,
  targetPlayerId: PlayerId,
): GameState {
  return engineReducer(state, {
    type: "START_ACTIVE_DIY",
    playerId,
    recipeId: "diy_hcl_from_h_cl",
    componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
    targetPlayerId,
  });
}

function startH2so4AttackDIY(
  state: GameState,
  playerId: PlayerId,
  targetPlayerId: PlayerId,
): GameState {
  return engineReducer(state, {
    type: "START_ACTIVE_DIY",
    playerId,
    recipeId: "diy_h2so4_from_2h_so4",
    componentCardInstanceIds: ["ion_h_01", "ion_h_02", "ion_so4_01"],
    targetPlayerId,
  });
}

function startNaohAttackDIY(
  state: GameState,
  playerId: PlayerId,
  targetPlayerId: PlayerId,
): GameState {
  return engineReducer(state, {
    type: "START_ACTIVE_DIY",
    playerId,
    recipeId: "diy_naoh_from_na_oh",
    componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
    targetPlayerId,
  });
}

function startKohAttackDIY(
  state: GameState,
  playerId: PlayerId,
  targetPlayerId: PlayerId,
): GameState {
  return engineReducer(state, {
    type: "START_ACTIVE_DIY",
    playerId,
    recipeId: "diy_koh_from_k_oh",
    componentCardInstanceIds: ["ion_k_01", "ion_oh_01"],
    targetPlayerId,
  });
}

function startLimewaterAttackDIY(
  state: GameState,
  playerId: PlayerId,
  targetPlayerId: PlayerId,
): GameState {
  return engineReducer(state, {
    type: "START_ACTIVE_DIY",
    playerId,
    recipeId: "diy_limewater_from_ca_2oh",
    componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
    targetPlayerId,
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

  it("cleans up exactly once after final third-round C + O + O DIY", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const finalActor = state.players[1];
    state = addStatusForTest(state, finalActor.id, "FIRE");
    state = putCo2ComponentsInHand(state, finalActor.id);
    const initialCo2Count = countCardDefinition(state, "substance_co2");

    state = {
      ...state,
      activePlayerId: finalActor.id,
      roundInCycle: 3,
    };

    state = startCo2DIY(state, finalActor.id);

    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.phase).toBe("mainAction");
    expect(state.players[1].statuses.some((status) => status.statusId === "FIRE")).toBe(false);
    expect(state.players.every((player) => player.usedDIYThisCycle === false)).toBe(true);
    expect(state.log.filter((entry) => entry.message.includes("主动 DIY 生成 CO2 并移除 FIRE"))).toHaveLength(1);
    expect(state.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(state.log.filter((entry) => entry.message.includes("进入第 2 实验周期"))).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "element_c_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "element_o_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "element_o_02")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_co2")).toBe(initialCo2Count);
    expect(state.players[0].hand).toHaveLength(10);
    expect(state.players[1].hand).toHaveLength(10);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("cleans up exactly once after final third-round S + O + O DIY", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const finalActor = state.players[1];
    const target = state.players[0];
    state = putSo2ComponentsInHand(state, finalActor.id);
    const initialSo2Count = countCardDefinition(state, "substance_so2");

    state = {
      ...state,
      activePlayerId: finalActor.id,
      roundInCycle: 3,
    };

    state = startSo2DIY(state, finalActor.id, target.id);

    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.phase).toBe("statusWindow");
    expect(state.activePlayerId).toBe(target.id);
    expect(state.pendingResponse).toBeUndefined();
    expect(state.pendingStatusHandling?.playerId).toBe(target.id);
    expect(state.pendingStatusHandling?.statusInstanceId).toBe(state.players[0].statuses[0].id);
    expect(state.players[0].statuses).toHaveLength(1);
    expect(state.players[0].statuses[0].statusId).toBe("SO2_LEAK");
    expect(state.players[0].hp).toBe(10);
    expect(state.players[1].usedDIYThisCycle).toBe(false);
    expect(state.log.filter((entry) => entry.message.includes("主动 DIY 生成 SO2"))).toHaveLength(1);
    expect(state.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(state.log.filter((entry) => entry.message.includes("进入第 2 实验周期"))).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "element_s_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "element_o_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "element_o_02")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_so2")).toBe(initialSo2Count);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("starts H+ + Cl- active DIY as a virtual acid attack", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;
    state = putHclDIYComponentsInHand(state, player.id);
    const initialHclCount = countCardDefinition(state, "substance_hcl_dilute");

    state = startHclAttackDIY(state, player.id, target.id);

    expect(state.phase).toBe("responseWindow");
    expect(state.activePlayerId).toBe(player.id);
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expect(state.pendingResponse?.responderId).toBe(target.id);
    expect(state.pendingResponse?.sourceEffect).toMatchObject({
      type: "DAMAGE",
      context: {
        source: {
          kind: "diy",
          sourcePlayerId: player.id,
          recipeId: "diy_hcl_from_h_cl",
        },
        targetPlayerId: target.id,
        baseAmount: 1,
        tags: ["acid"],
        responsePolicy: "acid-base",
      },
    });
    expect(state.discardPile.filter((cardId) => cardId === "ion_h_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_cl_01")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_hcl_dilute")).toBe(initialHclCount);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("starts 2H+ + SO4^2- active DIY as a virtual acid attack", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;
    state = putH2so4DIYComponentsInHand(state, player.id);
    const initialH2so4Count = countCardDefinition(state, "substance_h2so4_dilute");

    state = startH2so4AttackDIY(state, player.id, target.id);

    expect(state.phase).toBe("responseWindow");
    expect(state.activePlayerId).toBe(player.id);
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expect(state.pendingResponse?.responderId).toBe(target.id);
    expect(state.pendingResponse?.sourceEffect).toMatchObject({
      type: "DAMAGE",
      context: {
        source: {
          kind: "diy",
          sourcePlayerId: player.id,
          recipeId: "diy_h2so4_from_2h_so4",
        },
        targetPlayerId: target.id,
        baseAmount: 1,
        tags: ["acid"],
        responsePolicy: "acid-base",
      },
    });
    expect(state.discardPile.filter((cardId) => cardId === "ion_h_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_h_02")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_so4_01")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_h2so4_dilute")).toBe(initialH2so4Count);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("resolves acid attack DIY through neutralization, carbonate responses, and pass", () => {
    const recipes = [
      {
        name: "HCl",
        prepare: putHclDIYComponentsInHand,
        start: startHclAttackDIY,
        recipeId: "diy_hcl_from_h_cl",
        materialDefinitionId: "substance_hcl_dilute",
        components: ["ion_h_01", "ion_cl_01"] as const,
      },
      {
        name: "H2SO4",
        prepare: putH2so4DIYComponentsInHand,
        start: startH2so4AttackDIY,
        recipeId: "diy_h2so4_from_2h_so4",
        materialDefinitionId: "substance_h2so4_dilute",
        components: ["ion_h_01", "ion_h_02", "ion_so4_01"] as const,
      },
    ];

    const responseCases: {
      name: string;
      responseCardId?: CardInstanceId;
      expectedHp: number;
      expectedLog: string;
    }[] = [
      {
        name: "base neutralization",
        responseCardId: "substance_naoh_dilute_01",
        expectedHp: 10,
        expectedLog: "中和",
      },
      {
        name: "CO3^2-",
        responseCardId: "ion_co3_01",
        expectedHp: 10,
        expectedLog: "生成 CO2",
      },
      {
        name: "Na2CO3",
        responseCardId: "substance_na2co3_01",
        expectedHp: 10,
        expectedLog: "生成 CO2",
      },
      {
        name: "pass",
        expectedHp: 9,
        expectedLog: "放弃响应",
      },
    ];

    for (const recipe of recipes) {
      for (const responseCase of responseCases) {
        let state = createInitialGame({ shuffle: identityShuffle });
        const [player, target] = state.players;
        state = recipe.prepare(state, player.id);
        if (responseCase.responseCardId) {
          state = putCardInHand(state, target.id, responseCase.responseCardId);
        }
        const initialMaterialCount = countCardDefinition(state, recipe.materialDefinitionId);
        const initialCo2Count = countCardDefinition(state, "substance_co2");

        state = recipe.start(state, player.id, target.id);
        expect(state.phase).toBe("responseWindow");
        expect(state.pendingResponse?.sourceEffect.context.source).toMatchObject({
          kind: "diy",
          recipeId: recipe.recipeId,
        });
        expectCardZonesToBeConsistent(state);

        if (responseCase.responseCardId) {
          state = engineReducer(state, {
            type: "RESPOND_WITH_CARD",
            playerId: target.id,
            cardInstanceId: responseCase.responseCardId,
          });
        } else {
          state = engineReducer(state, {
            type: "PASS_RESPONSE",
            playerId: target.id,
          });
        }

        expect(state.pendingResponse).toBeUndefined();
        expect(state.players[1].hp).toBe(responseCase.expectedHp);
        expect(state.activePlayerId).toBe(target.id);
        expect(state.roundInCycle).toBe(1);
        for (const componentId of recipe.components) {
          expect(state.discardPile.filter((cardId) => cardId === componentId)).toHaveLength(1);
        }
        if (responseCase.responseCardId) {
          expect(state.discardPile.filter((cardId) => cardId === responseCase.responseCardId)).toHaveLength(1);
        }
        expect(countCardDefinition(state, recipe.materialDefinitionId)).toBe(initialMaterialCount);
        expect(countCardDefinition(state, "substance_co2")).toBe(initialCo2Count);
        expect(state.log.some((entry) => entry.message.includes(responseCase.expectedLog))).toBe(true);
        expectTotalCardInstances(state);
        expectCardZonesToBeConsistent(state);
      }
    }
  });

  it("rejects invalid acid attack DIY calls without side effects", () => {
    const createReadyHclState = () => {
      let state = createInitialGame({ shuffle: identityShuffle });
      state = putHclDIYComponentsInHand(state, state.players[0].id);
      return state;
    };
    const createReadyH2so4State = () => {
      let state = createInitialGame({ shuffle: identityShuffle });
      state = putH2so4DIYComponentsInHand(state, state.players[0].id);
      return state;
    };

    const cases: { name: string; state: GameState; action: Parameters<typeof engineReducer>[1] }[] = [];

    let extraHclComponent = createReadyHclState();
    extraHclComponent = putCardInHand(extraHclComponent, extraHclComponent.players[0].id, "ion_h_02");
    cases.push({
      name: "HCl extra component",
      state: extraHclComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: extraHclComponent.players[0].id,
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01", "ion_h_02"],
        targetPlayerId: extraHclComponent.players[1].id,
      },
    });

    const missingHclComponent = createReadyHclState();
    cases.push({
      name: "HCl missing component",
      state: missingHclComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: missingHclComponent.players[0].id,
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: ["ion_h_01"],
        targetPlayerId: missingHclComponent.players[1].id,
      },
    });

    const missingH2so4Hydrogen = createReadyH2so4State();
    cases.push({
      name: "H2SO4 only one H+",
      state: missingH2so4Hydrogen,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: missingH2so4Hydrogen.players[0].id,
        recipeId: "diy_h2so4_from_2h_so4",
        componentCardInstanceIds: ["ion_h_01", "ion_so4_01"],
        targetPlayerId: missingH2so4Hydrogen.players[1].id,
      },
    });

    const duplicateH2so4Hydrogen = createReadyH2so4State();
    cases.push({
      name: "H2SO4 duplicate H+ instance",
      state: duplicateH2so4Hydrogen,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: duplicateH2so4Hydrogen.players[0].id,
        recipeId: "diy_h2so4_from_2h_so4",
        componentCardInstanceIds: ["ion_h_01", "ion_h_01", "ion_so4_01"],
        targetPlayerId: duplicateH2so4Hydrogen.players[1].id,
      },
    });

    const mismatchedRecipe = createReadyHclState();
    cases.push({
      name: "recipe id mismatch",
      state: mismatchedRecipe,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: mismatchedRecipe.players[0].id,
        recipeId: "diy_h2so4_from_2h_so4",
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
        targetPlayerId: mismatchedRecipe.players[1].id,
      },
    });

    for (const targetCase of [
      { name: "self target", targetPlayerId: "player_1" },
      { name: "missing target", targetPlayerId: undefined },
      { name: "unknown target", targetPlayerId: "player_missing" },
    ] satisfies { name: string; targetPlayerId?: string }[]) {
      const state = createReadyHclState();
      cases.push({
        name: targetCase.name,
        state,
        action: {
          type: "START_ACTIVE_DIY",
          playerId: state.players[0].id,
          recipeId: "diy_hcl_from_h_cl",
          componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
          targetPlayerId: targetCase.targetPlayerId,
        },
      });
    }

    let eliminatedTarget = createReadyHclState();
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
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
        targetPlayerId: eliminatedTarget.players[1].id,
      },
    });

    let nonActive = createInitialGame({ shuffle: identityShuffle });
    nonActive = putHclDIYComponentsInHand(nonActive, nonActive.players[1].id);
    cases.push({
      name: "non-active player",
      state: nonActive,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: nonActive.players[1].id,
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
        targetPlayerId: nonActive.players[0].id,
      },
    });

    let statusWindow = createReadyHclState();
    statusWindow = { ...statusWindow, phase: "statusWindow" };
    cases.push({
      name: "statusWindow",
      state: statusWindow,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: statusWindow.players[0].id,
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
        targetPlayerId: statusWindow.players[1].id,
      },
    });

    let responseWindow = createReadyHclState();
    responseWindow = { ...responseWindow, phase: "responseWindow" };
    cases.push({
      name: "responseWindow",
      state: responseWindow,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: responseWindow.players[0].id,
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
        targetPlayerId: responseWindow.players[1].id,
      },
    });

    let gameOver = createReadyHclState();
    gameOver = { ...gameOver, phase: "gameOver", winnerPlayerId: gameOver.players[0].id };
    cases.push({
      name: "gameOver",
      state: gameOver,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: gameOver.players[0].id,
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
        targetPlayerId: gameOver.players[1].id,
      },
    });

    let usedThisCycle = createReadyHclState();
    usedThisCycle = updatePlayer(usedThisCycle, usedThisCycle.players[0].id, (player) => ({
      ...player,
      usedDIYThisCycle: true,
    }));
    cases.push({
      name: "used DIY this cycle",
      state: usedThisCycle,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: usedThisCycle.players[0].id,
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
        targetPlayerId: usedThisCycle.players[1].id,
      },
    });

    for (const { state, action } of cases) {
      const rejected = engineReducer(state, action);
      expect(rejected).toBe(state);
      expectNoCoreSideEffects(rejected, state);
      expect(rejected.pendingResponse).toBe(state.pendingResponse);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("cleans up exactly once after final third-round acid attack DIY responses", () => {
    let responded = createInitialGame({ shuffle: identityShuffle });
    const respondedActor = responded.players[1];
    const respondedTarget = responded.players[0];
    responded = putHclDIYComponentsInHand(responded, respondedActor.id);
    responded = putCardInHand(responded, respondedTarget.id, "substance_na2co3_01");
    responded = {
      ...responded,
      activePlayerId: respondedActor.id,
      roundInCycle: 3,
    };

    responded = startHclAttackDIY(responded, respondedActor.id, respondedTarget.id);
    responded = engineReducer(responded, {
      type: "RESPOND_WITH_CARD",
      playerId: respondedTarget.id,
      cardInstanceId: "substance_na2co3_01",
    });

    expect(responded.pendingResponse).toBeUndefined();
    expect(responded.cycleNumber).toBe(2);
    expect(responded.roundInCycle).toBe(1);
    expect(responded.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(responded.discardPile.filter((cardId) => cardId === "ion_h_01")).toHaveLength(1);
    expect(responded.discardPile.filter((cardId) => cardId === "ion_cl_01")).toHaveLength(1);
    expect(responded.discardPile.filter((cardId) => cardId === "substance_na2co3_01")).toHaveLength(1);
    expectTotalCardInstances(responded);
    expectCardZonesToBeConsistent(responded);

    let passed = createInitialGame({ shuffle: identityShuffle });
    const passedActor = passed.players[1];
    const passedTarget = passed.players[0];
    passed = putH2so4DIYComponentsInHand(passed, passedActor.id);
    passed = {
      ...passed,
      activePlayerId: passedActor.id,
      roundInCycle: 3,
    };

    passed = startH2so4AttackDIY(passed, passedActor.id, passedTarget.id);
    passed = engineReducer(passed, {
      type: "PASS_RESPONSE",
      playerId: passedTarget.id,
    });

    expect(passed.pendingResponse).toBeUndefined();
    expect(passed.players[0].hp).toBe(9);
    expect(passed.cycleNumber).toBe(2);
    expect(passed.roundInCycle).toBe(1);
    expect(passed.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(passed.discardPile.filter((cardId) => cardId === "ion_h_01")).toHaveLength(1);
    expect(passed.discardPile.filter((cardId) => cardId === "ion_h_02")).toHaveLength(1);
    expect(passed.discardPile.filter((cardId) => cardId === "ion_so4_01")).toHaveLength(1);
    expectTotalCardInstances(passed);
    expectCardZonesToBeConsistent(passed);
  });

  it("cleans up exactly once after a final third-round acid attack DIY is neutralized by base", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const actor = state.players[1];
    const target = state.players[0];
    state = putHclDIYComponentsInHand(state, actor.id);
    state = putCardInHand(state, target.id, "substance_koh_dilute_01");
    state = {
      ...state,
      activePlayerId: actor.id,
      roundInCycle: 3,
    };

    state = startHclAttackDIY(state, actor.id, target.id);
    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: target.id,
      cardInstanceId: "substance_koh_dilute_01",
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_h_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_cl_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "substance_koh_dilute_01")).toHaveLength(1);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("starts Na+ + OH- active DIY as a virtual base attack", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;
    state = putNaohDIYComponentsInHand(state, player.id);
    const initialNaohCount = countCardDefinition(state, "substance_naoh_dilute");

    state = startNaohAttackDIY(state, player.id, target.id);

    expect(state.phase).toBe("responseWindow");
    expect(state.activePlayerId).toBe(player.id);
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expect(state.players[1].hp).toBe(10);
    expect(state.pendingResponse?.responderId).toBe(target.id);
    expect(state.pendingResponse?.sourceEffect).toMatchObject({
      type: "DAMAGE",
      context: {
        source: {
          kind: "diy",
          sourcePlayerId: player.id,
          recipeId: "diy_naoh_from_na_oh",
        },
        targetPlayerId: target.id,
        baseAmount: 1,
        tags: ["base"],
        responsePolicy: "acid-base",
      },
    });
    expect(state.pendingResponse?.sourceEffect.context.source).toMatchObject({ kind: "diy" });
    expect(state.discardPile.filter((cardId) => cardId === "ion_na_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_naoh_dilute")).toBe(initialNaohCount);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("starts K+ + OH- active DIY as a virtual base attack", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;
    state = putKohDIYComponentsInHand(state, player.id);
    const initialKohCount = countCardDefinition(state, "substance_koh_dilute");

    state = startKohAttackDIY(state, player.id, target.id);

    expect(state.phase).toBe("responseWindow");
    expect(state.activePlayerId).toBe(player.id);
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expect(state.players[1].hp).toBe(10);
    expect(state.pendingResponse?.responderId).toBe(target.id);
    expect(state.pendingResponse?.sourceEffect).toMatchObject({
      type: "DAMAGE",
      context: {
        source: {
          kind: "diy",
          sourcePlayerId: player.id,
          recipeId: "diy_koh_from_k_oh",
        },
        targetPlayerId: target.id,
        baseAmount: 1,
        tags: ["base"],
        responsePolicy: "acid-base",
      },
    });
    expect(state.pendingResponse?.sourceEffect.context.source).toMatchObject({ kind: "diy" });
    expect(state.discardPile.filter((cardId) => cardId === "ion_k_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_koh_dilute")).toBe(initialKohCount);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("resolves base attack DIY through acid neutralization or pass", () => {
    const recipes = [
      {
        name: "NaOH",
        prepare: putNaohDIYComponentsInHand,
        start: startNaohAttackDIY,
        recipeId: "diy_naoh_from_na_oh",
        materialDefinitionId: "substance_naoh_dilute",
        components: ["ion_na_01", "ion_oh_01"] as const,
      },
      {
        name: "KOH",
        prepare: putKohDIYComponentsInHand,
        start: startKohAttackDIY,
        recipeId: "diy_koh_from_k_oh",
        materialDefinitionId: "substance_koh_dilute",
        components: ["ion_k_01", "ion_oh_01"] as const,
      },
    ];

    const responseCases: {
      name: string;
      responseCardId?: CardInstanceId;
      expectedHp: number;
      expectedLog: string;
    }[] = [
      {
        name: "HCl neutralization",
        responseCardId: "substance_hcl_dilute_01",
        expectedHp: 10,
        expectedLog: "中和",
      },
      {
        name: "H2SO4 neutralization",
        responseCardId: "substance_h2so4_dilute_01",
        expectedHp: 10,
        expectedLog: "中和",
      },
      {
        name: "pass",
        expectedHp: 9,
        expectedLog: "放弃响应",
      },
    ];

    for (const recipe of recipes) {
      for (const responseCase of responseCases) {
        let state = createInitialGame({ shuffle: identityShuffle });
        const [player, target] = state.players;
        state = recipe.prepare(state, player.id);
        if (responseCase.responseCardId) {
          state = putCardInHand(state, target.id, responseCase.responseCardId);
        }
        const initialMaterialCount = countCardDefinition(state, recipe.materialDefinitionId);
        expectTotalCardInstances(state);
        expectCardZonesToBeConsistent(state);

        state = recipe.start(state, player.id, target.id);
        expect(state.phase).toBe("responseWindow");
        expect(state.pendingResponse?.sourceEffect).toMatchObject({
          type: "DAMAGE",
          context: {
            source: {
              kind: "diy",
              recipeId: recipe.recipeId,
            },
            tags: ["base"],
          },
        });
        for (const componentId of recipe.components) {
          expect(state.discardPile.filter((cardId) => cardId === componentId)).toHaveLength(1);
        }
        expectCardZonesToBeConsistent(state);

        if (responseCase.responseCardId) {
          state = engineReducer(state, {
            type: "RESPOND_WITH_CARD",
            playerId: target.id,
            cardInstanceId: responseCase.responseCardId,
          });
        } else {
          state = engineReducer(state, {
            type: "PASS_RESPONSE",
            playerId: target.id,
          });
        }

        expect(state.pendingResponse).toBeUndefined();
        expect(state.players[1].hp).toBe(responseCase.expectedHp);
        expect(state.activePlayerId).toBe(target.id);
        expect(state.roundInCycle).toBe(1);
        for (const componentId of recipe.components) {
          expect(state.discardPile.filter((cardId) => cardId === componentId)).toHaveLength(1);
        }
        if (responseCase.responseCardId) {
          expect(state.discardPile.filter((cardId) => cardId === responseCase.responseCardId)).toHaveLength(1);
        }
        expect(countCardDefinition(state, recipe.materialDefinitionId)).toBe(initialMaterialCount);
        expect(state.log.some((entry) => entry.message.includes(responseCase.expectedLog))).toBe(true);
        expectTotalCardInstances(state);
        expectCardZonesToBeConsistent(state);
      }
    }
  });

  it("rejects carbonate and base responses to base attack DIY without side effects", () => {
    const responseCases: CardInstanceId[] = [
      "ion_co3_01",
      "substance_na2co3_01",
      "substance_naoh_dilute_01",
      "substance_koh_dilute_01",
    ];

    for (const responseCardId of responseCases) {
      let state = createInitialGame({ shuffle: identityShuffle });
      const [player, target] = state.players;
      state = putNaohDIYComponentsInHand(state, player.id);
      state = putCardInHand(state, target.id, responseCardId);
      state = startNaohAttackDIY(state, player.id, target.id);
      expect(state.phase).toBe("responseWindow");
      expect(state.pendingResponse?.sourceEffect.context.tags).toEqual(["base"]);
      expectCardZonesToBeConsistent(state);

      const rejected = engineReducer(state, {
        type: "RESPOND_WITH_CARD",
        playerId: target.id,
        cardInstanceId: responseCardId,
      });

      expect(rejected).toBe(state);
      expect(rejected.pendingResponse).toBe(state.pendingResponse);
      expect(rejected.players[1].hp).toBe(10);
      expect(rejected.players[1].hand).toContain(responseCardId);
      expect(rejected.discardPile.filter((cardId) => cardId === "ion_na_01")).toHaveLength(1);
      expect(rejected.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
      expect(rejected.discardPile).not.toContain(responseCardId);
      expect(rejected.log.some((entry) => entry.message.includes("生成 CO2"))).toBe(false);
      expectTotalCardInstances(rejected);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("rejects invalid base attack DIY calls without side effects", () => {
    const createReadyNaohState = () => {
      let state = createInitialGame({ shuffle: identityShuffle });
      state = putNaohDIYComponentsInHand(state, state.players[0].id);
      return state;
    };
    const createReadyKohState = () => {
      let state = createInitialGame({ shuffle: identityShuffle });
      state = putKohDIYComponentsInHand(state, state.players[0].id);
      return state;
    };

    const cases: { name: string; state: GameState; action: Parameters<typeof engineReducer>[1] }[] = [];

    const missingComponent = createReadyNaohState();
    cases.push({
      name: "missing OH- component",
      state: missingComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: missingComponent.players[0].id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_na_01"],
        targetPlayerId: missingComponent.players[1].id,
      },
    });

    let extraComponent = createReadyNaohState();
    extraComponent = putCardInHand(extraComponent, extraComponent.players[0].id, "ion_oh_02");
    cases.push({
      name: "extra OH- component",
      state: extraComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: extraComponent.players[0].id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_na_01", "ion_oh_01", "ion_oh_02"],
        targetPlayerId: extraComponent.players[1].id,
      },
    });

    const duplicateInstance = createReadyNaohState();
    cases.push({
      name: "duplicate component instance",
      state: duplicateInstance,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: duplicateInstance.players[0].id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_na_01", "ion_na_01"],
        targetPlayerId: duplicateInstance.players[1].id,
      },
    });

    const mismatchedRecipe = createReadyNaohState();
    cases.push({
      name: "recipe id mismatch",
      state: mismatchedRecipe,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: mismatchedRecipe.players[0].id,
        recipeId: "diy_koh_from_k_oh",
        componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
        targetPlayerId: mismatchedRecipe.players[1].id,
      },
    });

    const missingKohComponent = createReadyKohState();
    cases.push({
      name: "KOH missing K+ component",
      state: missingKohComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: missingKohComponent.players[0].id,
        recipeId: "diy_koh_from_k_oh",
        componentCardInstanceIds: ["ion_oh_01"],
        targetPlayerId: missingKohComponent.players[1].id,
      },
    });

    let extraKohComponent = createReadyKohState();
    extraKohComponent = putCardInHand(extraKohComponent, extraKohComponent.players[0].id, "ion_oh_02");
    cases.push({
      name: "KOH extra OH- component",
      state: extraKohComponent,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: extraKohComponent.players[0].id,
        recipeId: "diy_koh_from_k_oh",
        componentCardInstanceIds: ["ion_k_01", "ion_oh_01", "ion_oh_02"],
        targetPlayerId: extraKohComponent.players[1].id,
      },
    });

    const duplicateKohInstance = createReadyKohState();
    cases.push({
      name: "KOH duplicate component instance",
      state: duplicateKohInstance,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: duplicateKohInstance.players[0].id,
        recipeId: "diy_koh_from_k_oh",
        componentCardInstanceIds: ["ion_k_01", "ion_k_01"],
        targetPlayerId: duplicateKohInstance.players[1].id,
      },
    });

    for (const targetCase of [
      { name: "self target", targetPlayerId: "player_1" },
      { name: "missing target", targetPlayerId: undefined },
      { name: "unknown target", targetPlayerId: "player_missing" },
    ] satisfies { name: string; targetPlayerId?: string }[]) {
      const state = createReadyNaohState();
      cases.push({
        name: targetCase.name,
        state,
        action: {
          type: "START_ACTIVE_DIY",
          playerId: state.players[0].id,
          recipeId: "diy_naoh_from_na_oh",
          componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
          targetPlayerId: targetCase.targetPlayerId,
        },
      });
    }

    let eliminatedTarget = createReadyNaohState();
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
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
        targetPlayerId: eliminatedTarget.players[1].id,
      },
    });

    let eliminatedActor = createReadyNaohState();
    eliminatedActor = updatePlayer(eliminatedActor, eliminatedActor.players[0].id, (player) => ({
      ...player,
      hp: 0,
      eliminated: true,
    }));
    cases.push({
      name: "eliminated actor",
      state: eliminatedActor,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: eliminatedActor.players[0].id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
        targetPlayerId: eliminatedActor.players[1].id,
      },
    });

    let nonActive = createInitialGame({ shuffle: identityShuffle });
    nonActive = putNaohDIYComponentsInHand(nonActive, nonActive.players[1].id);
    cases.push({
      name: "non-active player",
      state: nonActive,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: nonActive.players[1].id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
        targetPlayerId: nonActive.players[0].id,
      },
    });

    let statusWindow = createReadyNaohState();
    statusWindow = { ...statusWindow, phase: "statusWindow" };
    cases.push({
      name: "statusWindow",
      state: statusWindow,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: statusWindow.players[0].id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
        targetPlayerId: statusWindow.players[1].id,
      },
    });

    let responseWindow = createReadyNaohState();
    responseWindow = { ...responseWindow, phase: "responseWindow" };
    cases.push({
      name: "responseWindow",
      state: responseWindow,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: responseWindow.players[0].id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
        targetPlayerId: responseWindow.players[1].id,
      },
    });

    let gameOver = createReadyNaohState();
    gameOver = { ...gameOver, phase: "gameOver", winnerPlayerId: gameOver.players[0].id };
    cases.push({
      name: "gameOver",
      state: gameOver,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: gameOver.players[0].id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
        targetPlayerId: gameOver.players[1].id,
      },
    });

    let usedThisCycle = createReadyNaohState();
    usedThisCycle = updatePlayer(usedThisCycle, usedThisCycle.players[0].id, (player) => ({
      ...player,
      usedDIYThisCycle: true,
    }));
    cases.push({
      name: "used DIY this cycle",
      state: usedThisCycle,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: usedThisCycle.players[0].id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
        targetPlayerId: usedThisCycle.players[1].id,
      },
    });

    for (const { state, action } of cases) {
      expectCardZonesToBeConsistent(state);
      const rejected = engineReducer(state, action);
      expect(rejected).toBe(state);
      expectNoCoreSideEffects(rejected, state);
      expect(rejected.pendingResponse).toBe(state.pendingResponse);
      expect(rejected.players[0].usedDIYThisCycle).toBe(state.players[0].usedDIYThisCycle);
      expect(rejected.discardPile).not.toContain("ion_na_01");
      expect(rejected.discardPile).not.toContain("ion_k_01");
      expect(rejected.discardPile).not.toContain("ion_oh_01");
      expect(rejected.log.some((entry) => entry.message.includes("主动 DIY 使用 Na+ + OH-"))).toBe(false);
      expect(rejected.log.some((entry) => entry.message.includes("主动 DIY 使用 K+ + OH-"))).toBe(false);
      expectTotalCardInstances(rejected);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("cleans up exactly once after final third-round base attack DIY responses", () => {
    let neutralized = createInitialGame({ shuffle: identityShuffle });
    const neutralizedActor = neutralized.players[1];
    const neutralizedTarget = neutralized.players[0];
    neutralized = putNaohDIYComponentsInHand(neutralized, neutralizedActor.id);
    neutralized = putCardInHand(neutralized, neutralizedTarget.id, "substance_hcl_dilute_01");
    neutralized = {
      ...neutralized,
      activePlayerId: neutralizedActor.id,
      roundInCycle: 3,
    };

    neutralized = startNaohAttackDIY(neutralized, neutralizedActor.id, neutralizedTarget.id);
    expectCardZonesToBeConsistent(neutralized);
    neutralized = engineReducer(neutralized, {
      type: "RESPOND_WITH_CARD",
      playerId: neutralizedTarget.id,
      cardInstanceId: "substance_hcl_dilute_01",
    });

    expect(neutralized.pendingResponse).toBeUndefined();
    expect(neutralized.players[0].hp).toBe(10);
    expect(neutralized.cycleNumber).toBe(2);
    expect(neutralized.roundInCycle).toBe(1);
    expect(neutralized.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(neutralized.discardPile.filter((cardId) => cardId === "ion_na_01")).toHaveLength(1);
    expect(neutralized.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expect(neutralized.discardPile.filter((cardId) => cardId === "substance_hcl_dilute_01")).toHaveLength(1);
    expectTotalCardInstances(neutralized);
    expectCardZonesToBeConsistent(neutralized);

    let passed = createInitialGame({ shuffle: identityShuffle });
    const passedActor = passed.players[1];
    const passedTarget = passed.players[0];
    passed = putKohDIYComponentsInHand(passed, passedActor.id);
    passed = {
      ...passed,
      activePlayerId: passedActor.id,
      roundInCycle: 3,
    };

    passed = startKohAttackDIY(passed, passedActor.id, passedTarget.id);
    expectCardZonesToBeConsistent(passed);
    passed = engineReducer(passed, {
      type: "PASS_RESPONSE",
      playerId: passedTarget.id,
    });

    expect(passed.pendingResponse).toBeUndefined();
    expect(passed.players[0].hp).toBe(9);
    expect(passed.cycleNumber).toBe(2);
    expect(passed.roundInCycle).toBe(1);
    expect(passed.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(passed.discardPile.filter((cardId) => cardId === "ion_k_01")).toHaveLength(1);
    expect(passed.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expectTotalCardInstances(passed);
    expectCardZonesToBeConsistent(passed);
  });

  it("starts Ca2+ + 2OH- active DIY as a virtual limewater base attack", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;
    state = putLimewaterDIYComponentsInHand(state, player.id);
    const initialLimewaterCount = countCardDefinition(state, "substance_caoh2_limewater");

    state = startLimewaterAttackDIY(state, player.id, target.id);

    expect(state.phase).toBe("responseWindow");
    expect(state.activePlayerId).toBe(player.id);
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expect(state.players[1].hp).toBe(10);
    expect(state.pendingResponse?.responderId).toBe(target.id);
    expect(state.pendingResponse?.sourceEffect).toMatchObject({
      type: "DAMAGE",
      context: {
        source: {
          kind: "diy",
          sourcePlayerId: player.id,
          recipeId: "diy_limewater_from_ca_2oh",
        },
        targetPlayerId: target.id,
        baseAmount: 1,
        tags: ["base"],
        responsePolicy: "acid-base",
      },
    });
    expect(state.discardPile.filter((cardId) => cardId === "ion_ca_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_oh_02")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_caoh2_limewater")).toBe(initialLimewaterCount);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("resolves limewater attack DIY through acid neutralization or pass", () => {
    const responseCases: {
      name: string;
      responseCardId?: CardInstanceId;
      expectedHp: number;
      expectedLog: string;
    }[] = [
      {
        name: "HCl neutralization",
        responseCardId: "substance_hcl_dilute_01",
        expectedHp: 10,
        expectedLog: "中和",
      },
      {
        name: "H2SO4 neutralization",
        responseCardId: "substance_h2so4_dilute_01",
        expectedHp: 10,
        expectedLog: "中和",
      },
      {
        name: "pass",
        expectedHp: 9,
        expectedLog: "放弃响应",
      },
    ];

    for (const responseCase of responseCases) {
      let state = createInitialGame({ shuffle: identityShuffle });
      const [player, target] = state.players;
      state = putLimewaterDIYComponentsInHand(state, player.id);
      if (responseCase.responseCardId) {
        state = putCardInHand(state, target.id, responseCase.responseCardId);
      }
      const initialLimewaterCount = countCardDefinition(state, "substance_caoh2_limewater");
      expectTotalCardInstances(state);
      expectCardZonesToBeConsistent(state);

      state = startLimewaterAttackDIY(state, player.id, target.id);
      expect(state.phase).toBe("responseWindow");
      expect(state.pendingResponse?.sourceEffect).toMatchObject({
        type: "DAMAGE",
        context: {
          source: {
            kind: "diy",
            recipeId: "diy_limewater_from_ca_2oh",
          },
          baseAmount: 1,
          tags: ["base"],
        },
      });
      expect(state.discardPile.filter((cardId) => cardId === "ion_ca_01")).toHaveLength(1);
      expect(state.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
      expect(state.discardPile.filter((cardId) => cardId === "ion_oh_02")).toHaveLength(1);
      expectCardZonesToBeConsistent(state);

      if (responseCase.responseCardId) {
        state = engineReducer(state, {
          type: "RESPOND_WITH_CARD",
          playerId: target.id,
          cardInstanceId: responseCase.responseCardId,
        });
      } else {
        state = engineReducer(state, {
          type: "PASS_RESPONSE",
          playerId: target.id,
        });

        const repeatedPass = engineReducer(state, {
          type: "PASS_RESPONSE",
          playerId: target.id,
        });
        expect(repeatedPass).toBe(state);
      }

      expect(state.pendingResponse).toBeUndefined();
      expect(state.players[1].hp).toBe(responseCase.expectedHp);
      expect(state.activePlayerId).toBe(target.id);
      expect(state.roundInCycle).toBe(1);
      expect(state.discardPile.filter((cardId) => cardId === "ion_ca_01")).toHaveLength(1);
      expect(state.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
      expect(state.discardPile.filter((cardId) => cardId === "ion_oh_02")).toHaveLength(1);
      if (responseCase.responseCardId) {
        expect(state.discardPile.filter((cardId) => cardId === responseCase.responseCardId)).toHaveLength(1);
      }
      expect(countCardDefinition(state, "substance_caoh2_limewater")).toBe(initialLimewaterCount);
      expect(state.log.some((entry) => entry.message.includes(responseCase.expectedLog))).toBe(true);
      expectTotalCardInstances(state);
      expectCardZonesToBeConsistent(state);
    }
  });

  it("rejects carbonate, OH-, and base responses to limewater attack DIY without side effects", () => {
    const responseCases: CardInstanceId[] = [
      "ion_co3_01",
      "substance_na2co3_01",
      "ion_oh_03",
      "substance_naoh_dilute_01",
      "substance_koh_dilute_01",
      "substance_caoh2_limewater_01",
    ];

    for (const responseCardId of responseCases) {
      let state = createInitialGame({ shuffle: identityShuffle });
      const [player, target] = state.players;
      state = putLimewaterDIYComponentsInHand(state, player.id);
      state = putCardInHand(state, target.id, responseCardId);
      state = startLimewaterAttackDIY(state, player.id, target.id);
      expect(state.phase).toBe("responseWindow");
      expect(state.pendingResponse?.sourceEffect.context.tags).toEqual(["base"]);
      expectCardZonesToBeConsistent(state);

      const rejected = engineReducer(state, {
        type: "RESPOND_WITH_CARD",
        playerId: target.id,
        cardInstanceId: responseCardId,
      });

      expect(rejected).toBe(state);
      expect(rejected.pendingResponse).toBe(state.pendingResponse);
      expect(rejected.players[1].hp).toBe(10);
      expect(rejected.players[1].hand).toContain(responseCardId);
      expect(rejected.discardPile.filter((cardId) => cardId === "ion_ca_01")).toHaveLength(1);
      expect(rejected.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
      expect(rejected.discardPile.filter((cardId) => cardId === "ion_oh_02")).toHaveLength(1);
      expect(rejected.discardPile).not.toContain(responseCardId);
      expect(rejected.log.some((entry) => entry.message.includes("生成 CO2"))).toBe(false);
      expectTotalCardInstances(rejected);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("rejects invalid limewater attack DIY calls without side effects", () => {
    const createReadyLimewaterState = () => {
      let state = createInitialGame({ shuffle: identityShuffle });
      state = putLimewaterDIYComponentsInHand(state, state.players[0].id);
      return state;
    };

    const cases: { name: string; state: GameState; action: Parameters<typeof engineReducer>[1] }[] = [];

    const onlyOneHydroxide = createReadyLimewaterState();
    cases.push({
      name: "only one OH-",
      state: onlyOneHydroxide,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: onlyOneHydroxide.players[0].id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_oh_01"],
        targetPlayerId: onlyOneHydroxide.players[1].id,
      },
    });

    let extraHydroxide = createReadyLimewaterState();
    extraHydroxide = putCardInHand(extraHydroxide, extraHydroxide.players[0].id, "ion_oh_03");
    cases.push({
      name: "extra third OH-",
      state: extraHydroxide,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: extraHydroxide.players[0].id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_02", "ion_oh_03"],
        targetPlayerId: extraHydroxide.players[1].id,
      },
    });

    let extraCalcium = createReadyLimewaterState();
    extraCalcium = putCardInHand(extraCalcium, extraCalcium.players[0].id, "ion_ca_02");
    cases.push({
      name: "extra Ca2+",
      state: extraCalcium,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: extraCalcium.players[0].id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_ca_02", "ion_oh_01", "ion_oh_02"],
        targetPlayerId: extraCalcium.players[1].id,
      },
    });

    const duplicateHydroxide = createReadyLimewaterState();
    cases.push({
      name: "duplicate OH- instance id",
      state: duplicateHydroxide,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: duplicateHydroxide.players[0].id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_01"],
        targetPlayerId: duplicateHydroxide.players[1].id,
      },
    });

    const missingCalcium = createReadyLimewaterState();
    cases.push({
      name: "missing Ca2+",
      state: missingCalcium,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: missingCalcium.players[0].id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_oh_01", "ion_oh_02"],
        targetPlayerId: missingCalcium.players[1].id,
      },
    });

    const mismatchedRecipe = createReadyLimewaterState();
    cases.push({
      name: "recipe id mismatch",
      state: mismatchedRecipe,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: mismatchedRecipe.players[0].id,
        recipeId: "diy_naoh_from_na_oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
        targetPlayerId: mismatchedRecipe.players[1].id,
      },
    });

    for (const targetCase of [
      { name: "self target", targetPlayerId: "player_1" },
      { name: "missing target", targetPlayerId: undefined },
      { name: "unknown target", targetPlayerId: "player_missing" },
    ] satisfies { name: string; targetPlayerId?: string }[]) {
      const state = createReadyLimewaterState();
      cases.push({
        name: targetCase.name,
        state,
        action: {
          type: "START_ACTIVE_DIY",
          playerId: state.players[0].id,
          recipeId: "diy_limewater_from_ca_2oh",
          componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
          targetPlayerId: targetCase.targetPlayerId,
        },
      });
    }

    let eliminatedTarget = createReadyLimewaterState();
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
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
        targetPlayerId: eliminatedTarget.players[1].id,
      },
    });

    let nonActive = createInitialGame({ shuffle: identityShuffle });
    nonActive = putLimewaterDIYComponentsInHand(nonActive, nonActive.players[1].id);
    cases.push({
      name: "non-active player",
      state: nonActive,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: nonActive.players[1].id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
        targetPlayerId: nonActive.players[0].id,
      },
    });

    let statusWindow = createReadyLimewaterState();
    statusWindow = { ...statusWindow, phase: "statusWindow" };
    cases.push({
      name: "statusWindow",
      state: statusWindow,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: statusWindow.players[0].id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
        targetPlayerId: statusWindow.players[1].id,
      },
    });

    let responseWindow = createReadyLimewaterState();
    responseWindow = { ...responseWindow, phase: "responseWindow" };
    cases.push({
      name: "responseWindow",
      state: responseWindow,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: responseWindow.players[0].id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
        targetPlayerId: responseWindow.players[1].id,
      },
    });

    let gameOver = createReadyLimewaterState();
    gameOver = { ...gameOver, phase: "gameOver", winnerPlayerId: gameOver.players[0].id };
    cases.push({
      name: "gameOver",
      state: gameOver,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: gameOver.players[0].id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
        targetPlayerId: gameOver.players[1].id,
      },
    });

    let usedThisCycle = createReadyLimewaterState();
    usedThisCycle = updatePlayer(usedThisCycle, usedThisCycle.players[0].id, (player) => ({
      ...player,
      usedDIYThisCycle: true,
    }));
    cases.push({
      name: "used DIY this cycle",
      state: usedThisCycle,
      action: {
        type: "START_ACTIVE_DIY",
        playerId: usedThisCycle.players[0].id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
        targetPlayerId: usedThisCycle.players[1].id,
      },
    });

    for (const { state, action } of cases) {
      expectCardZonesToBeConsistent(state);
      const rejected = engineReducer(state, action);
      expect(rejected).toBe(state);
      expectNoCoreSideEffects(rejected, state);
      expect(rejected.pendingResponse).toBe(state.pendingResponse);
      expect(rejected.discardPile).not.toContain("ion_ca_01");
      expect(rejected.discardPile).not.toContain("ion_oh_01");
      expect(rejected.discardPile).not.toContain("ion_oh_02");
      expect(rejected.log.some((entry) => entry.message.includes("主动 DIY 使用 Ca2+ + 2OH-"))).toBe(false);
      expectTotalCardInstances(rejected);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("cleans up exactly once after final third-round limewater attack DIY responses", () => {
    let neutralized = createInitialGame({ shuffle: identityShuffle });
    const neutralizedActor = neutralized.players[1];
    const neutralizedTarget = neutralized.players[0];
    neutralized = putLimewaterDIYComponentsInHand(neutralized, neutralizedActor.id);
    neutralized = putCardInHand(neutralized, neutralizedTarget.id, "substance_hcl_dilute_01");
    neutralized = {
      ...neutralized,
      activePlayerId: neutralizedActor.id,
      roundInCycle: 3,
    };

    neutralized = startLimewaterAttackDIY(neutralized, neutralizedActor.id, neutralizedTarget.id);
    expectCardZonesToBeConsistent(neutralized);
    neutralized = engineReducer(neutralized, {
      type: "RESPOND_WITH_CARD",
      playerId: neutralizedTarget.id,
      cardInstanceId: "substance_hcl_dilute_01",
    });

    expect(neutralized.pendingResponse).toBeUndefined();
    expect(neutralized.players[0].hp).toBe(10);
    expect(neutralized.cycleNumber).toBe(2);
    expect(neutralized.roundInCycle).toBe(1);
    expect(neutralized.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(neutralized.discardPile.filter((cardId) => cardId === "ion_ca_01")).toHaveLength(1);
    expect(neutralized.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expect(neutralized.discardPile.filter((cardId) => cardId === "ion_oh_02")).toHaveLength(1);
    expect(neutralized.discardPile.filter((cardId) => cardId === "substance_hcl_dilute_01")).toHaveLength(1);
    expectTotalCardInstances(neutralized);
    expectCardZonesToBeConsistent(neutralized);

    let passed = createInitialGame({ shuffle: identityShuffle });
    const passedActor = passed.players[1];
    const passedTarget = passed.players[0];
    passed = putLimewaterDIYComponentsInHand(passed, passedActor.id);
    passed = {
      ...passed,
      activePlayerId: passedActor.id,
      roundInCycle: 3,
    };

    passed = startLimewaterAttackDIY(passed, passedActor.id, passedTarget.id);
    expectCardZonesToBeConsistent(passed);
    passed = engineReducer(passed, {
      type: "PASS_RESPONSE",
      playerId: passedTarget.id,
    });

    expect(passed.pendingResponse).toBeUndefined();
    expect(passed.players[0].hp).toBe(9);
    expect(passed.cycleNumber).toBe(2);
    expect(passed.roundInCycle).toBe(1);
    expect(passed.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expect(passed.discardPile.filter((cardId) => cardId === "ion_ca_01")).toHaveLength(1);
    expect(passed.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expect(passed.discardPile.filter((cardId) => cardId === "ion_oh_02")).toHaveLength(1);
    expectTotalCardInstances(passed);
    expectCardZonesToBeConsistent(passed);
  });

  it("eliminates a 1 hp target who passes a limewater attack DIY and rejects later public actions", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [actor, target] = state.players;
    state = putLimewaterDIYComponentsInHand(state, actor.id);
    state = updatePlayer(state, target.id, (player) => ({ ...player, hp: 1 }));

    state = startLimewaterAttackDIY(state, actor.id, target.id);
    state = engineReducer(state, {
      type: "PASS_RESPONSE",
      playerId: target.id,
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.players[1]).toMatchObject({ hp: 0, eliminated: true });
    expect(state.phase).toBe("gameOver");
    expect(state.winnerPlayerId).toBe(actor.id);
    expect(state.discardPile.filter((cardId) => cardId === "ion_ca_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_oh_02")).toHaveLength(1);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);

    const actions: Parameters<typeof engineReducer>[1][] = [
      {
        type: "PLAY_CARD",
        playerId: actor.id,
        cardInstanceId: "substance_hcl_dilute_01",
        targetPlayerId: target.id,
      },
      { type: "RESPOND_WITH_CARD", playerId: target.id, cardInstanceId: "substance_hcl_dilute_01" },
      { type: "PASS_RESPONSE", playerId: target.id },
      {
        type: "HANDLE_STATUS_WITH_CARD",
        playerId: target.id,
        statusInstanceId: "status_missing",
        cardInstanceId: "substance_h2o_01",
      },
      { type: "PASS_STATUS_HANDLING", playerId: target.id, statusInstanceId: "status_missing" },
      { type: "PASS_ACTION", playerId: actor.id },
      {
        type: "START_ACTIVE_DIY",
        playerId: actor.id,
        recipeId: "diy_limewater_from_ca_2oh",
        componentCardInstanceIds: ["ion_ca_02", "ion_oh_03", "ion_oh_04"],
        targetPlayerId: target.id,
      },
    ];

    for (const action of actions) {
      const rejected = engineReducer(state, action);
      expect(rejected).toBe(state);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("eliminates a 1 hp target who passes an acid attack DIY and rejects later public actions", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [actor, target] = state.players;
    state = putHclDIYComponentsInHand(state, actor.id);
    state = updatePlayer(state, target.id, (player) => ({ ...player, hp: 1 }));

    state = startHclAttackDIY(state, actor.id, target.id);
    state = engineReducer(state, {
      type: "PASS_RESPONSE",
      playerId: target.id,
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.players[1]).toMatchObject({ hp: 0, eliminated: true });
    expect(state.phase).toBe("gameOver");
    expect(state.winnerPlayerId).toBe(actor.id);
    expect(state.discardPile.filter((cardId) => cardId === "ion_h_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_cl_01")).toHaveLength(1);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);

    const actions: Parameters<typeof engineReducer>[1][] = [
      {
        type: "PLAY_CARD",
        playerId: actor.id,
        cardInstanceId: "substance_hcl_dilute_01",
        targetPlayerId: target.id,
      },
      { type: "RESPOND_WITH_CARD", playerId: target.id, cardInstanceId: "substance_naoh_dilute_01" },
      { type: "PASS_RESPONSE", playerId: target.id },
      {
        type: "HANDLE_STATUS_WITH_CARD",
        playerId: target.id,
        statusInstanceId: "status_missing",
        cardInstanceId: "substance_h2o_01",
      },
      { type: "PASS_STATUS_HANDLING", playerId: target.id, statusInstanceId: "status_missing" },
      { type: "PASS_ACTION", playerId: actor.id },
      {
        type: "START_ACTIVE_DIY",
        playerId: actor.id,
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: ["ion_h_02", "ion_cl_02"],
        targetPlayerId: target.id,
      },
    ];

    for (const action of actions) {
      const rejected = engineReducer(state, action);
      expect(rejected).toBe(state);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("rejects H2SO4 active DIY with an extra SO4^2- without side effects", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [actor, target] = state.players;
    state = putH2so4DIYComponentsInHand(state, actor.id);
    state = putCardInHand(state, actor.id, "ion_so4_02");

    const rejected = engineReducer(state, {
      type: "START_ACTIVE_DIY",
      playerId: actor.id,
      recipeId: "diy_h2so4_from_2h_so4",
      componentCardInstanceIds: ["ion_h_01", "ion_h_02", "ion_so4_01", "ion_so4_02"],
      targetPlayerId: target.id,
    });

    expect(rejected).toBe(state);
    expectNoCoreSideEffects(rejected, state);
    expect(rejected.players[0].usedDIYThisCycle).toBe(false);
    expect(rejected.pendingResponse).toBeUndefined();
    expect(rejected.discardPile).not.toContain("ion_h_01");
    expect(rejected.discardPile).not.toContain("ion_h_02");
    expect(rejected.discardPile).not.toContain("ion_so4_01");
    expect(rejected.discardPile).not.toContain("ion_so4_02");
    expect(rejected.log.some((entry) => entry.message.includes("主动 DIY 使用 2H+ + SO4^2-"))).toBe(false);
    expectTotalCardInstances(rejected);
    expectCardZonesToBeConsistent(rejected);
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
