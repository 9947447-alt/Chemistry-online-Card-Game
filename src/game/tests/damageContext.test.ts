import { describe, expect, it } from "vitest";
import { cardDefinitions } from "../data/cardDefinitions";
import { starterDeckSize } from "../data/starterDeck";
import {
  createCardDamageContext,
  createDIYDamageContext,
  createStatusDamageContext,
} from "../engine/damageContext";
import { engineReducer } from "../engine/reducer";
import type {
  CardDefinition,
  CardInstanceId,
  GameState,
  PlayerId,
  StatusId,
} from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";
import { createMvp0TestGame as createInitialGame } from "./createTestGame";

const definitionsById = new Map<string, CardDefinition>(
  cardDefinitions.map((definition) => [definition.id, definition]),
);

function getDefinition(definitionId: string): CardDefinition {
  const definition = definitionsById.get(definitionId);

  if (!definition) {
    throw new Error(`Missing card definition: ${definitionId}`);
  }

  return definition;
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
      hand:
        player.id === playerId
          ? [...player.hand.filter((id) => id !== cardInstanceId), cardInstanceId]
          : player.hand.filter((id) => id !== cardInstanceId),
    })),
    deck: state.deck.filter((id) => id !== cardInstanceId),
    discardPile: state.discardPile.filter((id) => id !== cardInstanceId),
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

function startCardAttack(cardInstanceId: CardInstanceId): GameState {
  let state = createInitialGame({ shuffle: identityShuffle });
  const [attacker, target] = state.players;
  state = putCardInHand(state, attacker.id, cardInstanceId);

  return engineReducer(state, {
    type: "PLAY_CARD",
    playerId: attacker.id,
    cardInstanceId,
    targetPlayerId: target.id,
  });
}

function startDIYAttack(input: {
  recipeId: string;
  componentCardInstanceIds: CardInstanceId[];
}): GameState {
  let state = createInitialGame({ shuffle: identityShuffle });
  const [attacker, target] = state.players;

  for (const cardInstanceId of input.componentCardInstanceIds) {
    state = putCardInHand(state, attacker.id, cardInstanceId);
  }

  return engineReducer(state, {
    type: "START_ACTIVE_DIY",
    playerId: attacker.id,
    recipeId: input.recipeId,
    componentCardInstanceIds: input.componentCardInstanceIds,
    targetPlayerId: target.id,
  });
}

function createStatusWindow(statusId: StatusId): GameState {
  const state = createInitialGame({ shuffle: identityShuffle });
  const player = state.players[0];
  const statusInstanceId = `status_test_${statusId}`;

  return {
    ...state,
    phase: "statusWindow",
    activePlayerId: player.id,
    players: state.players.map((candidate) =>
      candidate.id === player.id
        ? {
            ...candidate,
            statuses: [
              ...candidate.statuses,
              {
                id: statusInstanceId,
                statusId,
                sourcePlayerId: state.players[1].id,
                createdAt: 1,
              },
            ],
          }
        : candidate,
    ),
    pendingStatusHandling: {
      playerId: player.id,
      statusInstanceId,
    },
  };
}

describe("Phase 8C-0B DamageContext", () => {
  it.each([
    ["substance_hcl_dilute_01", "substance_hcl_dilute", ["acid", "strong-acid"]],
    ["substance_h2so4_dilute_01", "substance_h2so4_dilute", ["acid", "strong-acid"]],
    ["substance_naoh_dilute_01", "substance_naoh_dilute", ["base", "strong-alkali"]],
    ["substance_koh_dilute_01", "substance_koh_dilute", ["base", "strong-alkali"]],
    [
      "substance_caoh2_limewater_01",
      "substance_caoh2_limewater",
      ["base", "strong-alkali"],
    ],
  ] as const)(
    "captures stable entity card source and tags for %s",
    (cardInstanceId, cardDefinitionId, expectedTags) => {
      const state = startCardAttack(cardInstanceId);
      const [attacker, target] = state.players;
      const context = state.pendingResponse?.sourceEffect.context;

      expect(state.phase).toBe("responseWindow");
      expect(context).toEqual({
        targetPlayerId: target.id,
        baseAmount: 1,
        source: {
          kind: "card",
          sourcePlayerId: attacker.id,
          cardInstanceId,
          cardDefinitionId,
        },
        tags: expectedTags,
        responsePolicy: "acid-base",
      });
      expectCardZonesToBeConsistent(state);
    },
  );

  it.each([
    ["diy_hcl_from_h_cl", ["ion_h_01", "ion_cl_01"], "acid"],
    ["diy_h2so4_from_2h_so4", ["ion_h_01", "ion_h_02", "ion_so4_01"], "acid"],
    ["diy_naoh_from_na_oh", ["ion_na_01", "ion_oh_01"], "base"],
    ["diy_koh_from_k_oh", ["ion_k_01", "ion_oh_01"], "base"],
    [
      "diy_limewater_from_ca_2oh",
      ["ion_ca_01", "ion_oh_01", "ion_oh_02"],
      "base",
    ],
  ] as const)(
    "keeps virtual DIY %s independent from entity strong tags",
    (recipeId, componentCardInstanceIds, damageTag) => {
      const state = startDIYAttack({
        recipeId,
        componentCardInstanceIds: [...componentCardInstanceIds],
      });
      const [attacker, target] = state.players;
      const context = state.pendingResponse?.sourceEffect.context;

      expect(context).toEqual({
        targetPlayerId: target.id,
        baseAmount: 1,
        source: {
          kind: "diy",
          sourcePlayerId: attacker.id,
          recipeId,
        },
        tags: [damageTag],
        responsePolicy: "acid-base",
      });
      expect(context?.tags).not.toContain("strong-acid");
      expect(context?.tags).not.toContain("strong-alkali");
      expect(Object.hasOwn(context?.source ?? {}, "cardInstanceId")).toBe(false);
      expectCardZonesToBeConsistent(state);
    },
  );

  it.each([
    ["FIRE", ["status", "fire"]],
    ["SO2_LEAK", ["status", "so2"]],
  ] as const)("uses null attacker and non-responsive tags for %s status damage", (statusId, tags) => {
    const context = createStatusDamageContext({
      statusInstanceId: `status_test_${statusId}`,
      statusId,
      targetPlayerId: "player_1",
      baseAmount: 2,
    });

    expect(context).toEqual({
      targetPlayerId: "player_1",
      baseAmount: 2,
      source: {
        kind: "status",
        sourcePlayerId: null,
        statusInstanceId: `status_test_${statusId}`,
        statusId,
      },
      tags,
      responsePolicy: "none",
    });

    let state = createStatusWindow(statusId);
    const playerId = state.activePlayerId;
    const hpBefore = state.players[0].hp;
    state = engineReducer(state, {
      type: "PASS_STATUS_HANDLING",
      playerId,
      statusInstanceId: `status_test_${statusId}`,
    });

    expect(state.players[0].hp).toBe(hpBefore - 2);
    expect(state.pendingResponse).toBeUndefined();
    expectCardZonesToBeConsistent(state);
  });

  it("preserves the same card context through response pause and pass resolution", () => {
    const pending = startCardAttack("substance_hcl_dilute_01");
    const responder = pending.players[1];
    const sourceEffect = pending.pendingResponse?.sourceEffect;

    expect(sourceEffect).toBeDefined();
    expect(pending.pendingResponse?.effectsAfterPass[0]).toBe(sourceEffect);

    const resolved = engineReducer(pending, {
      type: "PASS_RESPONSE",
      playerId: responder.id,
    });

    expect(resolved.players[1].hp).toBe(9);
    expect(resolved.discardPile).toContain("substance_hcl_dilute_01");
    expect(sourceEffect?.context.source).toMatchObject({
      kind: "card",
      sourcePlayerId: pending.players[0].id,
      cardInstanceId: "substance_hcl_dilute_01",
      cardDefinitionId: "substance_hcl_dilute",
    });
    expect(resolved.pendingResponse).toBeUndefined();
    expectCardZonesToBeConsistent(resolved);
  });

  it("preserves DIY context through response pause and pass without discarding components twice", () => {
    const pending = startDIYAttack({
      recipeId: "diy_hcl_from_h_cl",
      componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
    });
    const responder = pending.players[1];
    const sourceEffect = pending.pendingResponse?.sourceEffect;

    expect(pending.pendingResponse?.effectsAfterPass[0]).toBe(sourceEffect);
    const resolved = engineReducer(pending, {
      type: "PASS_RESPONSE",
      playerId: responder.id,
    });

    expect(resolved.players[1].hp).toBe(9);
    expect(resolved.discardPile.filter((id) => id === "ion_h_01")).toHaveLength(1);
    expect(resolved.discardPile.filter((id) => id === "ion_cl_01")).toHaveLength(1);
    expect(sourceEffect?.context.source).toEqual({
      kind: "diy",
      sourcePlayerId: pending.players[0].id,
      recipeId: "diy_hcl_from_h_cl",
    });
    expectCardZonesToBeConsistent(resolved);
  });

  it("keeps successful response cancellation and source-card discard behavior unchanged", () => {
    let state = startCardAttack("substance_hcl_dilute_01");
    const responder = state.players[1];
    state = putCardInHand(state, responder.id, "substance_naoh_dilute_01");
    const hpBefore = state.players[1].hp;

    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: responder.id,
      cardInstanceId: "substance_naoh_dilute_01",
    });

    expect(state.players[1].hp).toBe(hpBefore);
    expect(state.pendingResponse).toBeUndefined();
    expect(state.discardPile).toEqual(
      expect.arrayContaining(["substance_hcl_dilute_01", "substance_naoh_dilute_01"]),
    );
    expectCardZonesToBeConsistent(state);
  });

  it("keeps tags unique and in canonical stable order", () => {
    const context = createCardDamageContext({
      sourcePlayerId: "player_1",
      cardInstanceId: "substance_hcl_dilute_01",
      definition: getDefinition("substance_hcl_dilute"),
      targetPlayerId: "player_2",
      baseAmount: 1,
    });

    expect(context.tags).toEqual(["acid", "strong-acid"]);
    expect(new Set(context.tags).size).toBe(context.tags.length);
    expect(Object.hasOwn(context.source, "recipeId")).toBe(false);
  });

  it("rejects negative and non-finite base amounts at construction", () => {
    for (const baseAmount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        createDIYDamageContext({
          sourcePlayerId: "player_1",
          recipeId: "diy_hcl_from_h_cl",
          targetPlayerId: "player_2",
          baseAmount,
          damageKind: "acid",
        }),
      ).toThrow("finite non-negative");
    }
  });

  it("keeps the ordinary pool at 68 real instances with no lab-fire instance", () => {
    const state = createInitialGame({ shuffle: identityShuffle });

    expect(starterDeckSize).toBe(68);
    expect(Object.keys(state.cardInstances)).toHaveLength(68);
    expect(
      Object.values(state.cardInstances).some(
        (instance) => instance.definitionId === "event_lab_fire",
      ),
    ).toBe(false);
    expectCardZonesToBeConsistent(state);
  });
});
