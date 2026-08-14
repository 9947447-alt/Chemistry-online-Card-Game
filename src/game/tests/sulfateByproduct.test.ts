import { describe, expect, it } from "vitest";
import { getCharacterDefinition } from "../data/characterDefinitions";
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
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";
import { renderGameLogEntry } from "../../features/local-game/gameLogRenderer";

function createGame(
  characterIds: [CharacterId, CharacterId] = [
    "sulfuric_acid_factory_director",
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

function getByproductLogs(state: GameState) {
  return state.log.filter((entry) => entry.eventKey === "sulfate_byproduct_draw");
}

function startAttack(
  state: GameState,
  attackerCardId: CardInstanceId,
): GameState {
  return engineReducer(state, {
    type: "PLAY_CARD",
    playerId: state.players[0].id,
    cardInstanceId: attackerCardId,
    targetPlayerId: state.players[1].id,
  });
}

function respond(
  state: GameState,
  cardInstanceId: CardInstanceId,
): GameState {
  const responderId = state.pendingResponse?.responderId;
  if (!responderId) {
    throw new Error("Expected a pending response.");
  }

  return engineReducer(state, {
    type: "RESPOND_WITH_CARD",
    playerId: responderId,
    cardInstanceId,
  });
}

function createDirectorAttackResponse(
  responseCardId: CardInstanceId,
  attackCardId: CardInstanceId = "substance_h2so4_dilute_01",
): GameState {
  let state = createGame();
  state = putCardInHand(state, state.players[0].id, attackCardId);
  state = putCardInHand(state, state.players[1].id, responseCardId);
  return startAttack(state, attackCardId);
}

function moveAllCardsToPlayerHand(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const allCardIds = Object.keys(state.cardInstances);
  const cardInstances = Object.fromEntries(
    allCardIds.map((cardId) => [
      cardId,
      {
        ...state.cardInstances[cardId],
        ownerId: playerId,
        zone: { type: "hand" as const, playerId },
      },
    ]),
  );

  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand: player.id === playerId ? allCardIds : [],
    })),
    cardInstances,
    deck: [],
    discardPile: [],
  };
}

describe("Phase 10 sulfate byproduct", () => {
  it("marks the character skill as implemented in Phase 10", () => {
    const skill = getCharacterDefinition("sulfuric_acid_factory_director").skills.find(
      (candidate) => candidate.id === "sulfate_byproduct",
    );

    expect(skill).toMatchObject({
      implementationStatus: "implemented-phase10",
    });
    expect(skill?.implementationNote).toContain("空牌堆失败均不消耗次数");
  });

  it("draws exactly one after an entity H2SO4 acid/base reaction and records strict log order", () => {
    const responseState = createDirectorAttackResponse("substance_naoh_dilute_01");
    const drawnCardId = responseState.deck[0];
    const tableReference = responseState.tableReference;
    const resolved = respond(responseState, "substance_naoh_dilute_01");
    const reactionLogIndex = resolved.log.findIndex((entry) => entry.reaction);
    const byproductLogIndex = resolved.log.findIndex((entry) =>
      entry.eventKey === "sulfate_byproduct_draw",
    );

    expect(getReactionEvents(resolved)).toMatchObject([
      { definitionId: "acid_base_neutralization" },
    ]);
    expect(resolved.players[0].hand).toContain(drawnCardId);
    expect(resolved.players[0].characterUsage.perRound).toEqual({
      sulfuric_acid_factory_director_sulfate_byproduct: 1,
    });
    expect(resolved.players[0].characterUsage.perCycle).toEqual({});
    expect(resolved.players[0].usedDIYThisCycle).toBe(false);
    expect(resolved.tableReference).toEqual(tableReference);
    expect(reactionLogIndex).toBeGreaterThan(-1);
    expect(byproductLogIndex).toBeGreaterThan(reactionLogIndex);
    expect(getByproductLogs(resolved)).toHaveLength(1);
    expect(Object.keys(resolved.cardInstances)).toHaveLength(starterDeckSize);
    expectCardZonesToBeConsistent(resolved);
  });

  it.each([
    "ion_co3_01",
    "substance_na2co3_01",
  ])("draws for entity H2SO4 reacting with %s", (responseCardId) => {
    const responseState = createDirectorAttackResponse(responseCardId);
    const drawnCardId = responseState.deck[0];
    const resolved = respond(responseState, responseCardId);

    expect(getReactionEvents(resolved)).toMatchObject([
      { definitionId: "acid_carbonate_co2" },
    ]);
    expect(resolved.players[0].hand).toContain(drawnCardId);
    expect(resolved.players[0].characterUsage.perRound
      .sulfuric_acid_factory_director_sulfate_byproduct).toBe(1);
    expect(getByproductLogs(resolved)).toHaveLength(1);
  });

  it("draws when the director's entity H2SO4 is the legal acid response", () => {
    let state = createGame([
      "clumsy_party_secretary",
      "sulfuric_acid_factory_director",
    ]);
    state = putCardInHand(state, state.players[0].id, "substance_naoh_dilute_01");
    state = putCardInHand(state, state.players[1].id, "substance_h2so4_dilute_01");
    state = startAttack(state, "substance_naoh_dilute_01");
    const drawnCardId = state.deck[0];
    state = respond(state, "substance_h2so4_dilute_01");

    expect(getReactionEvents(state)).toMatchObject([
      {
        definitionId: "acid_base_neutralization",
        participants: [
          { role: "attacker" },
          {
            playerId: state.players[1].id,
            cardDefinitionId: "substance_h2so4_dilute",
            role: "responder",
          },
        ],
      },
    ]);
    expect(state.players[1].hand).toContain(drawnCardId);
    expect(state.players[1].characterUsage.perRound
      .sulfuric_acid_factory_director_sulfate_byproduct).toBe(1);
  });

  it("does not draw for a non-director entity H2SO4 reaction", () => {
    let state = createGame([
      "clumsy_party_secretary",
      "clumsy_party_secretary",
    ]);
    state = putCardInHand(state, state.players[0].id, "substance_h2so4_dilute_01");
    state = putCardInHand(state, state.players[1].id, "substance_naoh_dilute_01");
    state = startAttack(state, "substance_h2so4_dilute_01");
    const deckBeforeResponse = [...state.deck];
    state = respond(state, "substance_naoh_dilute_01");

    expect(getReactionEvents(state)).toHaveLength(1);
    expect(state.deck).toEqual(deckBeforeResponse);
    expect(state.players[0].characterUsage.perRound).toEqual({});
    expect(getByproductLogs(state)).toHaveLength(0);
  });

  it("does not draw for virtual H2SO4 DIY or for ion_so4 used only as its component", () => {
    let state = createGame();
    const [director, responder] = state.players;
    for (const cardId of ["ion_h_01", "ion_h_02", "ion_so4_01"]) {
      state = putCardInHand(state, director.id, cardId);
    }
    state = putCardInHand(state, responder.id, "substance_naoh_dilute_01");
    state = engineReducer(state, {
      type: "START_ACTIVE_DIY",
      playerId: director.id,
      recipeId: "diy_h2so4_from_2h_so4",
      componentCardInstanceIds: ["ion_h_01", "ion_h_02", "ion_so4_01"],
      targetPlayerId: responder.id,
    });
    const deckBeforeResponse = [...state.deck];
    state = respond(state, "substance_naoh_dilute_01");

    expect(getReactionEvents(state)).toMatchObject([
      {
        definitionId: "acid_base_neutralization",
        participants: [
          { kind: "diy", recipeId: "diy_h2so4_from_2h_so4" },
          { kind: "card", role: "responder" },
        ],
      },
    ]);
    expect(state.deck).toEqual(deckBeforeResponse);
    expect(state.players[0].characterUsage.perRound).toEqual({});
    expect(getByproductLogs(state)).toHaveLength(0);
    expect(Object.keys(state.cardInstances)).toHaveLength(starterDeckSize);
    expectCardZonesToBeConsistent(state);
  });

  it("does not draw for ordinary H2SO4 reference play or a non-sulfate entity reaction", () => {
    let reference = createGame();
    reference = putCardInHand(
      reference,
      reference.players[0].id,
      "substance_h2so4_dilute_01",
    );
    const referenceDeck = [...reference.deck];
    reference = engineReducer(reference, {
      type: "PLAY_REFERENCE_CARD",
      playerId: reference.players[0].id,
      cardInstanceId: "substance_h2so4_dilute_01",
    });
    expect(reference.deck).toEqual(referenceDeck);
    expect(getReactionEvents(reference)).toHaveLength(0);
    expect(getByproductLogs(reference)).toHaveLength(0);

    let nonSulfate = createGame();
    nonSulfate = putCardInHand(
      nonSulfate,
      nonSulfate.players[0].id,
      "substance_hcl_dilute_01",
    );
    nonSulfate = putCardInHand(
      nonSulfate,
      nonSulfate.players[1].id,
      "substance_naoh_dilute_01",
    );
    nonSulfate = startAttack(nonSulfate, "substance_hcl_dilute_01");
    const nonSulfateDeck = [...nonSulfate.deck];
    nonSulfate = respond(nonSulfate, "substance_naoh_dilute_01");
    expect(getReactionEvents(nonSulfate)).toHaveLength(1);
    expect(nonSulfate.deck).toEqual(nonSulfateDeck);
    expect(getByproductLogs(nonSulfate)).toHaveLength(0);
  });

  it("consumes the per-round usage only once across two successful reactions", () => {
    let state = createGame();
    state = putCardInHand(state, state.players[0].id, "substance_h2so4_dilute_01");
    state = putCardInHand(state, state.players[0].id, "substance_h2so4_dilute_02");
    state = putCardInHand(state, state.players[1].id, "substance_naoh_dilute_01");
    state = putCardInHand(state, state.players[1].id, "substance_koh_dilute_01");
    state = startAttack(state, "substance_h2so4_dilute_01");
    state = respond(state, "substance_naoh_dilute_01");
    const deckAfterFirst = [...state.deck];

    state = { ...state, activePlayerId: state.players[0].id, phase: "mainAction" };
    state = startAttack(state, "substance_h2so4_dilute_02");
    state = respond(state, "substance_koh_dilute_01");

    expect(getReactionEvents(state)).toHaveLength(2);
    expect(getByproductLogs(state)).toHaveLength(1);
    expect(state.deck).toEqual(deckAfterFirst);
    expect(state.players[0].characterUsage.perRound).toEqual({
      sulfuric_acid_factory_director_sulfate_byproduct: 1,
    });
    expectCardZonesToBeConsistent(state);
  });

  it("resets per-round usage through normal turn flow and can draw again", () => {
    let state = createGame();
    state = putCardInHand(state, state.players[0].id, "substance_h2so4_dilute_01");
    state = putCardInHand(state, state.players[0].id, "substance_h2so4_dilute_02");
    state = putCardInHand(state, state.players[1].id, "substance_naoh_dilute_01");
    state = putCardInHand(state, state.players[1].id, "substance_koh_dilute_01");
    state = respond(startAttack(state, "substance_h2so4_dilute_01"), "substance_naoh_dilute_01");
    state = engineReducer(state, {
      type: "PASS_ACTION",
      playerId: state.players[1].id,
    });

    expect(state.roundInCycle).toBe(2);
    expect(state.players[0].characterUsage.perRound).toEqual({});

    state = respond(startAttack(state, "substance_h2so4_dilute_02"), "substance_koh_dilute_01");
    expect(getReactionEvents(state)).toHaveLength(2);
    expect(getByproductLogs(state)).toHaveLength(2);
    expect(state.players[0].characterUsage.perRound
      .sulfuric_acid_factory_director_sulfate_byproduct).toBe(1);
  });

  it("resets per-round and per-cycle usage at a normal new cycle", () => {
    let state = createGame();
    state = {
      ...state,
      players: state.players.map((player, index) => index === 0
        ? {
            ...player,
            characterUsage: {
              perCycle: { sulfuric_acid_factory_director_exhaust_discharge: 1 },
              perRound: { sulfuric_acid_factory_director_sulfate_byproduct: 1 },
            },
          }
        : player),
    };

    for (let action = 0; action < 6; action += 1) {
      state = engineReducer(state, {
        type: "PASS_ACTION",
        playerId: state.activePlayerId,
      });
    }

    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.players.every((player) =>
      Object.keys(player.characterUsage.perCycle).length === 0 &&
      Object.keys(player.characterUsage.perRound).length === 0,
    )).toBe(true);

    state = putCardInHand(state, "player_1", "substance_h2so4_dilute_01");
    state = putCardInHand(state, "player_2", "substance_naoh_dilute_01");
    state = respond(
      startAttack(state, "substance_h2so4_dilute_01"),
      "substance_naoh_dilute_01",
    );
    expect(state.players[0].characterUsage.perRound
      .sulfuric_acid_factory_director_sulfate_byproduct).toBe(1);
    expect(getByproductLogs(state)).toHaveLength(1);
  });

  it("recycles the discard pile through the existing draw path", () => {
    let state = moveAllCardsToPlayerHand(createGame(), "player_2");
    state = putCardInHand(state, "player_1", "substance_h2so4_dilute_01");
    state = putCardInHand(state, "player_2", "substance_naoh_dilute_01");
    const supplyCardId = "element_o_01";
    state = {
      ...state,
      players: state.players.map((player) => ({
        ...player,
        hand: player.hand.filter((cardId) => cardId !== supplyCardId),
      })),
      discardPile: [supplyCardId],
      cardInstances: {
        ...state.cardInstances,
        [supplyCardId]: {
          ...state.cardInstances[supplyCardId],
          ownerId: undefined,
          zone: { type: "discard" },
        },
      },
    };
    expectCardZonesToBeConsistent(state);
    state = respond(startAttack(state, "substance_h2so4_dilute_01"), "substance_naoh_dilute_01");

    expect(state.players[0].hand).toHaveLength(1);
    const drawnCardId = state.players[0].hand[0];
    expect(state.cardInstances[drawnCardId]).toMatchObject({
      ownerId: "player_1",
      zone: { type: "hand", playerId: "player_1" },
    });
    expect(state.log.some((entry) => renderGameLogEntry(entry).includes("弃牌堆洗回主牌堆"))).toBe(true);
    expect(getByproductLogs(state)).toHaveLength(1);
    expectCardZonesToBeConsistent(state);
  });

  it("records the reaction but preserves usage when deck and discard were empty, then retries later", () => {
    let state = moveAllCardsToPlayerHand(createGame(), "player_2");
    state = putCardInHand(state, "player_1", "substance_h2so4_dilute_01");
    state = putCardInHand(state, "player_1", "substance_h2so4_dilute_02");
    state = putCardInHand(state, "player_2", "substance_naoh_dilute_01");
    state = putCardInHand(state, "player_2", "substance_koh_dilute_01");
    expect(state.deck).toHaveLength(0);
    expect(state.discardPile).toHaveLength(0);
    expectCardZonesToBeConsistent(state);

    state = respond(startAttack(state, "substance_h2so4_dilute_01"), "substance_naoh_dilute_01");
    expect(getReactionEvents(state)).toHaveLength(1);
    expect(getByproductLogs(state)).toHaveLength(0);
    expect(state.players[0].characterUsage.perRound).toEqual({});

    state = { ...state, activePlayerId: "player_1", phase: "mainAction" };
    state = respond(startAttack(state, "substance_h2so4_dilute_02"), "substance_koh_dilute_01");

    expect(getReactionEvents(state)).toHaveLength(2);
    expect(getByproductLogs(state)).toHaveLength(1);
    expect(state.players[0].characterUsage.perRound
      .sulfuric_acid_factory_director_sulfate_byproduct).toBe(1);
    expect(Object.keys(state.cardInstances)).toHaveLength(starterDeckSize);
    expectCardZonesToBeConsistent(state);
  });

  it("atomically rejects wrong owner, zone, definition snapshot, and eliminated source", () => {
    const valid = createDirectorAttackResponse("substance_naoh_dilute_01");
    const responseCard = valid.cardInstances.substance_naoh_dilute_01;
    const attackCard = valid.cardInstances.substance_h2so4_dilute_01;

    const wrongOwner: GameState = {
      ...valid,
      cardInstances: {
        ...valid.cardInstances,
        substance_naoh_dilute_01: {
          ...responseCard,
          ownerId: valid.players[0].id,
        },
      },
    };
    expect(respond(wrongOwner, "substance_naoh_dilute_01")).toBe(wrongOwner);

    const wrongZone: GameState = {
      ...valid,
      cardInstances: {
        ...valid.cardInstances,
        substance_h2so4_dilute_01: {
          ...attackCard,
          ownerId: undefined,
          zone: { type: "deck" },
        },
      },
    };
    expect(respond(wrongZone, "substance_naoh_dilute_01")).toBe(wrongZone);

    const source = valid.pendingResponse?.sourceEffect.context.source;
    if (source?.kind !== "card" || !valid.pendingResponse) {
      throw new Error("Expected a card damage response snapshot.");
    }
    const wrongDefinition: GameState = {
      ...valid,
      pendingResponse: {
        ...valid.pendingResponse,
        sourceEffect: {
          ...valid.pendingResponse.sourceEffect,
          context: {
            ...valid.pendingResponse.sourceEffect.context,
            source: { ...source, cardDefinitionId: "substance_hcl_dilute" },
          },
        },
      },
    };
    expect(respond(wrongDefinition, "substance_naoh_dilute_01")).toBe(wrongDefinition);

    const eliminatedSource: GameState = {
      ...valid,
      players: valid.players.map((player) => player.id === valid.players[0].id
        ? { ...player, hp: 0, eliminated: true }
        : player),
    };
    expect(respond(eliminatedSource, "substance_naoh_dilute_01")).toBe(eliminatedSource);

    const missingSource: GameState = {
      ...valid,
      players: valid.players.filter((player) => player.id !== valid.players[0].id),
    };
    expect(respond(missingSource, "substance_naoh_dilute_01")).toBe(missingSource);

    for (const rejected of [
      wrongOwner,
      wrongZone,
      wrongDefinition,
      eliminatedSource,
      missingSource,
    ]) {
      expect(getReactionEvents(rejected)).toHaveLength(0);
      expect(getByproductLogs(rejected)).toHaveLength(0);
      expect(rejected.players[0].characterUsage.perRound).toEqual({});
    }
  });

  it("does not consume byproduct from a character-skill or status participant", () => {
    let immediate = createGame([
      "clumsy_party_secretary",
      "sulfuric_acid_factory_director",
    ]);
    immediate = putCardInHand(immediate, "player_2", "substance_naoh_dilute_01");
    immediate = engineReducer(immediate, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: "player_1",
      skillId: "exhaust_leak",
    });
    const immediateDeck = [...immediate.deck];
    immediate = respond(immediate, "substance_naoh_dilute_01");
    expect(getReactionEvents(immediate)).toHaveLength(1);
    expect(immediate.deck).toEqual(immediateDeck);
    expect(getByproductLogs(immediate)).toHaveLength(0);

    let status = createGame();
    status = putCardInHand(status, "player_1", "substance_naoh_dilute_01");
    status = {
      ...status,
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId: "player_1",
        statusInstanceId: "status_so2_byproduct",
      },
      players: status.players.map((player) => player.id === "player_1"
        ? {
            ...player,
            statuses: [
              { id: "status_so2_byproduct", statusId: "SO2_LEAK", createdAt: 1 },
            ],
          }
        : player),
    };
    const statusDeck = [...status.deck];
    status = engineReducer(status, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: "player_1",
      statusInstanceId: "status_so2_byproduct",
      cardInstanceId: "substance_naoh_dilute_01",
    });
    expect(getReactionEvents(status)).toHaveLength(1);
    expect(status.deck).toEqual(statusDeck);
    expect(getByproductLogs(status)).toHaveLength(0);
  });
});
