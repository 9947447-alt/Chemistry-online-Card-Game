import { describe, expect, it } from "vitest";
import { cardDefinitions } from "../data/cardDefinitions";
import { starterDeckSize } from "../data/starterDeck";
import type { GameAction } from "../engine/actions";
import { createInitialGame } from "../engine/createInitialGame";
import { applyDamage } from "../engine/damage";
import {
  createCardDamageContext,
  createExperimentCounterattackPursuitDamageContext,
} from "../engine/damageContext";
import {
  isLegalExperimentCounterattackMetalDefinition,
} from "../engine/experimentCounterattack";
import { engineReducer } from "../engine/reducer";
import { renderGameLogEntry } from "../../features/local-game/gameLogRenderer";
import type {
  CardInstanceId,
  CharacterId,
  GameState,
  Player,
  PlayerId,
  StatusId,
} from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";

type CharacterPair = [CharacterId, CharacterId];

function createRoleGame(characterIds: CharacterPair): GameState {
  return createInitialGame({ characterIds, shuffle: identityShuffle });
}

function updatePlayer(
  state: GameState,
  playerId: PlayerId,
  update: (player: Player) => Player,
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? update(player) : player,
    ),
  };
}

function putCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState {
  const instance = state.cardInstances[cardInstanceId];
  if (!instance) {
    throw new Error(`Missing real CardInstance ${cardInstanceId}`);
  }

  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand:
        player.id === playerId
          ? [
              ...player.hand.filter((heldId) => heldId !== cardInstanceId),
              cardInstanceId,
            ]
          : player.hand.filter((heldId) => heldId !== cardInstanceId),
    })),
    deck: state.deck.filter((cardId) => cardId !== cardInstanceId),
    discardPile: state.discardPile.filter((cardId) => cardId !== cardInstanceId),
    cardInstances: {
      ...state.cardInstances,
      [cardInstanceId]: {
        ...instance,
        ownerId: playerId,
        zone: { type: "hand", playerId },
      },
    },
  };
}

function addStatus(
  state: GameState,
  playerId: PlayerId,
  statusId: StatusId,
): GameState {
  return updatePlayer(state, playerId, (player) => ({
    ...player,
    statuses: [
      ...player.statuses,
      {
        id: `status_counterattack_${statusId}`,
        statusId,
        sourcePlayerId: "player_1",
        createdAt: state.log.length + 1,
      },
    ],
  }));
}

function prepareAcidBaseResponse(input: {
  characters?: CharacterPair;
  attackCardId?: CardInstanceId;
  responseCardId?: CardInstanceId;
  pursuitCardIds?: readonly CardInstanceId[];
  responderHp?: number;
  responderStatuses?: readonly StatusId[];
  usageUsed?: boolean;
} = {}): GameState {
  const characters = input.characters ?? ["clumsy_party_secretary", "chemistry_enthusiast"];
  const attackCardId = input.attackCardId ?? "substance_hcl_dilute_01";
  const responseCardId = input.responseCardId ?? "substance_naoh_dilute_01";
  let state = createRoleGame(characters);
  state = putCardInHand(state, "player_1", attackCardId);
  state = putCardInHand(state, "player_2", responseCardId);
  for (const pursuitCardId of input.pursuitCardIds ?? []) {
    state = putCardInHand(state, "player_2", pursuitCardId);
  }
  if (input.responderHp !== undefined) {
    state = updatePlayer(state, "player_2", (player) => ({
      ...player,
      hp: input.responderHp ?? player.hp,
    }));
  }
  for (const statusId of input.responderStatuses ?? []) {
    state = addStatus(state, "player_2", statusId);
  }
  if (input.usageUsed) {
    state = updatePlayer(state, "player_2", (player) => ({
      ...player,
      characterUsage: {
        ...player.characterUsage,
        perCycle: {
          ...player.characterUsage.perCycle,
          chemistry_enthusiast_counterattack: 1,
        },
      },
    }));
  }

  state = engineReducer(state, {
    type: "PLAY_CARD",
    playerId: "player_1",
    cardInstanceId: attackCardId,
    targetPlayerId: "player_2",
  });
  return engineReducer(state, {
    type: "RESPOND_WITH_CARD",
    playerId: "player_2",
    cardInstanceId: responseCardId,
  });
}

function resolveRecover(state: GameState): GameState {
  return engineReducer(state, {
    type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
    playerId: "player_2",
    option: "recover",
  });
}

function resolvePursuit(state: GameState, cardInstanceId: CardInstanceId): GameState {
  return engineReducer(state, {
    type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
    playerId: "player_2",
    option: "acid-base-pursuit",
    cardInstanceId,
  });
}

function countDiscard(state: GameState, cardInstanceId: CardInstanceId): number {
  return state.discardPile.filter((cardId) => cardId === cardInstanceId).length;
}

function advanceToNextCycle(state: GameState): GameState {
  let nextState = state;
  const currentCycle = state.cycleNumber;
  for (let step = 0; step < 8 && nextState.cycleNumber === currentCycle; step += 1) {
    if (nextState.phase !== "mainAction") {
      throw new Error(`Unexpected phase while advancing: ${nextState.phase}`);
    }
    nextState = engineReducer(nextState, {
      type: "PASS_ACTION",
      playerId: nextState.activePlayerId,
    });
  }
  return nextState;
}

describe("Phase 8C-4 chemistry enthusiast experiment counterattack", () => {
  it("audits the real 68-card pool as having no legal metal element CardDefinition", () => {
    expect(
      cardDefinitions.filter(isLegalExperimentCounterattackMetalDefinition),
    ).toEqual([]);

    const state = createRoleGame(["clumsy_party_secretary", "chemistry_enthusiast"]);
    expect(Object.keys(state.cardInstances)).toHaveLength(starterDeckSize);
    expect(Object.values(state.cardInstances).filter((card) => card.definitionId === "event_lab_fire")).toHaveLength(0);
  });

  it("opens a stable mandatory choice window after a legal acid-base response", () => {
    const state = prepareAcidBaseResponse({
      pursuitCardIds: ["substance_hcl_dilute_02"],
      responderHp: 7,
    });

    expect(state.phase).toBe("experimentCounterattackWindow");
    expect(state.activePlayerId).toBe("player_1");
    expect(state.pendingResponse).toBeUndefined();
    expect(state.pendingExperimentCounterattack).toMatchObject({
      responderPlayerId: "player_2",
      attackerPlayerId: "player_1",
      responseType: "acid-base",
      legalOptions: ["recover", "acid-base-pursuit"],
      legalMetalCardInstanceIds: [],
      legalPursuitCardInstanceIds: ["substance_hcl_dilute_02"],
      continuation: { kind: "single-response" },
      originalDamageContext: {
        targetPlayerId: "player_2",
        responsePolicy: "acid-base",
        source: { sourcePlayerId: "player_1" },
      },
    });
    expect(countDiscard(state, "substance_hcl_dilute_01")).toBe(1);
    expect(countDiscard(state, "substance_naoh_dilute_01")).toBe(1);
    expectCardZonesToBeConsistent(state);
  });

  it("opens after alkali absorption and preserves the exhaust-leak continuation snapshot", () => {
    let state = createRoleGame(["clumsy_party_secretary", "chemistry_enthusiast"]);
    state = putCardInHand(state, "player_2", "ion_oh_01");
    state = putCardInHand(state, "player_2", "substance_hcl_dilute_01");
    state = updatePlayer(state, "player_2", (player) => ({ ...player, hp: 7 }));
    state = engineReducer(state, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: "player_1",
      skillId: "exhaust_leak",
    });
    state = engineReducer(state, {
      type: "RESPOND_WITH_CARD",
      playerId: "player_2",
      cardInstanceId: "ion_oh_01",
    });

    expect(state.phase).toBe("experimentCounterattackWindow");
    expect(state.pendingExperimentCounterattack).toMatchObject({
      responseType: "alkali-absorption",
      originalDamageContext: {
        tags: ["so2"],
        responsePolicy: "alkali-absorption",
        source: {
          kind: "character-skill",
          sourcePlayerId: "player_1",
          skillId: "exhaust_leak",
        },
      },
      continuation: {
        kind: "multi-target-response",
        completedResult: {
          targetPlayerId: "player_2",
          outcome: "absorbed",
          finalDamage: 0,
        },
        sequence: {
          targetPlayerIds: ["player_2"],
          remainingTargetPlayerIds: [],
          completedResults: [],
        },
      },
    });
    expect(countDiscard(state, "ion_oh_01")).toBe(1);
  });

  it("does not trigger after pass, for another role, after usage, or when no option is legal", () => {
    let passed = createRoleGame(["clumsy_party_secretary", "chemistry_enthusiast"]);
    passed = putCardInHand(passed, "player_1", "substance_hcl_dilute_01");
    passed = engineReducer(passed, {
      type: "PLAY_CARD",
      playerId: "player_1",
      cardInstanceId: "substance_hcl_dilute_01",
      targetPlayerId: "player_2",
    });
    passed = engineReducer(passed, { type: "PASS_RESPONSE", playerId: "player_2" });
    expect(passed.pendingExperimentCounterattack).toBeUndefined();

    const otherRole = prepareAcidBaseResponse({
      characters: ["clumsy_party_secretary", "acid_king"],
      pursuitCardIds: ["substance_hcl_dilute_02"],
    });
    expect(otherRole.pendingExperimentCounterattack).toBeUndefined();

    const alreadyUsed = prepareAcidBaseResponse({
      pursuitCardIds: ["substance_hcl_dilute_02"],
      usageUsed: true,
    });
    expect(alreadyUsed.pendingExperimentCounterattack).toBeUndefined();

    const noOption = prepareAcidBaseResponse({
      responseCardId: "ion_oh_01",
    });
    expect(noOption.pendingExperimentCounterattack).toBeUndefined();
    expect(noOption.phase).toBe("mainAction");
  });

  it("does not treat status handling as a successful attack response", () => {
    let state = createRoleGame(["clumsy_party_secretary", "chemistry_enthusiast"]);
    state = putCardInHand(state, "player_2", "ion_oh_01");
    state = addStatus(state, "player_2", "SO2_LEAK");
    const status = state.players[1].statuses[0];
    state = {
      ...state,
      activePlayerId: "player_2",
      phase: "statusWindow",
      pendingStatusHandling: {
        playerId: "player_2",
        statusInstanceId: status.id,
      },
    };
    state = engineReducer(state, {
      type: "HANDLE_STATUS_WITH_CARD",
      playerId: "player_2",
      statusInstanceId: status.id,
      cardInstanceId: "ion_oh_01",
    });

    expect(state.pendingExperimentCounterattack).toBeUndefined();
    expect(state.phase).toBe("mainAction");
  });

  it("does not create a choice window from immunity reducing ordinary DAMAGE to zero", () => {
    let state = createRoleGame(["clumsy_party_secretary", "caustic_soda_captain"]);
    state = putCardInHand(state, "player_1", "substance_naoh_dilute_01");
    const definition = cardDefinitions.find((card) => card.id === "substance_naoh_dilute");
    if (!definition) {
      throw new Error("Missing NaOH definition");
    }
    const effect = {
      type: "DAMAGE" as const,
      context: createCardDamageContext({
        sourcePlayerId: "player_1",
        cardInstanceId: "substance_naoh_dilute_01",
        definition,
        targetPlayerId: "player_2",
        baseAmount: 1,
      }),
    };
    const applied = applyDamage(state, effect);

    expect(applied.resolution.finalAmount).toBe(0);
    expect(applied.state.pendingExperimentCounterattack).toBeUndefined();
  });

  it("recovers 1 HP, consumes usage, and restores the ordinary continuation once", () => {
    const window = prepareAcidBaseResponse({ responderHp: 7 });
    const tableReference = window.tableReference;
    const resolved = resolveRecover(window);

    expect(resolved.players[1].hp).toBe(8);
    expect(resolved.players[1].characterUsage.perCycle.chemistry_enthusiast_counterattack).toBe(1);
    expect(resolved.pendingExperimentCounterattack).toBeUndefined();
    expect(resolved.activePlayerId).toBe("player_2");
    expect(resolved.tableReference).toEqual(tableReference);
    expect(resolved.players[1].usedDIYThisCycle).toBe(false);
    expect(engineReducer(resolved, {
      type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
      playerId: "player_2",
      option: "recover",
    })).toBe(resolved);
    expectCardZonesToBeConsistent(resolved);
  });

  it.each(["FIRE", "SO2_LEAK"] as const)(
    "does not offer recovery while %s blocks healing",
    (statusId) => {
      const state = prepareAcidBaseResponse({
        pursuitCardIds: ["substance_hcl_dilute_02"],
        responderHp: 7,
        responderStatuses: [statusId],
      });

      expect(state.pendingExperimentCounterattack?.legalOptions).not.toContain("recover");
      expect(resolveRecover(state)).toBe(state);
    },
  );

  it("uses a real acid substance for pursuit, adds 1 in increase, and never reopens response", () => {
    const window = prepareAcidBaseResponse({
      attackCardId: "substance_naoh_dilute_01",
      responseCardId: "substance_hcl_dilute_01",
      pursuitCardIds: ["substance_hcl_dilute_02"],
    });
    const tableReference = window.tableReference;
    const resolved = resolvePursuit(window, "substance_hcl_dilute_02");

    expect(resolved.players[0].hp).toBe(8);
    expect(resolved.phase).toBe("mainAction");
    expect(resolved.pendingResponse).toBeUndefined();
    expect(resolved.pendingExperimentCounterattack).toBeUndefined();
    expect(resolved.players[1].characterUsage.perCycle.chemistry_enthusiast_counterattack).toBe(1);
    expect(countDiscard(resolved, "substance_hcl_dilute_02")).toBe(1);
    expect(resolved.tableReference).toEqual(tableReference);
    expect(resolved.players[1].usedDIYThisCycle).toBe(false);
    expect(resolved.log.some((entry) => renderGameLogEntry(entry).includes("造成 2 点伤害"))).toBe(true);
    expectCardZonesToBeConsistent(resolved);
  });

  it("uses a real base substance for pursuit and preserves the real card source identity", () => {
    const window = prepareAcidBaseResponse({
      pursuitCardIds: ["substance_naoh_dilute_02"],
    });
    const resolved = resolvePursuit(window, "substance_naoh_dilute_02");

    expect(resolved.players[0].hp).toBe(8);
    expect(countDiscard(resolved, "substance_naoh_dilute_02")).toBe(1);
    expect(resolved.phase).not.toBe("responseWindow");
  });

  it("keeps the pursuit card identity, applies the typed increase, and enforces the 3-point cap", () => {
    let state = createRoleGame(["clumsy_party_secretary", "chemistry_enthusiast"]);
    state = putCardInHand(state, "player_2", "substance_hcl_dilute_01");
    const definition = cardDefinitions.find((card) => card.id === "substance_hcl_dilute");
    if (!definition) {
      throw new Error("Missing HCl definition");
    }
    const context = createExperimentCounterattackPursuitDamageContext({
      sourcePlayerId: "player_2",
      cardInstanceId: "substance_hcl_dilute_01",
      definition,
      targetPlayerId: "player_1",
      baseAmount: 3,
    });
    const applied = applyDamage(state, { type: "DAMAGE", context });

    expect(context).toMatchObject({
      source: {
        kind: "card",
        sourcePlayerId: "player_2",
        cardInstanceId: "substance_hcl_dilute_01",
        cardDefinitionId: "substance_hcl_dilute",
        sourceSkillId: "experiment_counterattack",
      },
      tags: ["acid", "strong-acid"],
      responsePolicy: "none",
    });
    expect(applied.resolution.trace[2]).toMatchObject({
      stage: "increase",
      inputAmount: 3,
      outputAmount: 4,
      modifier: {
        source: {
          kind: "character-skill",
          sourcePlayerId: "player_2",
          skillId: "experiment_counterattack",
        },
        amount: 1,
      },
    });
    expect(applied.resolution.finalAmount).toBe(3);
    expect(applied.state.players[0].hp).toBe(7);
  });

  it("keeps strong-alkali protection and acid-resistant-layer behavior on pursuit", () => {
    const baseWindow = prepareAcidBaseResponse({
      characters: ["caustic_soda_captain", "chemistry_enthusiast"],
      pursuitCardIds: ["substance_naoh_dilute_02"],
    });
    const baseResolved = resolvePursuit(baseWindow, "substance_naoh_dilute_02");
    expect(baseResolved.players[0].hp).toBe(10);

    const acidWindow = prepareAcidBaseResponse({
      characters: ["acid_king", "chemistry_enthusiast"],
      attackCardId: "substance_naoh_dilute_01",
      responseCardId: "substance_hcl_dilute_01",
      pursuitCardIds: ["substance_hcl_dilute_02"],
    });
    const acidResolved = resolvePursuit(acidWindow, "substance_hcl_dilute_02");
    expect(acidResolved.players[0].hp).toBe(9);
  });

  it("does not stack DIY experiment onto a real pursuit card", () => {
    let window = prepareAcidBaseResponse({
      pursuitCardIds: ["substance_hcl_dilute_02"],
    });
    window = updatePlayer(window, "player_2", (player) => ({
      ...player,
      usedDIYThisCycle: true,
    }));
    const resolved = resolvePursuit(window, "substance_hcl_dilute_02");

    expect(resolved.players[0].hp).toBe(8);
  });

  it("atomically rejects ions, non-damage substances, missing cards, wrong owner, wrong zone, and metal action", () => {
    const window = prepareAcidBaseResponse({
      pursuitCardIds: ["substance_hcl_dilute_02"],
    });
    const invalidIds = ["ion_h_01", "substance_o2_01", "event_lab_fire_01", "missing"];
    for (const cardInstanceId of invalidIds) {
      expect(resolvePursuit(window, cardInstanceId)).toBe(window);
    }
    expect(engineReducer(window, {
      type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
      playerId: "player_2",
      option: "metal-counterattack",
      cardInstanceId: "element_o_01",
    })).toBe(window);

    const wrongOwner = {
      ...window,
      cardInstances: {
        ...window.cardInstances,
        substance_hcl_dilute_02: {
          ...window.cardInstances.substance_hcl_dilute_02,
          ownerId: "player_1",
          zone: { type: "hand" as const, playerId: "player_1" },
        },
      },
    };
    expect(resolvePursuit(wrongOwner, "substance_hcl_dilute_02")).toBe(wrongOwner);

    const wrongZone = {
      ...window,
      cardInstances: {
        ...window.cardInstances,
        substance_hcl_dilute_02: {
          ...window.cardInstances.substance_hcl_dilute_02,
          ownerId: undefined,
          zone: { type: "discard" as const },
        },
      },
    };
    expect(resolvePursuit(wrongZone, "substance_hcl_dilute_02")).toBe(wrongZone);
  });

  it("isolates the choice phase from ordinary game actions and attacker spoofing", () => {
    const window = prepareAcidBaseResponse({
      pursuitCardIds: ["substance_hcl_dilute_02"],
      responderHp: 7,
    });
    const actions: GameAction[] = [
      { type: "PASS_ACTION", playerId: "player_1" },
      { type: "PLAY_REFERENCE_CARD", playerId: "player_1", cardInstanceId: "element_o_01" },
      { type: "PLAY_CARD", playerId: "player_1", cardInstanceId: "substance_o2_01" },
      { type: "START_ACTIVE_DIY", playerId: "player_1", recipeId: "diy_hcl_from_h_cl", componentCardInstanceIds: [] },
      { type: "ACTIVATE_CHARACTER_SKILL", playerId: "player_1", skillId: "lab_fire" },
      { type: "RESPOND_WITH_CARD", playerId: "player_2", cardInstanceId: "ion_oh_01" },
      { type: "PASS_RESPONSE", playerId: "player_2" },
      { type: "PASS_STATUS_HANDLING", playerId: "player_2", statusInstanceId: "missing" },
    ];
    for (const action of actions) {
      expect(engineReducer(window, action)).toBe(window);
    }
    expect(engineReducer(window, {
      type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
      playerId: "player_1",
      option: "recover",
    })).toBe(window);

    const malformed = {
      ...window,
      pendingExperimentCounterattack: window.pendingExperimentCounterattack
        ? { ...window.pendingExperimentCounterattack, attackerPlayerId: "player_2" }
        : undefined,
    };
    expect(resolveRecover(malformed)).toBe(malformed);
  });

  it("resumes exhaust leak once, retains the absorbed result, and applies the source penalty", () => {
    let window = createRoleGame(["clumsy_party_secretary", "chemistry_enthusiast"]);
    window = putCardInHand(window, "player_2", "ion_oh_01");
    window = updatePlayer(window, "player_2", (player) => ({ ...player, hp: 7 }));
    window = engineReducer(window, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: "player_1",
      skillId: "exhaust_leak",
    });
    window = engineReducer(window, {
      type: "RESPOND_WITH_CARD",
      playerId: "player_2",
      cardInstanceId: "ion_oh_01",
    });
    const resolved = resolveRecover(window);

    expect(resolved.players[0].hp).toBe(9);
    expect(resolved.players[1].hp).toBe(8);
    expect(resolved.activePlayerId).toBe("player_2");
    expect(resolved.pendingResponse).toBeUndefined();
    expect(resolved.pendingExperimentCounterattack).toBeUndefined();
    expect(countDiscard(resolved, "ion_oh_01")).toBe(1);
  });

  it("lets pursuit eliminate the exhaust-leak source, then finishes without advancing or recursive response", () => {
    let window = createRoleGame(["clumsy_party_secretary", "chemistry_enthusiast"]);
    window = updatePlayer(window, "player_1", (player) => ({ ...player, hp: 2 }));
    window = putCardInHand(window, "player_2", "ion_oh_01");
    window = putCardInHand(window, "player_2", "substance_hcl_dilute_01");
    window = engineReducer(window, {
      type: "ACTIVATE_CHARACTER_SKILL",
      playerId: "player_1",
      skillId: "exhaust_leak",
    });
    window = engineReducer(window, {
      type: "RESPOND_WITH_CARD",
      playerId: "player_2",
      cardInstanceId: "ion_oh_01",
    });
    const resolved = resolvePursuit(window, "substance_hcl_dilute_01");

    expect(resolved.phase).toBe("gameOver");
    expect(resolved.players[0]).toMatchObject({ hp: 0, eliminated: true });
    expect(resolved.winnerPlayerId).toBe("player_2");
    expect(resolved.pendingResponse).toBeUndefined();
    expect(resolved.pendingExperimentCounterattack).toBeUndefined();
  });

  it("keeps usage through a new round and resets it at the next cycle", () => {
    const window = prepareAcidBaseResponse({ responderHp: 7 });
    const used = resolveRecover(window);
    const nextRound = engineReducer(used, {
      type: "PASS_ACTION",
      playerId: used.activePlayerId,
    });

    expect(nextRound.roundInCycle).toBe(2);
    expect(nextRound.players[1].characterUsage.perCycle.chemistry_enthusiast_counterattack).toBe(1);

    const nextCycle = advanceToNextCycle(nextRound);
    expect(nextCycle.cycleNumber).toBe(2);
    expect(nextCycle.players[1].characterUsage.perCycle.chemistry_enthusiast_counterattack).toBeUndefined();
  });

  it("preserves the 68-card, zero-event, table, DIY, and zone invariants", () => {
    const window = prepareAcidBaseResponse({
      pursuitCardIds: ["substance_hcl_dilute_02"],
    });
    const tableReference = window.tableReference;
    const resolved = resolvePursuit(window, "substance_hcl_dilute_02");

    expect(Object.keys(resolved.cardInstances)).toHaveLength(68);
    expect(Object.values(resolved.cardInstances).filter((card) => card.definitionId === "event_lab_fire")).toHaveLength(0);
    expect(resolved.tableReference).toEqual(tableReference);
    expect(resolved.players[1].usedDIYThisCycle).toBe(false);
    expectCardZonesToBeConsistent(resolved);
  });
});
