import { describe, expect, it } from "vitest";
import { starterDeckSize } from "../data/starterDeck";
import { identityShuffle } from "../../shared/random";
import { createInitialGame } from "../engine/createInitialGame";
import { areCardDefinitionsAssociated } from "../engine/cardAssociation";
import { engineReducer } from "../engine/reducer";
import type {
  CardDefinition,
  CardInstanceId,
  GameState,
  Player,
  PlayerId,
  PlayerStatus,
  StatusId,
} from "../engine/types";
import { expectCardZonesToBeConsistent } from "./assertCardZones";

const existingReference: NonNullable<GameState["tableReference"]> = {
  cardInstanceId: "element_c_01",
  definitionId: "element_c",
  displayName: "C",
  playedBy: "player_1",
  cycle: 1,
  round: 1,
};

const oxygenReference: NonNullable<GameState["tableReference"]> = {
  cardInstanceId: "element_o_01",
  definitionId: "element_o",
  displayName: "O",
  playedBy: "player_1",
  cycle: 1,
  round: 1,
};

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
  const sourcePlayerId = state.players.find((player) => player.id !== playerId)?.id ?? playerId;
  const status: PlayerStatus = {
    id: `status_test_${statusId}`,
    statusId,
    sourcePlayerId,
    createdAt: 1,
  };

  return updatePlayer(state, playerId, (player) => ({
    ...player,
    statuses: [...player.statuses, status],
  }));
}

function setHp(state: GameState, playerId: PlayerId, hp: number): GameState {
  return updatePlayer(state, playerId, (player) => ({ ...player, hp }));
}

function setUsedDIY(state: GameState, playerId: PlayerId, usedDIYThisCycle: boolean): GameState {
  return updatePlayer(state, playerId, (player) => ({ ...player, usedDIYThisCycle }));
}

function playReferenceCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState {
  return engineReducer(state, {
    type: "PLAY_REFERENCE_CARD",
    playerId,
    cardInstanceId,
  });
}

function playMainActionCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  targetPlayerId: PlayerId,
): GameState {
  return engineReducer(state, {
    type: "PLAY_CARD",
    playerId,
    cardInstanceId,
    targetPlayerId,
  });
}

function expectNoSideEffects(actual: GameState, expected: GameState): void {
  expect(actual.players).toEqual(expected.players);
  expect(actual.deck).toEqual(expected.deck);
  expect(actual.discardPile).toEqual(expected.discardPile);
  expect(actual.cardInstances).toEqual(expected.cardInstances);
  expect(actual.log).toEqual(expected.log);
  expect(actual.phase).toBe(expected.phase);
  expect(actual.activePlayerId).toBe(expected.activePlayerId);
  expect(actual.startingPlayerId).toBe(expected.startingPlayerId);
  expect(actual.cycleNumber).toBe(expected.cycleNumber);
  expect(actual.roundInCycle).toBe(expected.roundInCycle);
  expect(actual.tableReference).toEqual(expected.tableReference);
  expect(actual.pendingResponse).toEqual(expected.pendingResponse);
  expect(actual.pendingStatusHandling).toEqual(expected.pendingStatusHandling);
  expect(actual.effectQueue).toEqual(expected.effectQueue);
  expect(actual.winnerPlayerId).toBe(expected.winnerPlayerId);
  expect(actual.isDraw).toBe(expected.isDraw);
}

function expectReference(
  state: GameState,
  cardInstanceId: CardInstanceId,
  playedBy: PlayerId,
  displayName: string,
): void {
  const instance = state.cardInstances[cardInstanceId];

  expect(instance).toBeDefined();
  expect(state.tableReference).toEqual({
    cardInstanceId,
    definitionId: instance.definitionId,
    displayName,
    playedBy,
    cycle: state.cycleNumber,
    round: state.roundInCycle,
  });
}

function expectDiscardedOnce(state: GameState, cardInstanceId: CardInstanceId): void {
  expect(state.discardPile.filter((cardId) => cardId === cardInstanceId)).toHaveLength(1);
  expect(state.players.some((player) => player.hand.includes(cardInstanceId))).toBe(false);
}

function expectTotalCardInstances(state: GameState): void {
  expect(Object.keys(state.cardInstances)).toHaveLength(starterDeckSize);
}

describe("tableReference and reference card play", () => {
  it("rejects Na+ reference and effect paths against O tableReference without side effects", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;
    state = putCardInHand(state, player.id, "ion_na_01");
    state = setUsedDIY(state, player.id, true);
    state = { ...state, tableReference: oxygenReference };

    const rejectedReference = playReferenceCard(state, player.id, "ion_na_01");
    expect(rejectedReference).toBe(state);
    expectNoSideEffects(rejectedReference, state);

    const rejectedEffect = playMainActionCard(state, player.id, "ion_na_01", target.id);
    expect(rejectedEffect).toBe(state);
    expectNoSideEffects(rejectedEffect, state);
    expect(rejectedEffect.players[0].usedDIYThisCycle).toBe(true);
    expectCardZonesToBeConsistent(rejectedEffect);
  });

  it.each([
    ["O2", "substance_o2_01"],
    ["H2O", "substance_h2o_01"],
    ["CO2", "substance_co2_01"],
    ["SO2", "substance_so2_01"],
  ] satisfies [string, CardInstanceId][])(
    "allows %s to be played as a reference card against O tableReference",
    (displayName, cardInstanceId) => {
      let state = createInitialGame({ shuffle: identityShuffle });
      const [player] = state.players;
      state = putCardInHand(state, player.id, cardInstanceId);
      state = { ...state, tableReference: oxygenReference };

      const resolved = playReferenceCard(state, player.id, cardInstanceId);

      expectDiscardedOnce(resolved, cardInstanceId);
      expectReference(resolved, cardInstanceId, player.id, displayName);
      expectTotalCardInstances(resolved);
      expectCardZonesToBeConsistent(resolved);
    },
  );

  it.each([
    ["稀 H2SO4", "substance_h2so4_dilute_01"],
    ["稀 NaOH", "substance_naoh_dilute_01"],
  ] satisfies [string, CardInstanceId][])(
    "allows %s to execute its effect against O tableReference",
    (displayName, cardInstanceId) => {
      let state = createInitialGame({ shuffle: identityShuffle });
      const [player, target] = state.players;
      state = putCardInHand(state, player.id, cardInstanceId);
      state = { ...state, tableReference: oxygenReference };

      const resolved = playMainActionCard(state, player.id, cardInstanceId, target.id);

      expect(resolved.phase).toBe("responseWindow");
      expect(resolved.pendingResponse?.responderId).toBe(target.id);
      expect(resolved.players[1].hp).toBe(10);
      expectReference(resolved, cardInstanceId, player.id, displayName);
      expectTotalCardInstances(resolved);
      expectCardZonesToBeConsistent(resolved);
    },
  );

  it("rejects HCl reference and effect paths against O tableReference without side effects", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;
    state = putCardInHand(state, player.id, "substance_hcl_dilute_01");
    state = { ...state, tableReference: oxygenReference };

    const rejectedReference = playReferenceCard(state, player.id, "substance_hcl_dilute_01");
    expect(rejectedReference).toBe(state);
    expectNoSideEffects(rejectedReference, state);

    const rejectedEffect = playMainActionCard(
      state,
      player.id,
      "substance_hcl_dilute_01",
      target.id,
    );
    expect(rejectedEffect).toBe(state);
    expectNoSideEffects(rejectedEffect, state);
    expectCardZonesToBeConsistent(rejectedEffect);
  });

  it("does not create lab fire card instances in the ordinary starter deck", () => {
    const state = createInitialGame({ shuffle: identityShuffle });

    expect(Object.values(state.cardInstances).some((card) => card.definitionId === "event_lab_fire")).toBe(false);
    expect(state.deck.some((cardId) => cardId.startsWith("event_lab_fire"))).toBe(false);
    expect(state.players.some((player) => player.hand.some((cardId) => cardId.startsWith("event_lab_fire")))).toBe(false);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("rejects ordinary play attempts with the role-only lab fire id without side effects", () => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const [player, target] = state.players;

    const rejectedReference = playReferenceCard(state, player.id, "event_lab_fire_01");
    expect(rejectedReference).toBe(state);
    expectNoSideEffects(rejectedReference, state);

    const rejectedEffect = playMainActionCard(state, player.id, "event_lab_fire_01", target.id);
    expect(rejectedEffect).toBe(state);
    expectNoSideEffects(rejectedEffect, state);
    expectCardZonesToBeConsistent(rejectedEffect);
  });

  it.each([
    ["C", "element_c_01"],
    ["S", "element_s_01"],
  ] satisfies [string, CardInstanceId][])(
    "allows current nonmetal element %s after O tableReference",
    (displayName, cardInstanceId) => {
      let state = createInitialGame({ shuffle: identityShuffle });
      const [player] = state.players;
      state = putCardInHand(state, player.id, cardInstanceId);
      state = { ...state, tableReference: oxygenReference };

      const resolved = playReferenceCard(state, player.id, cardInstanceId);

      expectDiscardedOnce(resolved, cardInstanceId);
      expectReference(resolved, cardInstanceId, player.id, displayName);
      expectCardZonesToBeConsistent(resolved);
    },
  );

  it("keeps different element game categories unassociated at pure function level", () => {
    const nonmetalFixture: CardDefinition = {
      id: "fixture_element_o",
      name: "O fixture",
      type: "element",
      elements: ["O"],
      elementCategory: "nonmetal",
      tags: [],
      allowedTimings: ["diy-component"],
      rulesText: "Fixture only.",
    };
    const metalFixture: CardDefinition = {
      id: "fixture_element_na",
      name: "Na fixture",
      type: "element",
      elements: ["Na"],
      elementCategory: "metal",
      tags: [],
      allowedTimings: ["diy-component"],
      rulesText: "Fixture only.",
    };

    expect(areCardDefinitionsAssociated(nonmetalFixture, metalFixture)).toBe(false);
  });

  it("plays an element as a reference card without side effects", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player, nextPlayer] = state.players;
    state = putCardInHand(state, player.id, "element_o_01");
    state = setUsedDIY(state, player.id, true);
    const originalHp = state.players.map((candidate) => candidate.hp);
    const originalStatuses = state.players.map((candidate) => candidate.statuses);
    const originalUsedDIY = state.players[0].usedDIYThisCycle;

    const resolved = playReferenceCard(state, player.id, "element_o_01");

    expectDiscardedOnce(resolved, "element_o_01");
    expectReference(resolved, "element_o_01", player.id, "O");
    expect(resolved.players.map((candidate) => candidate.hp)).toEqual(originalHp);
    expect(resolved.players.map((candidate) => candidate.statuses)).toEqual(originalStatuses);
    expect(resolved.players[0].usedDIYThisCycle).toBe(originalUsedDIY);
    expect(resolved.pendingResponse).toBeUndefined();
    expect(resolved.phase).toBe("mainAction");
    expect(resolved.activePlayerId).toBe(nextPlayer.id);
    expect(resolved.cycleNumber).toBe(1);
    expect(resolved.roundInCycle).toBe(1);
    expect(resolved.log.some((entry) => entry.message.includes("普通出牌") && entry.message.includes("场面基准"))).toBe(true);
    expectTotalCardInstances(resolved);
    expectCardZonesToBeConsistent(resolved);
  });

  it.each([
    ["H2O", "substance_h2o_01"],
    ["CO2", "substance_co2_01"],
  ] satisfies [string, CardInstanceId][])(
    "plays %s as a reference card without extinguishing FIRE",
    (displayName, cardInstanceId) => {
      let state = createInitialGame({ shuffle: identityShuffle });
      const [player] = state.players;
      state = putCardInHand(state, player.id, cardInstanceId);
      state = addStatusForTest(state, player.id, "FIRE");

      const resolved = playReferenceCard(state, player.id, cardInstanceId);

      expectDiscardedOnce(resolved, cardInstanceId);
      expectReference(resolved, cardInstanceId, player.id, displayName);
      expect(resolved.players[0].statuses.map((status) => status.statusId)).toContain("FIRE");
      expect(resolved.pendingStatusHandling).toBeUndefined();
      expect(resolved.pendingResponse).toBeUndefined();
      expectTotalCardInstances(resolved);
      expectCardZonesToBeConsistent(resolved);
    },
  );

  it("plays O2 as a reference card without healing", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [player] = state.players;
    state = putCardInHand(state, player.id, "substance_o2_01");
    state = setHp(state, player.id, 7);

    const resolved = playReferenceCard(state, player.id, "substance_o2_01");

    expect(resolved.players[0].hp).toBe(7);
    expectDiscardedOnce(resolved, "substance_o2_01");
    expectReference(resolved, "substance_o2_01", player.id, "O2");
    expect(resolved.pendingResponse).toBeUndefined();
    expectTotalCardInstances(resolved);
    expectCardZonesToBeConsistent(resolved);
  });

  it("keeps HCl effect and reference paths distinct while both update tableReference", () => {
    let effectState = createInitialGame({ shuffle: identityShuffle });
    const [effectActor, effectTarget] = effectState.players;
    effectState = putCardInHand(effectState, effectActor.id, "substance_hcl_dilute_01");

    const effectResolved = playMainActionCard(
      effectState,
      effectActor.id,
      "substance_hcl_dilute_01",
      effectTarget.id,
    );

    expect(effectResolved.phase).toBe("responseWindow");
    expect(effectResolved.pendingResponse?.responderId).toBe(effectTarget.id);
    expect(effectResolved.players[1].hp).toBe(10);
    expectReference(effectResolved, "substance_hcl_dilute_01", effectActor.id, "稀 HCl");
    expect(effectResolved.discardPile).not.toContain("substance_hcl_dilute_01");
    expectCardZonesToBeConsistent(effectResolved);

    let referenceState = createInitialGame({ shuffle: identityShuffle });
    const [referenceActor, referenceTarget] = referenceState.players;
    referenceState = putCardInHand(referenceState, referenceActor.id, "substance_hcl_dilute_01");

    const referenceResolved = playReferenceCard(
      referenceState,
      referenceActor.id,
      "substance_hcl_dilute_01",
    );

    expect(referenceResolved.phase).toBe("mainAction");
    expect(referenceResolved.pendingResponse).toBeUndefined();
    expect(referenceResolved.players[1].hp).toBe(10);
    expect(referenceResolved.activePlayerId).toBe(referenceTarget.id);
    expectDiscardedOnce(referenceResolved, "substance_hcl_dilute_01");
    expectReference(referenceResolved, "substance_hcl_dilute_01", referenceActor.id, "稀 HCl");
    expectTotalCardInstances(referenceResolved);
    expectCardZonesToBeConsistent(referenceResolved);
  });

  it("does not update tableReference from response, status, DIY, or pass action", () => {
    let passState = createInitialGame({ shuffle: identityShuffle });
    passState = { ...passState, tableReference: existingReference };
    const passResolved = engineReducer(passState, {
      type: "PASS_ACTION",
      playerId: passState.activePlayerId,
    });
    expect(passResolved.tableReference).toEqual(existingReference);
    expectCardZonesToBeConsistent(passResolved);

    let responseState = createInitialGame({ shuffle: identityShuffle });
    const [attacker, responder] = responseState.players;
    responseState = putCardInHand(responseState, attacker.id, "substance_hcl_dilute_01");
    responseState = putCardInHand(responseState, responder.id, "substance_naoh_dilute_01");
    responseState = playMainActionCard(
      responseState,
      attacker.id,
      "substance_hcl_dilute_01",
      responder.id,
    );
    const attackReference = responseState.tableReference;
    responseState = engineReducer(responseState, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_naoh_dilute_01",
    });
    expect(responseState.tableReference).toEqual(attackReference);
    expect(responseState.tableReference?.cardInstanceId).toBe("substance_hcl_dilute_01");
    expectCardZonesToBeConsistent(responseState);

    let statusState = createInitialGame({ shuffle: identityShuffle });
    const [statusPlayer] = statusState.players;
    statusState = putCardInHand(statusState, statusPlayer.id, "substance_h2o_01");
    statusState = addStatusForTest(statusState, statusPlayer.id, "FIRE");
    const statusInstanceId = statusState.players[0].statuses[0].id;
    statusState = {
      ...statusState,
      activePlayerId: statusPlayer.id,
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId: statusPlayer.id,
        statusInstanceId,
      },
      tableReference: existingReference,
    };
    statusState = engineReducer(statusState, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: statusPlayer.id,
      statusInstanceId,
      cardInstanceId: "substance_h2o_01",
    });
    expect(statusState.tableReference).toEqual(existingReference);
    expectCardZonesToBeConsistent(statusState);

    let diyState = createInitialGame({ shuffle: identityShuffle });
    const [diyPlayer, diyTarget] = diyState.players;
    diyState = putCardInHand(diyState, diyPlayer.id, "ion_h_01");
    diyState = putCardInHand(diyState, diyPlayer.id, "ion_cl_01");
    diyState = { ...diyState, tableReference: existingReference };
    diyState = engineReducer(diyState, {
      type: "START_ACTIVE_DIY",
      playerId: diyPlayer.id,
      recipeId: "diy_hcl_from_h_cl",
      componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
      targetPlayerId: diyTarget.id,
    });
    expect(diyState.phase).toBe("responseWindow");
    expect(diyState.pendingResponse?.sourceEffect.source.kind).toBe("virtual-diy");
    expect(diyState.tableReference).toEqual(existingReference);
    expectCardZonesToBeConsistent(diyState);
  });

  it("clears tableReference when a new cycle starts", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [, secondPlayer] = state.players;
    state = {
      ...state,
      activePlayerId: secondPlayer.id,
      roundInCycle: 3,
      tableReference: existingReference,
    };

    const resolved = engineReducer(state, {
      type: "PASS_ACTION",
      playerId: secondPlayer.id,
    });

    expect(resolved.cycleNumber).toBe(2);
    expect(resolved.roundInCycle).toBe(1);
    expect(resolved.tableReference).toBeUndefined();
    expectTotalCardInstances(resolved);
    expectCardZonesToBeConsistent(resolved);
  });

  it("rejects invalid reference card plays without side effects", () => {
    const cases: { name: string; state: GameState; playerId: PlayerId; cardId: CardInstanceId }[] = [];

    let nonActive = createInitialGame({ shuffle: identityShuffle });
    nonActive = putCardInHand(nonActive, nonActive.players[1].id, "substance_o2_01");
    cases.push({
      name: "non-active player",
      state: nonActive,
      playerId: nonActive.players[1].id,
      cardId: "substance_o2_01",
    });

    let responseWindow = createInitialGame({ shuffle: identityShuffle });
    responseWindow = putCardInHand(responseWindow, responseWindow.players[0].id, "element_o_01");
    responseWindow = { ...responseWindow, phase: "responseWindow" };
    cases.push({
      name: "responseWindow",
      state: responseWindow,
      playerId: responseWindow.players[0].id,
      cardId: "element_o_01",
    });

    let statusWindow = createInitialGame({ shuffle: identityShuffle });
    statusWindow = putCardInHand(statusWindow, statusWindow.players[0].id, "element_o_01");
    statusWindow = addStatusForTest(statusWindow, statusWindow.players[0].id, "FIRE");
    statusWindow = {
      ...statusWindow,
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId: statusWindow.players[0].id,
        statusInstanceId: statusWindow.players[0].statuses[0].id,
      },
    };
    cases.push({
      name: "statusWindow",
      state: statusWindow,
      playerId: statusWindow.players[0].id,
      cardId: "element_o_01",
    });

    let eliminated = createInitialGame({ shuffle: identityShuffle });
    eliminated = putCardInHand(eliminated, eliminated.players[0].id, "element_o_01");
    eliminated = updatePlayer(eliminated, eliminated.players[0].id, (player) => ({
      ...player,
      eliminated: true,
      hp: 0,
    }));
    cases.push({
      name: "eliminated active player",
      state: eliminated,
      playerId: eliminated.players[0].id,
      cardId: "element_o_01",
    });

    let gameOver = createInitialGame({ shuffle: identityShuffle });
    gameOver = putCardInHand(gameOver, gameOver.players[0].id, "element_o_01");
    gameOver = {
      ...gameOver,
      phase: "gameOver",
      winnerPlayerId: gameOver.players[0].id,
    };
    cases.push({
      name: "gameOver",
      state: gameOver,
      playerId: gameOver.players[0].id,
      cardId: "element_o_01",
    });

    const cardNotInHand = createInitialGame({ shuffle: identityShuffle });
    cases.push({
      name: "card not in hand",
      state: cardNotInHand,
      playerId: cardNotInHand.players[0].id,
      cardId: "substance_o2_01",
    });

    for (const targetCase of cases) {
      const rejected = playReferenceCard(targetCase.state, targetCase.playerId, targetCase.cardId);

      expect(rejected, targetCase.name).toBe(targetCase.state);
      expectNoSideEffects(rejected, targetCase.state);
      expectCardZonesToBeConsistent(rejected);
    }
  });
});
