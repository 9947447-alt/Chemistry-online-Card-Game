import { describe, expect, it } from "vitest";
import { createInitialGame } from "../engine/createInitialGame";
import { engineReducer } from "../engine/reducer";
import type { CardInstanceId, Effect, GameState, Player, PlayerId } from "../engine/types";
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

function createResponseTestGame(
  attackerCardId: CardInstanceId,
  responderCardId: CardInstanceId,
): GameState {
  let state = createInitialGame({ shuffle: identityShuffle });
  const [attacker, responder] = state.players;

  state = putCardInHand(state, attacker.id, attackerCardId);
  state = putCardInHand(state, responder.id, responderCardId);
  expectCardZonesToBeConsistent(state);

  return state;
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

function countCardDefinition(state: GameState, definitionId: string): number {
  return Object.values(state.cardInstances).filter(
    (cardInstance) => cardInstance.definitionId === definitionId,
  ).length;
}

function expectTotalCardInstances(state: GameState): void {
  expect(Object.keys(state.cardInstances)).toHaveLength(70);
}

function startAttack(
  state: GameState,
  attackerCardId: CardInstanceId = "substance_hcl_dilute_01",
): GameState {
  const [attacker, responder] = state.players;

  return engineReducer(state, {
    type: "PLAY_CARD",
    playerId: attacker.id,
    cardInstanceId: attackerCardId,
    targetPlayerId: responder.id,
  });
}

function createVirtualDIYResponseGame(
  responderCardId?: CardInstanceId,
  options: {
    damageKind?: "acid" | "base";
    activePlayerIndex?: 0 | 1;
    roundInCycle?: 1 | 2 | 3;
  } = {},
): GameState {
  let state = createInitialGame({ shuffle: identityShuffle });
  const activePlayerIndex = options.activePlayerIndex ?? 0;
  const activePlayer = state.players[activePlayerIndex];
  const responder = state.players[activePlayerIndex === 0 ? 1 : 0];
  const sourceEffect: Extract<Effect, { type: "DAMAGE" }> = {
    type: "DAMAGE",
    source: {
      kind: "virtual-diy",
      recipeId: "test_virtual_diy_attack",
      displayName: options.damageKind === "base" ? "虚拟 DIY 碱性攻击" : "虚拟 DIY 酸性攻击",
    },
    targetPlayerId: responder.id,
    amount: 1,
    damageKind: options.damageKind ?? "acid",
    canRespond: true,
  };

  if (responderCardId) {
    state = putCardInHand(state, responder.id, responderCardId);
  }

  state = {
    ...state,
    activePlayerId: activePlayer.id,
    roundInCycle: options.roundInCycle ?? state.roundInCycle,
    phase: "responseWindow",
    pendingResponse: {
      responderId: responder.id,
      sourceEffect,
      chainDepth: 1,
      effectsAfterPass: [sourceEffect],
    },
  };
  expectCardZonesToBeConsistent(state);

  return state;
}

describe("acid/base response window", () => {
  it("allows NaOH to neutralize an HCl acid attack", () => {
    let state = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const [attacker, responder] = state.players;

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: responder.id,
    });

    expect(state.phase).toBe("responseWindow");
    expect(state.pendingResponse?.responderId).toBe(responder.id);
    expect(state.pendingResponse?.sourceEffect).toMatchObject({
      type: "DAMAGE",
      source: {
        kind: "card",
        cardInstanceId: "substance_hcl_dilute_01",
      },
      targetPlayerId: responder.id,
      amount: 1,
      damageKind: "acid",
    });

    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_naoh_dilute_01",
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.players[1].hp).toBe(10);
    expect(state.discardPile).toEqual(
      expect.arrayContaining(["substance_hcl_dilute_01", "substance_naoh_dilute_01"]),
    );
    expect(state.activePlayerId).toBe(responder.id);
    expect(state.log.some((entry) => entry.message.includes("中和"))).toBe(true);
    expectCardZonesToBeConsistent(state);
  });

  it("allows HCl to neutralize a NaOH base attack", () => {
    let state = createResponseTestGame(
      "substance_naoh_dilute_01",
      "substance_hcl_dilute_01",
    );
    const [attacker, responder] = state.players;

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_naoh_dilute_01",
      targetPlayerId: responder.id,
    });

    expect(state.pendingResponse?.sourceEffect).toMatchObject({
      type: "DAMAGE",
      source: {
        kind: "card",
        cardInstanceId: "substance_naoh_dilute_01",
      },
      targetPlayerId: responder.id,
      amount: 1,
      damageKind: "base",
    });

    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_hcl_dilute_01",
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.players[1].hp).toBe(10);
    expect(state.discardPile).toEqual(
      expect.arrayContaining(["substance_naoh_dilute_01", "substance_hcl_dilute_01"]),
    );
    expectCardZonesToBeConsistent(state);
  });

  it("allows Na2CO3 to respond to an HCl acid attack and logs CO2 generation", () => {
    let state = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_na2co3_01",
    );
    const [attacker, responder] = state.players;
    const initialCardInstanceCount = Object.keys(state.cardInstances).length;
    const initialCo2Count = countCardDefinition(state, "substance_co2");
    const initialDeckSize = state.deck.length;

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: responder.id,
    });
    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_na2co3_01",
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.players[1].hp).toBe(10);
    expect(state.activePlayerId).toBe(responder.id);
    expect(state.roundInCycle).toBe(1);
    expect(state.discardPile).toEqual(
      expect.arrayContaining(["substance_hcl_dilute_01", "substance_na2co3_01"]),
    );
    expect(state.discardPile.filter((cardId) => cardId === "substance_hcl_dilute_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "substance_na2co3_01")).toHaveLength(1);
    expect(Object.keys(state.cardInstances)).toHaveLength(initialCardInstanceCount);
    expect(countCardDefinition(state, "substance_co2")).toBe(initialCo2Count);
    expect(state.deck).toHaveLength(initialDeckSize);
    expect(
      state.log.some(
        (entry) =>
          entry.message.includes("Na2CO3") &&
          entry.message.includes("酸性伤害") &&
          entry.message.includes("生成 CO2"),
      ),
    ).toBe(true);
    expectCardZonesToBeConsistent(state);
  });

  it("allows Na2CO3 to respond to an H2SO4 acid attack", () => {
    let state = createResponseTestGame(
      "substance_h2so4_dilute_01",
      "substance_na2co3_01",
    );
    const [attacker, responder] = state.players;

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_h2so4_dilute_01",
      targetPlayerId: responder.id,
    });
    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_na2co3_01",
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.players[1].hp).toBe(10);
    expect(state.discardPile).toEqual(
      expect.arrayContaining(["substance_h2so4_dilute_01", "substance_na2co3_01"]),
    );
    expectCardZonesToBeConsistent(state);
  });

  it("allows CO3^2- ion to respond to HCl and H2SO4 acid attacks", () => {
    const acidAttackIds: CardInstanceId[] = [
      "substance_hcl_dilute_01",
      "substance_h2so4_dilute_01",
    ];

    for (const acidAttackId of acidAttackIds) {
      let state = createResponseTestGame(acidAttackId, "ion_co3_01");
      const [attacker, responder] = state.players;
      const initialCardInstanceCount = Object.keys(state.cardInstances).length;
      const initialCo2Count = countCardDefinition(state, "substance_co2");

      state = engineReducer(state, {
        type: "PLAY_CARD",
        playerId: attacker.id,
        cardInstanceId: acidAttackId,
        targetPlayerId: responder.id,
      });
      state = engineReducer(state, {
        type: "RESPOND_WITH_CARD",
        playerId: responder.id,
        cardInstanceId: "ion_co3_01",
      });

      expect(state.pendingResponse).toBeUndefined();
      expect(state.players[1].hp).toBe(10);
      expect(state.discardPile.filter((cardId) => cardId === acidAttackId)).toHaveLength(1);
      expect(state.discardPile.filter((cardId) => cardId === "ion_co3_01")).toHaveLength(1);
      expect(Object.keys(state.cardInstances)).toHaveLength(initialCardInstanceCount);
      expect(countCardDefinition(state, "substance_co2")).toBe(initialCo2Count);
      expect(
        state.log.some(
          (entry) =>
            entry.message.includes("CO3^2-") &&
            entry.message.includes("酸性伤害") &&
            entry.message.includes("生成 CO2"),
        ),
      ).toBe(true);
      expectCardZonesToBeConsistent(state);
    }
  });

  it("resolves virtual DIY acid attacks with CO3^2-, Na2CO3, base neutralization, or pass", () => {
    const responseCases: {
      name: string;
      responseCardId: CardInstanceId;
      expectedLogText: string;
    }[] = [
      {
        name: "CO3^2-",
        responseCardId: "ion_co3_01",
        expectedLogText: "生成 CO2",
      },
      {
        name: "Na2CO3",
        responseCardId: "substance_na2co3_01",
        expectedLogText: "生成 CO2",
      },
      {
        name: "base neutralization",
        responseCardId: "substance_naoh_dilute_01",
        expectedLogText: "中和 虚拟 DIY 酸性攻击",
      },
    ];

    for (const { responseCardId, expectedLogText } of responseCases) {
      let state = createVirtualDIYResponseGame(responseCardId);
      const responder = state.players[1];
      const initialDiscardSize = state.discardPile.length;
      const initialCo2Count = countCardDefinition(state, "substance_co2");

      state = engineReducer(state, {
        type: "RESPOND_WITH_CARD",
        playerId: responder.id,
        cardInstanceId: responseCardId,
      });

      expect(state.pendingResponse).toBeUndefined();
      expect(state.players[1].hp).toBe(10);
      expect(state.discardPile).toHaveLength(initialDiscardSize + 1);
      expect(state.discardPile.filter((cardId) => cardId === responseCardId)).toHaveLength(1);
      expect(countCardDefinition(state, "substance_co2")).toBe(initialCo2Count);
      expect(state.log.some((entry) => entry.message.includes(expectedLogText))).toBe(true);
      expect(state.activePlayerId).toBe(responder.id);
      expect(state.roundInCycle).toBe(1);
      expectTotalCardInstances(state);
      expectCardZonesToBeConsistent(state);
    }

    let passed = createVirtualDIYResponseGame();
    const responder = passed.players[1];
    const initialDiscardSize = passed.discardPile.length;

    passed = engineReducer(passed, {
      type: "PASS_RESPONSE",
      playerId: responder.id,
    });

    expect(passed.pendingResponse).toBeUndefined();
    expect(passed.players[1].hp).toBe(9);
    expect(passed.discardPile).toHaveLength(initialDiscardSize);
    expect(passed.activePlayerId).toBe(responder.id);
    expect(passed.roundInCycle).toBe(1);
    expectTotalCardInstances(passed);
    expectCardZonesToBeConsistent(passed);
  });

  it("resolves virtual DIY base attacks with acid neutralization or pass", () => {
    let neutralized = createVirtualDIYResponseGame("substance_hcl_dilute_01", {
      damageKind: "base",
    });
    const neutralizingResponder = neutralized.players[1];

    neutralized = engineReducer(neutralized, {
      type: "RESPOND_WITH_CARD",
      playerId: neutralizingResponder.id,
      cardInstanceId: "substance_hcl_dilute_01",
    });

    expect(neutralized.pendingResponse).toBeUndefined();
    expect(neutralized.players[1].hp).toBe(10);
    expect(neutralized.discardPile.filter((cardId) => cardId === "substance_hcl_dilute_01")).toHaveLength(1);
    expect(neutralized.log.some((entry) => entry.message.includes("中和 虚拟 DIY 碱性攻击"))).toBe(true);
    expectTotalCardInstances(neutralized);
    expectCardZonesToBeConsistent(neutralized);

    let passed = createVirtualDIYResponseGame(undefined, { damageKind: "base" });
    const passingResponder = passed.players[1];
    const initialDiscardSize = passed.discardPile.length;

    passed = engineReducer(passed, {
      type: "PASS_RESPONSE",
      playerId: passingResponder.id,
    });

    expect(passed.pendingResponse).toBeUndefined();
    expect(passed.players[1].hp).toBe(9);
    expect(passed.discardPile).toHaveLength(initialDiscardSize);
    expectTotalCardInstances(passed);
    expectCardZonesToBeConsistent(passed);
  });

  it("rejects Na2CO3 responses to base attacks", () => {
    const baseAttackIds: CardInstanceId[] = [
      "substance_naoh_dilute_01",
      "substance_koh_dilute_01",
      "substance_caoh2_limewater_01",
    ];

    for (const baseAttackId of baseAttackIds) {
      let state = createResponseTestGame(baseAttackId, "substance_na2co3_01");
      const [attacker, responder] = state.players;

      state = engineReducer(state, {
        type: "PLAY_CARD",
        playerId: attacker.id,
        cardInstanceId: baseAttackId,
        targetPlayerId: responder.id,
      });

      const rejected = engineReducer(state, {
        type: "RESPOND_WITH_CARD",
        playerId: responder.id,
        cardInstanceId: "substance_na2co3_01",
      });

      expect(rejected).toBe(state);
      expect(rejected.pendingResponse?.sourceEffect).toMatchObject({ damageKind: "base" });
      expect(rejected.players[1].hand).toContain("substance_na2co3_01");
      expect(rejected.discardPile).not.toContain("substance_na2co3_01");
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("rejects CO3^2- ion responses to base attacks without side effects", () => {
    const baseAttackIds: CardInstanceId[] = [
      "substance_naoh_dilute_01",
      "substance_koh_dilute_01",
      "substance_caoh2_limewater_01",
    ];

    for (const baseAttackId of baseAttackIds) {
      let state = createResponseTestGame(baseAttackId, "ion_co3_01");
      const [attacker, responder] = state.players;

      state = engineReducer(state, {
        type: "PLAY_CARD",
        playerId: attacker.id,
        cardInstanceId: baseAttackId,
        targetPlayerId: responder.id,
      });

      const rejected = engineReducer(state, {
        type: "RESPOND_WITH_CARD",
        playerId: responder.id,
        cardInstanceId: "ion_co3_01",
      });

      expect(rejected).toBe(state);
      expect(rejected.pendingResponse?.sourceEffect).toMatchObject({ damageKind: "base" });
      expect(rejected.players[1].hp).toBe(10);
      expect(rejected.players[1].hand).toContain("ion_co3_01");
      expect(rejected.discardPile).not.toContain("ion_co3_01");
      expect(rejected.log.some((entry) => entry.message.includes("生成 CO2"))).toBe(false);
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("rejects illegal CO3^2- ion responses without side effects or success logs", () => {
    let nonResponderState = createResponseTestGame("substance_hcl_dilute_01", "ion_co3_01");
    const [attacker, responder] = nonResponderState.players;
    nonResponderState = putCardInHand(nonResponderState, attacker.id, "ion_co3_02");
    nonResponderState = engineReducer(nonResponderState, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: responder.id,
    });

    const rejectedNonResponder = engineReducer(nonResponderState, {
      type: "RESPOND_WITH_CARD",
      playerId: attacker.id,
      cardInstanceId: "ion_co3_02",
    });

    expect(rejectedNonResponder).toBe(nonResponderState);
    expect(rejectedNonResponder.log.some((entry) => entry.message.includes("生成 CO2"))).toBe(false);
    expectCardZonesToBeConsistent(rejectedNonResponder);

    let eliminatedResponderState = createResponseTestGame("substance_hcl_dilute_01", "ion_co3_01");
    const [eliminatingAttacker, eliminatedResponder] = eliminatedResponderState.players;
    eliminatedResponderState = engineReducer(eliminatedResponderState, {
      type: "PLAY_CARD",
      playerId: eliminatingAttacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: eliminatedResponder.id,
    });
    eliminatedResponderState = updatePlayer(
      eliminatedResponderState,
      eliminatedResponder.id,
      (player) => ({
        ...player,
        hp: 0,
        eliminated: true,
      }),
    );

    const rejectedEliminatedResponder = engineReducer(eliminatedResponderState, {
      type: "RESPOND_WITH_CARD",
      playerId: eliminatedResponder.id,
      cardInstanceId: "ion_co3_01",
    });

    expect(rejectedEliminatedResponder).toBe(eliminatedResponderState);
    expect(rejectedEliminatedResponder.log.some((entry) => entry.message.includes("生成 CO2"))).toBe(false);
    expectCardZonesToBeConsistent(rejectedEliminatedResponder);

    let noWindowState = createInitialGame({ shuffle: identityShuffle });
    noWindowState = putCardInHand(noWindowState, noWindowState.players[1].id, "ion_co3_01");

    const rejectedNoWindow = engineReducer(noWindowState, {
      type: "RESPOND_WITH_CARD",
      playerId: noWindowState.players[1].id,
      cardInstanceId: "ion_co3_01",
    });

    expect(rejectedNoWindow).toBe(noWindowState);
    expect(rejectedNoWindow.log.some((entry) => entry.message.includes("生成 CO2"))).toBe(false);
    expectCardZonesToBeConsistent(rejectedNoWindow);
  });

  it("rejects Na2CO3 from non-responders, eliminated responders, and closed windows", () => {
    let nonResponderState = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_na2co3_01",
    );
    const [attacker, responder] = nonResponderState.players;
    nonResponderState = putCardInHand(nonResponderState, attacker.id, "substance_na2co3_02");
    nonResponderState = engineReducer(nonResponderState, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: responder.id,
    });

    const rejectedNonResponder = engineReducer(nonResponderState, {
      type: "RESPOND_WITH_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_na2co3_02",
    });

    expect(rejectedNonResponder).toBe(nonResponderState);
    expectCardZonesToBeConsistent(rejectedNonResponder);

    let eliminatedResponderState = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_na2co3_01",
    );
    const [eliminatingAttacker, eliminatedResponder] = eliminatedResponderState.players;
    eliminatedResponderState = engineReducer(eliminatedResponderState, {
      type: "PLAY_CARD",
      playerId: eliminatingAttacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: eliminatedResponder.id,
    });
    eliminatedResponderState = updatePlayer(
      eliminatedResponderState,
      eliminatedResponder.id,
      (player) => ({
        ...player,
        hp: 0,
        eliminated: true,
      }),
    );

    const rejectedEliminatedResponder = engineReducer(eliminatedResponderState, {
      type: "RESPOND_WITH_CARD",
      playerId: eliminatedResponder.id,
      cardInstanceId: "substance_na2co3_01",
    });

    expect(rejectedEliminatedResponder).toBe(eliminatedResponderState);
    expectCardZonesToBeConsistent(rejectedEliminatedResponder);

    let noWindowState = createInitialGame({ shuffle: identityShuffle });
    noWindowState = putCardInHand(noWindowState, noWindowState.players[1].id, "substance_na2co3_01");

    const rejectedNoWindow = engineReducer(noWindowState, {
      type: "RESPOND_WITH_CARD",
      playerId: noWindowState.players[1].id,
      cardInstanceId: "substance_na2co3_01",
    });

    expect(rejectedNoWindow).toBe(noWindowState);
    expectCardZonesToBeConsistent(rejectedNoWindow);
  });

  it("does not write Na2CO3 success logs for illegal calls", () => {
    let baseAttackState = createResponseTestGame(
      "substance_naoh_dilute_01",
      "substance_na2co3_01",
    );
    const [baseAttacker, baseResponder] = baseAttackState.players;

    baseAttackState = engineReducer(baseAttackState, {
      type: "PLAY_CARD",
      playerId: baseAttacker.id,
      cardInstanceId: "substance_naoh_dilute_01",
      targetPlayerId: baseResponder.id,
    });

    const rejectedBaseResponse = engineReducer(baseAttackState, {
      type: "RESPOND_WITH_CARD",
      playerId: baseResponder.id,
      cardInstanceId: "substance_na2co3_01",
    });

    expect(rejectedBaseResponse).toBe(baseAttackState);
    expect(rejectedBaseResponse.log.some((entry) => entry.message.includes("生成 CO2"))).toBe(false);
    expect(
      rejectedBaseResponse.log.some(
        (entry) => entry.message.includes("Na2CO3") && entry.message.includes("原伤害取消"),
      ),
    ).toBe(false);
    expectCardZonesToBeConsistent(rejectedBaseResponse);

    let noWindowState = createInitialGame({ shuffle: identityShuffle });
    noWindowState = putCardInHand(noWindowState, noWindowState.players[1].id, "substance_na2co3_01");

    const rejectedNoWindow = engineReducer(noWindowState, {
      type: "RESPOND_WITH_CARD",
      playerId: noWindowState.players[1].id,
      cardInstanceId: "substance_na2co3_01",
    });

    expect(rejectedNoWindow).toBe(noWindowState);
    expect(rejectedNoWindow.log.some((entry) => entry.message.includes("生成 CO2"))).toBe(false);
    expect(
      rejectedNoWindow.log.some(
        (entry) => entry.message.includes("Na2CO3") && entry.message.includes("原伤害取消"),
      ),
    ).toBe(false);
    expectCardZonesToBeConsistent(rejectedNoWindow);
  });

  it("deals 1 damage when the target passes an HCl response", () => {
    let state = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const [attacker, responder] = state.players;

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: responder.id,
    });

    state = engineReducer(state, {
      type: "PASS_RESPONSE",
      playerId: responder.id,
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.players[1].hp).toBe(9);
    expect(state.discardPile).toContain("substance_hcl_dilute_01");
    expect(state.players[0].hand).not.toContain("substance_hcl_dilute_01");
    expect(state.activePlayerId).toBe(responder.id);
    expect(state.log.some((entry) => entry.message.includes("受到 1 点酸性伤害"))).toBe(true);
    expectCardZonesToBeConsistent(state);
  });

  it("rejects illegal response cards", () => {
    let state = createResponseTestGame("substance_hcl_dilute_01", "substance_co2_01");
    const [attacker, responder] = state.players;

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: responder.id,
    });

    const rejected = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_co2_01",
    });

    expect(rejected).toBe(state);
    expect(rejected.pendingResponse?.responderId).toBe(responder.id);
    expect(rejected.players[1].hand).toContain("substance_co2_01");
    expect(rejected.discardPile).not.toContain("substance_co2_01");
    expectCardZonesToBeConsistent(rejected);
  });

  it("rejects main-action plays from a non-current player", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [activePlayer, inactivePlayer] = state.players;
    state = putCardInHand(state, inactivePlayer.id, "substance_hcl_dilute_01");

    const rejected = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: inactivePlayer.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: activePlayer.id,
    });

    expect(rejected).toBe(state);
    expect(rejected.pendingResponse).toBeUndefined();
    expect(rejected.phase).toBe("mainAction");
    expectCardZonesToBeConsistent(rejected);
  });

  it("rejects non-alpha main-action cards through PLAY_CARD", () => {
    const rejectedCardIds: CardInstanceId[] = [
      "element_o_01",
      "ion_h_01",
      "substance_h2o_01",
      "substance_co2_01",
      "substance_na2co3_01",
    ];

    for (const cardId of rejectedCardIds) {
      let state = createInitialGame({ shuffle: identityShuffle });
      const [attacker, target] = state.players;
      state = putCardInHand(state, attacker.id, cardId);

      const rejected = engineReducer(state, {
        type: "PLAY_CARD",
        playerId: attacker.id,
        cardInstanceId: cardId,
        targetPlayerId: target.id,
      });

      expect(rejected).toBe(state);
      expect(rejected.pendingResponse).toBeUndefined();
      expectCardZonesToBeConsistent(rejected);
    }
  });

  it("rejects eliminated actors and eliminated targets", () => {
    let eliminatedActorState = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const [actor, target] = eliminatedActorState.players;
    eliminatedActorState = updatePlayer(eliminatedActorState, actor.id, (player) => ({
      ...player,
      hp: 0,
      eliminated: true,
    }));

    const rejectedActor = engineReducer(eliminatedActorState, {
      type: "PLAY_CARD",
      playerId: actor.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: target.id,
    });

    expect(rejectedActor).toBe(eliminatedActorState);
    expect(rejectedActor.pendingResponse).toBeUndefined();
    expectCardZonesToBeConsistent(rejectedActor);

    let eliminatedTargetState = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const [liveActor, eliminatedTarget] = eliminatedTargetState.players;
    eliminatedTargetState = updatePlayer(eliminatedTargetState, eliminatedTarget.id, (player) => ({
      ...player,
      hp: 0,
      eliminated: true,
    }));

    const rejectedTarget = engineReducer(eliminatedTargetState, {
      type: "PLAY_CARD",
      playerId: liveActor.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: eliminatedTarget.id,
    });

    expect(rejectedTarget).toBe(eliminatedTargetState);
    expect(rejectedTarget.pendingResponse).toBeUndefined();
    expectCardZonesToBeConsistent(rejectedTarget);
  });

  it("rejects acid responses to acid damage and base responses to base damage", () => {
    let acidIntoAcid = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_h2so4_dilute_01",
    );
    const [acidAttacker, acidResponder] = acidIntoAcid.players;
    acidIntoAcid = engineReducer(acidIntoAcid, {
      type: "PLAY_CARD",
      playerId: acidAttacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: acidResponder.id,
    });

    const rejectedAcid = engineReducer(acidIntoAcid, {
      type: "RESPOND_WITH_CARD",
      playerId: acidResponder.id,
      cardInstanceId: "substance_h2so4_dilute_01",
    });

    expect(rejectedAcid).toBe(acidIntoAcid);
    expectCardZonesToBeConsistent(rejectedAcid);

    let baseIntoBase = createResponseTestGame(
      "substance_naoh_dilute_01",
      "substance_koh_dilute_01",
    );
    const [baseAttacker, baseResponder] = baseIntoBase.players;
    baseIntoBase = engineReducer(baseIntoBase, {
      type: "PLAY_CARD",
      playerId: baseAttacker.id,
      cardInstanceId: "substance_naoh_dilute_01",
      targetPlayerId: baseResponder.id,
    });

    const rejectedBase = engineReducer(baseIntoBase, {
      type: "RESPOND_WITH_CARD",
      playerId: baseResponder.id,
      cardInstanceId: "substance_koh_dilute_01",
    });

    expect(rejectedBase).toBe(baseIntoBase);
    expectCardZonesToBeConsistent(rejectedBase);
  });

  it("eliminates a player at 0 hp and ends the game when only one survivor remains", () => {
    let state = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const [attacker, responder] = state.players;
    state = updatePlayer(state, responder.id, (player) => ({ ...player, hp: 1 }));

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: responder.id,
    });
    state = engineReducer(state, {
      type: "PASS_RESPONSE",
      playerId: responder.id,
    });

    expect(state.players[1]).toMatchObject({ hp: 0, eliminated: true });
    expect(state.phase).toBe("gameOver");
    expect(state.winnerPlayerId).toBe(attacker.id);
    expect(state.isDraw).toBeUndefined();
    expect(state.log.some((entry) => entry.message.includes("被淘汰"))).toBe(true);
    expectCardZonesToBeConsistent(state);
  });

  it("rejects eliminated responders for RESPOND_WITH_CARD and PASS_RESPONSE", () => {
    let responseState = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const [, responder] = responseState.players;
    responseState = startAttack(responseState);
    responseState = updatePlayer(responseState, responder.id, (player) => ({
      ...player,
      hp: 0,
      eliminated: true,
    }));

    const rejectedResponse = engineReducer(responseState, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_naoh_dilute_01",
    });

    const rejectedPass = engineReducer(responseState, {
      type: "PASS_RESPONSE",
      playerId: responder.id,
    });

    expect(rejectedResponse).toBe(responseState);
    expect(rejectedPass).toBe(responseState);
    expectCardZonesToBeConsistent(rejectedResponse);
    expectCardZonesToBeConsistent(rejectedPass);
  });

  it("does not resolve PASS_RESPONSE twice from the latest state", () => {
    let state = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const [, responder] = state.players;

    state = startAttack(state);
    const resolved = engineReducer(state, {
      type: "PASS_RESPONSE",
      playerId: responder.id,
    });
    const repeated = engineReducer(resolved, {
      type: "PASS_RESPONSE",
      playerId: responder.id,
    });

    expect(repeated).toBe(resolved);
    expect(repeated.players[1].hp).toBe(9);
    expect(repeated.discardPile.filter((cardId) => cardId === "substance_hcl_dilute_01")).toHaveLength(1);
    expectCardZonesToBeConsistent(repeated);
  });

  it("clears PendingResponse after pass or neutralization", () => {
    let neutralized = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const [neutralizeAttacker, neutralizeResponder] = neutralized.players;

    neutralized = engineReducer(neutralized, {
      type: "PLAY_CARD",
      playerId: neutralizeAttacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: neutralizeResponder.id,
    });
    neutralized = engineReducer(neutralized, {
      type: "RESPOND_WITH_CARD",
      playerId: neutralizeResponder.id,
      cardInstanceId: "substance_naoh_dilute_01",
    });

    let passed = createResponseTestGame("substance_hcl_dilute_01", "substance_naoh_dilute_01");
    const [passAttacker, passResponder] = passed.players;

    passed = engineReducer(passed, {
      type: "PLAY_CARD",
      playerId: passAttacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: passResponder.id,
    });
    passed = engineReducer(passed, {
      type: "PASS_RESPONSE",
      playerId: passResponder.id,
    });

    expect(neutralized.pendingResponse).toBeUndefined();
    expect(passed.pendingResponse).toBeUndefined();
    expectCardZonesToBeConsistent(neutralized);
    expectCardZonesToBeConsistent(passed);
  });

  it("cleans up exactly once after a final third-round neutralization", () => {
    let state = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const [responder, attacker] = state.players;

    state = {
      ...state,
      activePlayerId: attacker.id,
      roundInCycle: 3,
    };

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_naoh_dilute_01",
      targetPlayerId: responder.id,
    });
    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_hcl_dilute_01",
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.phase).toBe("mainAction");
    expect(state.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expectCardZonesToBeConsistent(state);
  });

  it("cleans up exactly once after a final third-round Na2CO3 response", () => {
    let state = createResponseTestGame(
      "substance_na2co3_01",
      "substance_hcl_dilute_01",
    );
    const [responder, attacker] = state.players;

    state = {
      ...state,
      activePlayerId: attacker.id,
      roundInCycle: 3,
    };

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: responder.id,
    });
    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_na2co3_01",
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.players[0].hp).toBe(10);
    expect(state.discardPile.filter((cardId) => cardId === "substance_hcl_dilute_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "substance_na2co3_01")).toHaveLength(1);
    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.phase).toBe("mainAction");
    expect(state.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expectCardZonesToBeConsistent(state);
  });

  it("cleans up exactly once after a final third-round CO3^2- ion response", () => {
    let state = createResponseTestGame("ion_co3_01", "substance_hcl_dilute_01");
    const [responder, attacker] = state.players;
    const initialCo2Count = countCardDefinition(state, "substance_co2");

    state = {
      ...state,
      activePlayerId: attacker.id,
      roundInCycle: 3,
    };

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: responder.id,
    });
    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "ion_co3_01",
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.players[0].hp).toBe(10);
    expect(state.discardPile.filter((cardId) => cardId === "substance_hcl_dilute_01")).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "ion_co3_01")).toHaveLength(1);
    expect(countCardDefinition(state, "substance_co2")).toBe(initialCo2Count);
    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.phase).toBe("mainAction");
    expect(state.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expectCardZonesToBeConsistent(state);
  });

  it("cleans up exactly once after a final third-round virtual DIY response", () => {
    let carbonate = createVirtualDIYResponseGame("ion_co3_01", {
      activePlayerIndex: 1,
      roundInCycle: 3,
    });
    const carbonateResponder = carbonate.players[0];

    carbonate = engineReducer(carbonate, {
      type: "RESPOND_WITH_CARD",
      playerId: carbonateResponder.id,
      cardInstanceId: "ion_co3_01",
    });

    expect(carbonate.pendingResponse).toBeUndefined();
    expect(carbonate.players[0].hp).toBe(10);
    expect(carbonate.discardPile.filter((cardId) => cardId === "ion_co3_01")).toHaveLength(1);
    expect(carbonate.cycleNumber).toBe(2);
    expect(carbonate.roundInCycle).toBe(1);
    expect(carbonate.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expectTotalCardInstances(carbonate);
    expectCardZonesToBeConsistent(carbonate);

    let passed = createVirtualDIYResponseGame(undefined, {
      activePlayerIndex: 1,
      roundInCycle: 3,
    });
    const passingResponder = passed.players[0];

    passed = engineReducer(passed, {
      type: "PASS_RESPONSE",
      playerId: passingResponder.id,
    });

    expect(passed.pendingResponse).toBeUndefined();
    expect(passed.players[0].hp).toBe(9);
    expect(passed.cycleNumber).toBe(2);
    expect(passed.roundInCycle).toBe(1);
    expect(passed.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expectTotalCardInstances(passed);
    expectCardZonesToBeConsistent(passed);
  });

  it("cleans up exactly once after a final third-round virtual DIY acid attack is answered by Na2CO3", () => {
    let state = createVirtualDIYResponseGame("substance_na2co3_01", {
      activePlayerIndex: 1,
      roundInCycle: 3,
    });
    const responder = state.players[0];

    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_na2co3_01",
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.discardPile.filter((cardId) => cardId === "substance_na2co3_01")).toHaveLength(1);
    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("cleans up exactly once after a final third-round virtual DIY attack is neutralized", () => {
    let state = createVirtualDIYResponseGame("substance_naoh_dilute_01", {
      activePlayerIndex: 1,
      roundInCycle: 3,
    });
    const responder = state.players[0];

    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_naoh_dilute_01",
    });

    expect(state.pendingResponse).toBeUndefined();
    expect(state.discardPile.filter((cardId) => cardId === "substance_naoh_dilute_01")).toHaveLength(1);
    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.log.filter((entry) => entry.message.includes("实验周期结束"))).toHaveLength(1);
    expectTotalCardInstances(state);
    expectCardZonesToBeConsistent(state);
  });

  it("ends the game exactly once after a final third-round passed response eliminates a player", () => {
    let state = createResponseTestGame(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const [responder, attacker] = state.players;

    state = {
      ...state,
      activePlayerId: attacker.id,
      roundInCycle: 3,
    };
    state = updatePlayer(state, responder.id, (player) => ({ ...player, hp: 1 }));

    state = engineReducer(state, {
      type: "PLAY_CARD",
      playerId: attacker.id,
      cardInstanceId: "substance_naoh_dilute_01",
      targetPlayerId: responder.id,
    });
    const resolved = engineReducer(state, {
      type: "PASS_RESPONSE",
      playerId: responder.id,
    });
    const repeated = engineReducer(resolved, {
      type: "PASS_RESPONSE",
      playerId: responder.id,
    });

    expect(repeated).toBe(resolved);
    expect(resolved.phase).toBe("gameOver");
    expect(resolved.winnerPlayerId).toBe(attacker.id);
    expect(resolved.cycleNumber).toBe(1);
    expect(resolved.log.filter((entry) => entry.message.includes("获胜"))).toHaveLength(1);
    expectCardZonesToBeConsistent(resolved);
  });
});
