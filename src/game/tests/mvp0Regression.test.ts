import { describe, expect, it } from "vitest";
import { starterDeckSize } from "../data/starterDeck";
import { createMvp0TestGame as createInitialGame } from "./createTestGame";
import type { GameAction } from "../engine/actions";
import { engineReducer } from "../engine/reducer";
import type { CardInstanceId, GameState, Player, PlayerId, StatusId } from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";
import { renderGameLogEntry } from "../../features/local-game/gameLogRenderer";

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

function passCurrentAction(state: GameState): GameState {
  return engineReducer(state, {
    type: "PASS_ACTION",
    playerId: state.activePlayerId,
  });
}

function countCardDefinition(state: GameState, definitionId: string): number {
  return Object.values(state.cardInstances).filter(
    (cardInstance) => cardInstance.definitionId === definitionId,
  ).length;
}

function expectCardInstanceCount(state: GameState): void {
  expect(Object.keys(state.cardInstances)).toHaveLength(starterDeckSize);
}

describe("MVP 0 engine regression", () => {
  it("keeps initial card-zone invariants", () => {
    const state = createInitialGame({ shuffle: identityShuffle });

    expectCardInstanceCount(state);
    expect(state.players[0].hand).toHaveLength(10);
    expect(state.players[1].hand).toHaveLength(10);
    expect(state.deck).toHaveLength(starterDeckSize - 20);
    expect(state.discardPile).toHaveLength(0);
    expect(countCardDefinition(state, "event_lab_fire")).toBe(0);
    expectCardZonesToBeConsistent(state);
  });

  it("resolves acid/base neutralization and Na2CO3 acid response without damage or extra cards", () => {
    let neutralized = createInitialGame({ shuffle: identityShuffle });
    neutralized = putCardInHand(neutralized, neutralized.players[0].id, "substance_hcl_dilute_01");
    neutralized = putCardInHand(neutralized, neutralized.players[1].id, "substance_naoh_dilute_01");

    neutralized = engineReducer(neutralized, {
      type: "PLAY_CARD",
      playerId: neutralized.players[0].id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: neutralized.players[1].id,
    });
    expectCardZonesToBeConsistent(neutralized);

    neutralized = engineReducer(neutralized, {
      type: "RESPOND_WITH_CARD",
      playerId: neutralized.players[1].id,
      cardInstanceId: "substance_naoh_dilute_01",
    });

    expect(neutralized.players[1].hp).toBe(10);
    expect(neutralized.discardPile.filter((cardId) => cardId === "substance_hcl_dilute_01")).toHaveLength(1);
    expect(neutralized.discardPile.filter((cardId) => cardId === "substance_naoh_dilute_01")).toHaveLength(1);
    expectCardInstanceCount(neutralized);
    expectCardZonesToBeConsistent(neutralized);

    let carbonate = createInitialGame({ shuffle: identityShuffle });
    carbonate = putCardInHand(carbonate, carbonate.players[0].id, "substance_h2so4_dilute_01");
    carbonate = putCardInHand(carbonate, carbonate.players[1].id, "substance_na2co3_01");
    const initialCo2Count = countCardDefinition(carbonate, "substance_co2");

    carbonate = engineReducer(carbonate, {
      type: "PLAY_CARD",
      playerId: carbonate.players[0].id,
      cardInstanceId: "substance_h2so4_dilute_01",
      targetPlayerId: carbonate.players[1].id,
    });
    expectCardZonesToBeConsistent(carbonate);

    carbonate = engineReducer(carbonate, {
      type: "RESPOND_WITH_CARD",
      playerId: carbonate.players[1].id,
      cardInstanceId: "substance_na2co3_01",
    });

    expect(carbonate.players[1].hp).toBe(10);
    expect(carbonate.discardPile.filter((cardId) => cardId === "substance_h2so4_dilute_01")).toHaveLength(1);
    expect(carbonate.discardPile.filter((cardId) => cardId === "substance_na2co3_01")).toHaveLength(1);
    expect(carbonate.log.some((entry) => entry.eventKey === "reaction")).toBe(true);
    expect(countCardDefinition(carbonate, "substance_co2")).toBe(initialCo2Count);
    expectCardInstanceCount(carbonate);
    expectCardZonesToBeConsistent(carbonate);
  });

  it("processes SO2_LEAK and FIRE in order without allowing treatment cards to mix", () => {
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
    expectCardZonesToBeConsistent(state);

    const rejectedWaterForSo2 = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId: "status_test_SO2_LEAK_1",
      cardInstanceId: "substance_h2o_01",
    });
    expect(rejectedWaterForSo2).toBe(state);
    expectCardZonesToBeConsistent(rejectedWaterForSo2);

    state = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId: "status_test_SO2_LEAK_1",
      cardInstanceId: "ion_oh_01",
    });
    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling?.statusInstanceId).toBe("status_test_FIRE_2");
    expectCardZonesToBeConsistent(state);

    const rejectedBaseForFire = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: activePlayer.id,
      statusInstanceId: "status_test_FIRE_2",
      cardInstanceId: "ion_oh_01",
    });
    expect(rejectedBaseForFire).toBe(state);
    expectCardZonesToBeConsistent(rejectedBaseForFire);

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

  it("preserves SO2_LEAK and FIRE through cleanup and blocks PASS_ACTION in new-cycle statusWindow", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const startingPlayer = state.players[0];
    const finalActor = state.players[1];
    const startingPlayerHand = [...startingPlayer.hand];

    state = addStatusForTest(state, startingPlayer.id, "SO2_LEAK", 1);
    state = addStatusForTest(state, startingPlayer.id, "FIRE", 2);
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
    expect(state.pendingStatusHandling?.statusInstanceId).toBe("status_test_SO2_LEAK_1");
    expect(state.players[0].statuses.map((status) => status.statusId)).toEqual(["SO2_LEAK", "FIRE"]);
    expect(state.discardPile).toEqual(expect.arrayContaining(startingPlayerHand));
    expect(state.log.filter((entry) => renderGameLogEntry(entry).includes("实验周期结束"))).toHaveLength(1);
    expectCardZonesToBeConsistent(state);

    const rejectedPass = passCurrentAction(state);
    expect(rejectedPass).toBe(state);
    expect(rejectedPass.phase).toBe("statusWindow");
    expectCardZonesToBeConsistent(rejectedPass);
  });

  it("eliminates at zero hp, enters gameOver, and rejects every public action after gameOver", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    state = putCardInHand(state, state.players[0].id, "substance_hcl_dilute_01");
    state = updatePlayer(state, state.players[1].id, (player) => ({ ...player, hp: 1 }));

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: state.players[0].id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: state.players[1].id,
    });
    expectCardZonesToBeConsistent(state);

    state = engineReducer(state, {
      type: "PASS_RESPONSE",
      playerId: state.players[1].id,
    });

    expect(state.phase).toBe("gameOver");
    expect(state.players[1]).toMatchObject({ hp: 0, eliminated: true });
    expect(state.winnerPlayerId).toBe(state.players[0].id);
    expectCardZonesToBeConsistent(state);

    const actions: GameAction[] = [
      {
        type: "PLAY_CARD",
        playerId: state.players[0].id,
        cardInstanceId: "substance_naoh_dilute_01",
        targetPlayerId: state.players[1].id,
      },
      { type: "PLAY_REFERENCE_CARD", playerId: state.players[0].id, cardInstanceId: "element_o_01" },
      { type: "RESPOND_WITH_CARD", playerId: state.players[1].id, cardInstanceId: "substance_naoh_dilute_01" },
      { type: "PASS_RESPONSE", playerId: state.players[1].id },
      {
        type: "HANDLE_STATUS_WITH_CARD",
        playerId: state.players[1].id,
        statusInstanceId: "status_missing",
        cardInstanceId: "substance_h2o_01",
      },
      { type: "PASS_STATUS_HANDLING", playerId: state.players[1].id, statusInstanceId: "status_missing" },
      {
        type: "START_ACTIVE_DIY",
        playerId: state.players[0].id,
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
        targetPlayerId: state.players[1].id,
      },
      { type: "PASS_ACTION", playerId: state.players[0].id },
    ];

    for (const action of actions) {
      const rejected = engineReducer(state, action);
      expect(rejected).toBe(state);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("advances only once at third-round response and status boundaries without duplicating cards", () => {
    let neutralized = createInitialGame({ shuffle: identityShuffle });
    neutralized = putCardInHand(neutralized, neutralized.players[1].id, "substance_naoh_dilute_01");
    neutralized = putCardInHand(neutralized, neutralized.players[0].id, "substance_hcl_dilute_01");
    neutralized = {
      ...neutralized,
      activePlayerId: neutralized.players[1].id,
      roundInCycle: 3,
    };

    neutralized = engineReducer(neutralized, {
      type: "PLAY_CARD",
      playerId: neutralized.players[1].id,
      cardInstanceId: "substance_naoh_dilute_01",
      targetPlayerId: neutralized.players[0].id,
    });
    neutralized = engineReducer(neutralized, {
      type: "RESPOND_WITH_CARD",
      playerId: neutralized.players[0].id,
      cardInstanceId: "substance_hcl_dilute_01",
    });
    expect(neutralized.cycleNumber).toBe(2);
    expect(neutralized.log.filter((entry) => renderGameLogEntry(entry).includes("实验周期结束"))).toHaveLength(1);
    expect(neutralized.discardPile.filter((cardId) => cardId === "substance_naoh_dilute_01")).toHaveLength(1);
    expect(neutralized.discardPile.filter((cardId) => cardId === "substance_hcl_dilute_01")).toHaveLength(1);
    expectCardZonesToBeConsistent(neutralized);

    let carbonate = createInitialGame({ shuffle: identityShuffle });
    carbonate = putCardInHand(carbonate, carbonate.players[1].id, "substance_h2so4_dilute_01");
    carbonate = putCardInHand(carbonate, carbonate.players[0].id, "substance_na2co3_01");
    carbonate = {
      ...carbonate,
      activePlayerId: carbonate.players[1].id,
      roundInCycle: 3,
    };

    carbonate = engineReducer(carbonate, {
      type: "PLAY_CARD",
      playerId: carbonate.players[1].id,
      cardInstanceId: "substance_h2so4_dilute_01",
      targetPlayerId: carbonate.players[0].id,
    });
    carbonate = engineReducer(carbonate, {
      type: "RESPOND_WITH_CARD",
      playerId: carbonate.players[0].id,
      cardInstanceId: "substance_na2co3_01",
    });
    expect(carbonate.cycleNumber).toBe(2);
    expect(carbonate.log.filter((entry) => renderGameLogEntry(entry).includes("实验周期结束"))).toHaveLength(1);
    expect(carbonate.discardPile.filter((cardId) => cardId === "substance_h2so4_dilute_01")).toHaveLength(1);
    expect(carbonate.discardPile.filter((cardId) => cardId === "substance_na2co3_01")).toHaveLength(1);
    expectCardZonesToBeConsistent(carbonate);

    let statuses = createInitialGame({ shuffle: identityShuffle });
    statuses = addStatusForTest(statuses, statuses.players[1].id, "SO2_LEAK", 1);
    statuses = addStatusForTest(statuses, statuses.players[1].id, "FIRE", 2);
    statuses = putCardInHand(statuses, statuses.players[1].id, "ion_oh_01");
    statuses = putCardInHand(statuses, statuses.players[1].id, "substance_h2o_01");
    statuses = {
      ...statuses,
      activePlayerId: statuses.players[0].id,
      roundInCycle: 3,
    };

    statuses = passCurrentAction(statuses);
    expect(statuses.phase).toBe("statusWindow");
    expect(statuses.pendingStatusHandling?.statusInstanceId).toBe("status_test_SO2_LEAK_1");
    expectCardZonesToBeConsistent(statuses);

    statuses = engineReducer(statuses, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: statuses.players[1].id,
      statusInstanceId: "status_test_SO2_LEAK_1",
      cardInstanceId: "ion_oh_01",
    });
    statuses = engineReducer(statuses, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: statuses.players[1].id,
      statusInstanceId: "status_test_FIRE_2",
      cardInstanceId: "substance_h2o_01",
    });
    expect(statuses.phase).toBe("mainAction");
    expect(statuses.cycleNumber).toBe(1);
    expectCardZonesToBeConsistent(statuses);

    statuses = passCurrentAction(statuses);
    expect(statuses.cycleNumber).toBe(2);
    expect(statuses.log.filter((entry) => renderGameLogEntry(entry).includes("实验周期结束"))).toHaveLength(1);
    expect(statuses.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
    expect(statuses.discardPile.filter((cardId) => cardId === "substance_h2o_01")).toHaveLength(1);
    expectCardInstanceCount(statuses);
    expectCardZonesToBeConsistent(statuses);
  });
});
