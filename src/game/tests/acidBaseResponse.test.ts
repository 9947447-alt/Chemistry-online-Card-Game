import { describe, expect, it } from "vitest";
import { createInitialGame } from "../engine/createInitialGame";
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

  it("rejects CO3^2- ion as a substitute for Na2CO3 against acid damage", () => {
    let state = createResponseTestGame("substance_hcl_dilute_01", "ion_co3_01");
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
      cardInstanceId: "ion_co3_01",
    });

    expect(rejected).toBe(state);
    expect(rejected.pendingResponse).toBeDefined();
    expect(rejected.players[1].hp).toBe(10);
    expect(rejected.players[1].hand).toContain("ion_co3_01");
    expect(rejected.discardPile).not.toContain("ion_co3_01");
    expect(rejected.discardPile).not.toContain("substance_hcl_dilute_01");
    expect(rejected.activePlayerId).toBe(attacker.id);
    expect(rejected.log.some((entry) => entry.message.includes("生成 CO2"))).toBe(false);
    expectCardZonesToBeConsistent(rejected);
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
      "event_lab_fire_01",
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
