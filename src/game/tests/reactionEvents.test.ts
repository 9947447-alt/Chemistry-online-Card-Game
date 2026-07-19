import { describe, expect, expectTypeOf, it } from "vitest";
import { reactionDefinitionIds, reactionDefinitions } from "../data/reactions";
import { starterDeckSize } from "../data/starterDeck";
import { createInitialGame } from "../engine/createInitialGame";
import { engineReducer } from "../engine/reducer";
import type {
  CardInstanceId,
  CharacterId,
  GameState,
  PlayerId,
} from "../engine/types";
import type { SuccessfulReactionEvent } from "../engine/reactions";
import { getReactionLogView } from "../../features/local-game/localGameView";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";

function createGame(
  characterIds: [CharacterId, CharacterId] = [
    "clumsy_party_secretary",
    "clumsy_party_secretary",
  ],
): GameState {
  return createInitialGame({ characterIds, shuffle: identityShuffle });
}

function putCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState {
  const card = state.cardInstances[cardInstanceId];
  if (!card) {
    throw new Error(`Missing test card ${cardInstanceId}`);
  }

  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand: player.id === playerId
        ? [...player.hand.filter((cardId) => cardId !== cardInstanceId), cardInstanceId]
        : player.hand.filter((cardId) => cardId !== cardInstanceId),
    })),
    deck: state.deck.filter((cardId) => cardId !== cardInstanceId),
    discardPile: state.discardPile.filter((cardId) => cardId !== cardInstanceId),
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

function getReactionEvents(state: GameState): SuccessfulReactionEvent[] {
  return state.log.flatMap((entry) => entry.reaction ? [entry.reaction] : []);
}

function startCardAttack(
  state: GameState,
  attackerCardId: CardInstanceId,
): GameState {
  const [attacker, responder] = state.players;
  return engineReducer(state, {
    type: "PLAY_CARD",
    playerId: attacker.id,
    cardInstanceId: attackerCardId,
    targetPlayerId: responder.id,
  });
}

function resolveCardResponse(
  state: GameState,
  responderCardId: CardInstanceId,
): GameState {
  const responderId = state.pendingResponse?.responderId;
  if (!responderId) {
    throw new Error("Expected a pending response.");
  }

  return engineReducer(state, {
    type: "RESPOND_WITH_CARD",
    playerId: responderId,
    cardInstanceId: responderCardId,
  });
}

function createCardResponseState(
  attackerCardId: CardInstanceId,
  responderCardId: CardInstanceId,
  characterIds?: [CharacterId, CharacterId],
): GameState {
  let state = createGame(characterIds);
  state = putCardInHand(state, state.players[0].id, attackerCardId);
  state = putCardInHand(state, state.players[1].id, responderCardId);
  return startCardAttack(state, attackerCardId);
}

function startVirtualDiyAttack(input: {
  recipeId: string;
  componentCardIds: CardInstanceId[];
  responseCardId: CardInstanceId;
}): GameState {
  let state = createGame();
  const [attacker, responder] = state.players;

  for (const cardId of input.componentCardIds) {
    state = putCardInHand(state, attacker.id, cardId);
  }
  state = putCardInHand(state, responder.id, input.responseCardId);

  return engineReducer(state, {
    type: "START_ACTIVE_DIY",
    playerId: attacker.id,
    recipeId: input.recipeId,
    componentCardInstanceIds: input.componentCardIds,
    targetPlayerId: responder.id,
  });
}

function addStatusWindow(
  state: GameState,
  playerId: PlayerId,
  statusId: "SO2_LEAK" | "FIRE",
): GameState {
  const statusInstanceId = `status_reaction_test_${statusId}`;
  return {
    ...state,
    activePlayerId: playerId,
    phase: "statusWindow",
    pendingStatusHandling: { playerId, statusInstanceId },
    players: state.players.map((player) => player.id === playerId
      ? {
          ...player,
          statuses: [
            ...player.statuses,
            { id: statusInstanceId, statusId, createdAt: state.log.length + 1 },
          ],
        }
      : player),
  };
}

describe("Phase 10 successful reaction events", () => {
  it("defines exactly the three frozen reaction definitions", () => {
    expectTypeOf(reactionDefinitions).toMatchTypeOf<
      readonly Readonly<{ id: (typeof reactionDefinitionIds)[number] }>[]
    >();
    expect(reactionDefinitionIds).toEqual([
      "acid_base_neutralization",
      "acid_carbonate_co2",
      "so2_alkaline_absorption",
    ]);
    expect(reactionDefinitions.map((definition) => definition.id)).toEqual(
      reactionDefinitionIds,
    );
    expect(new Set(reactionDefinitionIds).size).toBe(3);
    expect(
      reactionDefinitions.some((definition) =>
        definition.id.toLowerCase().includes("fire"),
      ),
    ).toBe(false);
    expect(
      reactionDefinitions.some((definition) =>
        /metal|precipitate|equation|response[_-]?diy/i.test(definition.id),
      ),
    ).toBe(false);
  });

  it.each([
    {
      attackerCardId: "substance_hcl_dilute_01",
      responderCardId: "substance_naoh_dilute_01",
      attackerDefinitionId: "substance_hcl_dilute",
    },
    {
      attackerCardId: "substance_naoh_dilute_01",
      responderCardId: "substance_hcl_dilute_01",
      attackerDefinitionId: "substance_naoh_dilute",
    },
  ])("records one entity acid/base neutralization for $attackerCardId", (input) => {
    const responseState = createCardResponseState(
      input.attackerCardId,
      input.responderCardId,
    );
    const responderHp = responseState.players[1].hp;
    const resolved = resolveCardResponse(responseState, input.responderCardId);
    const events = getReactionEvents(resolved);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      definitionId: "acid_base_neutralization",
      trigger: { kind: "single-damage-response", responsePolicy: "acid-base" },
      participants: [
        {
          kind: "card",
          playerId: responseState.players[0].id,
          cardInstanceId: input.attackerCardId,
          cardDefinitionId: input.attackerDefinitionId,
          role: "attacker",
        },
        {
          kind: "card",
          playerId: responseState.players[1].id,
          cardInstanceId: input.responderCardId,
          role: "responder",
        },
      ],
      outcome: { kind: "virtual-product", product: "H2O", damageCancelled: true },
    });
    expect(resolved.players[1].hp).toBe(responderHp);
    expect(resolved.discardPile.filter((cardId) => cardId === input.attackerCardId)).toHaveLength(1);
    expect(resolved.discardPile.filter((cardId) => cardId === input.responderCardId)).toHaveLength(1);
    expect(Object.keys(resolved.cardInstances)).toHaveLength(starterDeckSize);
    expectCardZonesToBeConsistent(resolved);
  });

  it.each([
    {
      recipeId: "diy_hcl_from_h_cl",
      componentCardIds: ["ion_h_01", "ion_cl_01"],
      responseCardId: "substance_naoh_dilute_01",
    },
    {
      recipeId: "diy_naoh_from_na_oh",
      componentCardIds: ["ion_na_01", "ion_oh_01"],
      responseCardId: "substance_hcl_dilute_01",
    },
  ])("records a virtual DIY neutralization for $recipeId", (input) => {
    const responseState = startVirtualDiyAttack(input);

    expect(responseState.phase).toBe("responseWindow");
    expect(getReactionEvents(responseState)).toHaveLength(0);

    const resolved = resolveCardResponse(responseState, input.responseCardId);
    const event = getReactionEvents(resolved)[0];

    expect(event).toMatchObject({
      definitionId: "acid_base_neutralization",
      participants: [
        {
          kind: "diy",
          playerId: responseState.players[0].id,
          recipeId: input.recipeId,
          role: "attacker",
        },
        { kind: "card", role: "responder" },
      ],
      outcome: { kind: "virtual-product", product: "H2O" },
    });
    expect(Object.keys(resolved.cardInstances)).toHaveLength(starterDeckSize);
    expectCardZonesToBeConsistent(resolved);
  });

  it.each([
    "ion_co3_01",
    "substance_na2co3_01",
  ])("records virtual CO2 for an entity acid response with %s", (responseCardId) => {
    let responseState = createCardResponseState(
      "substance_hcl_dilute_01",
      responseCardId,
    );
    const responder = responseState.players[1];
    responseState = {
      ...responseState,
      players: responseState.players.map((player) => player.id === responder.id
        ? {
            ...player,
            statuses: [
              ...player.statuses,
              { id: "fire_preserved", statusId: "FIRE", createdAt: 999 },
            ],
          }
        : player),
    };
    const co2Count = Object.values(responseState.cardInstances).filter(
      (card) => card.definitionId === "substance_co2",
    ).length;
    const resolved = resolveCardResponse(responseState, responseCardId);
    const event = getReactionEvents(resolved)[0];

    expect(event).toMatchObject({
      definitionId: "acid_carbonate_co2",
      outcome: { kind: "virtual-product", product: "CO2", damageCancelled: true },
    });
    expect(
      resolved.players[1].statuses.some((status) => status.id === "fire_preserved"),
    ).toBe(true);
    expect(Object.values(resolved.cardInstances).filter(
      (card) => card.definitionId === "substance_co2",
    )).toHaveLength(co2Count);
    expect(Object.keys(resolved.cardInstances)).toHaveLength(starterDeckSize);
  });

  it.each([
    "ion_co3_01",
    "substance_na2co3_01",
  ])("records virtual CO2 for a DIY acid response with %s", (responseCardId) => {
    const responseState = startVirtualDiyAttack({
      recipeId: "diy_hcl_from_h_cl",
      componentCardIds: ["ion_h_01", "ion_cl_01"],
      responseCardId,
    });
    const resolved = resolveCardResponse(responseState, responseCardId);

    expect(getReactionEvents(resolved)).toMatchObject([
      {
        definitionId: "acid_carbonate_co2",
        participants: [
          { kind: "diy", recipeId: "diy_hcl_from_h_cl", role: "attacker" },
          { kind: "card", cardInstanceId: responseCardId, role: "responder" },
        ],
        outcome: { kind: "virtual-product", product: "CO2" },
      },
    ]);
    expect(Object.keys(resolved.cardInstances)).toHaveLength(starterDeckSize);
  });

  it("uses one SO2 definition with distinct immediate and status triggers", () => {
    let immediate = createGame([
      "clumsy_party_secretary",
      "caustic_soda_captain",
    ]);
    immediate = putCardInHand(immediate, immediate.players[1].id, "ion_oh_01");
    immediate = engineReducer(immediate, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: immediate.players[0].id,
      skillId: "exhaust_leak",
    });
    immediate = resolveCardResponse(immediate, "ion_oh_01");

    let status = createGame();
    status = putCardInHand(status, status.players[0].id, "substance_naoh_dilute_01");
    status = addStatusWindow(status, status.players[0].id, "SO2_LEAK");
    status = engineReducer(status, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: status.players[0].id,
      statusInstanceId: "status_reaction_test_SO2_LEAK",
      cardInstanceId: "substance_naoh_dilute_01",
    });

    const immediateEvent = getReactionEvents(immediate)[0];
    const statusEvent = getReactionEvents(status)[0];
    expect(immediateEvent).toMatchObject({
      definitionId: "so2_alkaline_absorption",
      trigger: { kind: "multi-target-damage-response", sourceSkillId: "exhaust_leak" },
      participants: [
        { kind: "character-skill", skillId: "exhaust_leak" },
        { kind: "card", role: "responder" },
      ],
      outcome: { kind: "damage-cancelled", finalDamage: 0 },
    });
    expect(statusEvent).toMatchObject({
      definitionId: "so2_alkaline_absorption",
      trigger: { kind: "status-handling", statusId: "SO2_LEAK" },
      participants: [
        { kind: "status", statusInstanceId: "status_reaction_test_SO2_LEAK" },
        { kind: "card", role: "status-handler" },
      ],
      outcome: {
        kind: "status-removed",
        statusInstanceId: "status_reaction_test_SO2_LEAK",
      },
    });
    expect(immediate.players[1].statuses).toHaveLength(0);
    expect(status.players[0].statuses).toHaveLength(0);
    expectCardZonesToBeConsistent(immediate);
    expectCardZonesToBeConsistent(status);
  });

  it("does not create events for pass, illegal response, ordinary play, or DIY construction", () => {
    let passState = createCardResponseState(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const illegal = engineReducer(passState, {
      type: "RESPOND_WITH_CARD",
      playerId: passState.players[0].id,
      cardInstanceId: "substance_naoh_dilute_01",
    });
    expect(illegal).toBe(passState);
    passState = engineReducer(passState, {
      type: "PASS_RESPONSE",
      playerId: passState.players[1].id,
    });
    expect(getReactionEvents(passState)).toHaveLength(0);

    let ordinary = createGame();
    ordinary = putCardInHand(ordinary, ordinary.players[0].id, "ion_so4_01");
    ordinary = engineReducer(ordinary, {
      type: "PLAY_REFERENCE_CARD",
      playerId: ordinary.players[0].id,
      cardInstanceId: "ion_so4_01",
    });
    expect(getReactionEvents(ordinary)).toHaveLength(0);

    const diyResponse = startVirtualDiyAttack({
      recipeId: "diy_h2so4_from_2h_so4",
      componentCardIds: ["ion_h_01", "ion_h_02", "ion_so4_01"],
      responseCardId: "substance_naoh_dilute_01",
    });
    expect(getReactionEvents(diyResponse)).toHaveLength(0);
    const passedDiy = engineReducer(diyResponse, {
      type: "PASS_RESPONSE",
      playerId: diyResponse.players[1].id,
    });
    expect(getReactionEvents(passedDiy)).toHaveLength(0);

    const passActionState = createGame();
    const passedAction = engineReducer(passActionState, {
      type: "PASS_ACTION",
      playerId: passActionState.activePlayerId,
    });
    expect(getReactionEvents(passedAction)).toHaveLength(0);
  });

  it("keeps FIRE treatment and unresolved FIRE/SO2 status damage outside reaction events", () => {
    let fire = createGame();
    fire = putCardInHand(fire, fire.players[0].id, "substance_h2o_01");
    fire = addStatusWindow(fire, fire.players[0].id, "FIRE");
    fire = engineReducer(fire, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: fire.players[0].id,
      statusInstanceId: "status_reaction_test_FIRE",
      cardInstanceId: "substance_h2o_01",
    });
    expect(getReactionEvents(fire)).toHaveLength(0);

    for (const statusId of ["FIRE", "SO2_LEAK"] as const) {
      let unresolved = addStatusWindow(createGame(), "player_1", statusId);
      unresolved = engineReducer(unresolved, {
        type: "PASS_STATUS_HANDLING",
        playerId: "player_1",
        statusInstanceId: `status_reaction_test_${statusId}`,
      });
      expect(getReactionEvents(unresolved)).toHaveLength(0);
    }
  });

  it("does not eventize immunity or damage modified to zero", () => {
    let state = createCardResponseState(
      "substance_naoh_dilute_01",
      "substance_hcl_dilute_01",
      ["clumsy_party_secretary", "caustic_soda_captain"],
    );
    const hpBefore = state.players[1].hp;
    state = engineReducer(state, {
      type: "PASS_RESPONSE",
      playerId: state.players[1].id,
    });

    expect(state.players[1].hp).toBe(hpBefore);
    expect(getReactionEvents(state)).toHaveLength(0);
  });

  it("records the original reaction once across an experiment-counterattack continuation", () => {
    let state = createGame([
      "clumsy_party_secretary",
      "chemistry_enthusiast",
    ]);
    state = putCardInHand(state, state.players[0].id, "substance_hcl_dilute_01");
    state = putCardInHand(state, state.players[1].id, "substance_naoh_dilute_01");
    state = putCardInHand(state, state.players[1].id, "substance_hcl_dilute_02");
    state = startCardAttack(state, "substance_hcl_dilute_01");
    state = resolveCardResponse(state, "substance_naoh_dilute_01");

    expect(state.phase).toBe("experimentCounterattackWindow");
    expect(getReactionEvents(state)).toHaveLength(1);

    state = engineReducer(state, {
      type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
      playerId: state.players[1].id,
      option: "acid-base-pursuit",
      cardInstanceId: "substance_hcl_dilute_02",
    });

    expect(getReactionEvents(state)).toHaveLength(1);
    expect(state.discardPile.filter((cardId) => cardId === "substance_naoh_dilute_01")).toHaveLength(1);
    expectCardZonesToBeConsistent(state);
  });

  it("preserves the multi-target continuation snapshot and records its event once", () => {
    let state = createGame([
      "clumsy_party_secretary",
      "chemistry_enthusiast",
    ]);
    state = putCardInHand(state, state.players[1].id, "ion_oh_01");
    state = putCardInHand(state, state.players[1].id, "substance_hcl_dilute_01");
    state = engineReducer(state, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: state.players[0].id,
      skillId: "exhaust_leak",
    });
    state = resolveCardResponse(state, "ion_oh_01");

    expect(state.phase).toBe("experimentCounterattackWindow");
    expect(state.pendingExperimentCounterattack?.continuation).toMatchObject({
      kind: "multi-target-response",
      sequence: {
        targetPlayerIds: [state.players[1].id],
        remainingTargetPlayerIds: [],
        completedResults: [],
      },
      completedResult: {
        targetPlayerId: state.players[1].id,
        outcome: "absorbed",
        finalDamage: 0,
      },
    });

    state = engineReducer(state, {
      type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
      playerId: state.players[1].id,
      option: "acid-base-pursuit",
      cardInstanceId: "substance_hcl_dilute_01",
    });

    expect(getReactionEvents(state)).toHaveLength(1);
    expect(state.pendingResponse).toBeUndefined();
    expect(state.pendingExperimentCounterattack).toBeUndefined();
    expectCardZonesToBeConsistent(state);
  });

  it("records the final SO2 absorption before the multi-target penalty resolves gameOver", () => {
    let state = createGame([
      "clumsy_party_secretary",
      "caustic_soda_captain",
    ]);
    state = putCardInHand(state, state.players[1].id, "ion_oh_01");
    state = {
      ...state,
      players: state.players.map((player) => player.id === state.players[0].id
        ? { ...player, hp: 1 }
        : player),
    };
    state = engineReducer(state, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: state.players[0].id,
      skillId: "exhaust_leak",
    });
    state = resolveCardResponse(state, "ion_oh_01");

    expect(state.phase).toBe("gameOver");
    expect(state.winnerPlayerId).toBe(state.players[1].id);
    expect(getReactionEvents(state)).toHaveLength(1);
    expect(state.pendingResponse).toBeUndefined();
    expect(state.discardPile.filter((cardId) => cardId === "ion_oh_01")).toHaveLength(1);
  });

  it("keeps later status ordering after an eventized SO2_LEAK treatment", () => {
    let state = createGame();
    state = putCardInHand(state, "player_1", "ion_oh_01");
    state = addStatusWindow(state, "player_1", "SO2_LEAK");
    state = {
      ...state,
      players: state.players.map((player) => player.id === "player_1"
        ? {
            ...player,
            statuses: [
              ...player.statuses,
              { id: "later_fire", statusId: "FIRE", createdAt: state.log.length + 2 },
            ],
          }
        : player),
    };
    state = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: "player_1",
      statusInstanceId: "status_reaction_test_SO2_LEAK",
      cardInstanceId: "ion_oh_01",
    });

    expect(getReactionEvents(state)).toHaveLength(1);
    expect(state.phase).toBe("statusWindow");
    expect(state.pendingStatusHandling).toEqual({
      playerId: "player_1",
      statusInstanceId: "later_fire",
    });
    expect(state.players[0].statuses.map((status) => status.id)).toEqual(["later_fire"]);
  });

  it("builds the UI view model only from a structured reaction field", () => {
    const responseState = createCardResponseState(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const resolved = resolveCardResponse(responseState, "substance_naoh_dilute_01");
    const reactionEntry = resolved.log.find((entry) => entry.reaction);
    const ordinaryEntry = resolved.log.find((entry) => !entry.reaction);

    expect(reactionEntry && getReactionLogView(resolved, reactionEntry)).toEqual({
      name: "酸碱中和",
      trigger: "单目标伤害响应",
      participants: [
        "攻击来源：玩家 A · 稀 HCl",
        "响应牌：玩家 B · 稀 NaOH",
      ],
      outcome: "原伤害完全取消；H2O 为虚拟结果，不创建 CardInstance",
    });
    expect(ordinaryEntry && getReactionLogView(resolved, ordinaryEntry)).toBeUndefined();
  });

  it("keeps event snapshots stable after participant zones change later", () => {
    const responseState = createCardResponseState(
      "substance_hcl_dilute_01",
      "substance_naoh_dilute_01",
    );
    const resolved = resolveCardResponse(responseState, "substance_naoh_dilute_01");
    const snapshot = getReactionEvents(resolved)[0];
    const laterState = {
      ...resolved,
      deck: [...resolved.deck, "substance_hcl_dilute_01"],
      discardPile: resolved.discardPile.filter(
        (cardId) => cardId !== "substance_hcl_dilute_01",
      ),
      cardInstances: {
        ...resolved.cardInstances,
        substance_hcl_dilute_01: {
          ...resolved.cardInstances.substance_hcl_dilute_01,
          zone: { type: "deck" as const },
        },
      },
    };

    expect(getReactionEvents(laterState)[0]).toBe(snapshot);
    expect(snapshot.participants[0]).toMatchObject({
      kind: "card",
      cardInstanceId: "substance_hcl_dilute_01",
      cardDefinitionId: "substance_hcl_dilute",
      role: "attacker",
    });
  });
});
