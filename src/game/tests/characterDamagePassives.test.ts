import { describe, expect, it } from "vitest";
import { cardDefinitions } from "../data/cardDefinitions";
import { starterDeckSize } from "../data/starterDeck";
import { applyDamage } from "../engine/damage";
import { collectDamageModifiers } from "../engine/damageModifiers";
import { applyLoseHpBatch } from "../engine/loseHp";
import { createInitialGame } from "../engine/createInitialGame";
import { engineReducer } from "../engine/reducer";
import type {
  CardInstanceId,
  CardDefinition,
  CharacterId,
  DamageContext,
  GameState,
  Player,
  PlayerId,
  StatusId,
} from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";
import { renderGameLogEntry } from "../../features/local-game/gameLogRenderer";

type CharacterPair = [CharacterId, CharacterId];

const damageDIY = {
  acid: {
    recipeId: "diy_hcl_from_h_cl",
    componentCardInstanceIds: ["ion_h_01", "ion_cl_01"],
  },
  base: {
    recipeId: "diy_naoh_from_na_oh",
    componentCardInstanceIds: ["ion_na_01", "ion_oh_01"],
  },
  h2so4: {
    recipeId: "diy_h2so4_from_2h_so4",
    componentCardInstanceIds: ["ion_h_01", "ion_h_02", "ion_so4_01"],
  },
} as const;

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
    players: state.players.map((player) => (player.id === playerId ? update(player) : player)),
  };
}

function putCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState {
  const card = state.cardInstances[cardInstanceId];
  if (!card) {
    throw new Error(`Missing real test card: ${cardInstanceId}`);
  }

  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand:
        player.id === playerId
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

function putCardsInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceIds: readonly CardInstanceId[],
): GameState {
  return cardInstanceIds.reduce(
    (nextState, cardInstanceId) => putCardInHand(nextState, playerId, cardInstanceId),
    state,
  );
}

function startCardAttack(state: GameState, cardInstanceId: CardInstanceId): GameState {
  const [attacker, target] = state.players;
  const withCard = putCardInHand(state, attacker.id, cardInstanceId);
  return engineReducer(withCard, {
    type: "PLAY_CARD",
    playerId: attacker.id,
    cardInstanceId,
    targetPlayerId: target.id,
  });
}

function startDIYAttack(
  state: GameState,
  recipe: (typeof damageDIY)[keyof typeof damageDIY],
): GameState {
  const [attacker, target] = state.players;
  const withComponents = putCardsInHand(
    state,
    attacker.id,
    recipe.componentCardInstanceIds,
  );
  return engineReducer(withComponents, {
    type: "START_ACTIVE_DIY",
    playerId: attacker.id,
    recipeId: recipe.recipeId,
    componentCardInstanceIds: [...recipe.componentCardInstanceIds],
    targetPlayerId: target.id,
  });
}

function passResponse(state: GameState): GameState {
  const responderId = state.pendingResponse?.responderId;
  if (!responderId) {
    throw new Error("Expected a response window.");
  }

  return engineReducer(state, { type: "PASS_RESPONSE", playerId: responderId });
}

function getPendingResolution(state: GameState) {
  const effect = state.pendingResponse?.sourceEffect;
  if (!effect) {
    throw new Error("Expected a pending DAMAGE effect.");
  }

  return applyDamage(state, effect).resolution;
}

function addStatusWindow(
  state: GameState,
  targetPlayerId: PlayerId,
  statusId: StatusId,
): GameState {
  const statusInstanceId = `status_character_passive_${statusId}`;
  const withStatus = updatePlayer(state, targetPlayerId, (player) => ({
    ...player,
    statuses: [
      ...player.statuses,
      {
        id: statusInstanceId,
        statusId,
        sourcePlayerId: state.players[0].id,
        createdAt: 1,
      },
    ],
  }));

  return {
    ...withStatus,
    activePlayerId: targetPlayerId,
    phase: "statusWindow",
    pendingStatusHandling: { playerId: targetPlayerId, statusInstanceId },
  };
}

function passStatus(state: GameState): GameState {
  const pending = state.pendingStatusHandling;
  if (!pending) {
    throw new Error("Expected a pending status window.");
  }

  return engineReducer(state, {
    type: "PASS_STATUS_HANDLING",
    playerId: pending.playerId,
    statusInstanceId: pending.statusInstanceId,
  });
}

function finalDamageLog(state: GameState): string {
  return [...state.log].reverse().map((entry) => renderGameLogEntry(entry)).find((msg) => msg.includes("放弃响应")) ?? "";
}

describe("Phase 8C-2 character DAMAGE passives", () => {
  describe("strong alkali protection", () => {
    it("keeps the acid-base response window and resolves card base DAMAGE to 0 after pass", () => {
      const pending = startCardAttack(
        createRoleGame(["clumsy_party_secretary", "caustic_soda_captain"]),
        "substance_naoh_dilute_01",
      );
      const target = pending.players[1];

      expect(pending.phase).toBe("responseWindow");
      expect(pending.pendingResponse?.sourceEffect.context.tags).toEqual([
        "base",
        "strong-alkali",
      ]);
      expect(getPendingResolution(pending).trace[3]).toMatchObject({
        stage: "immunity",
        outputAmount: 0,
        modifier: { source: { skillId: "strong_alkali_protection", sourcePlayerId: target.id } },
      });

      const resolved = passResponse(pending);
      expect(resolved.players[1]).toMatchObject({ hp: target.hp, eliminated: false });
      expect(finalDamageLog(resolved)).toContain("受到 0 点碱性伤害");
      expect(resolved.phase).not.toBe("gameOver");
      expectCardZonesToBeConsistent(resolved);
    });

    it("also immunizes virtual base DIY without changing or strengthening its tags", () => {
      const pending = startDIYAttack(
        createRoleGame(["clumsy_party_secretary", "caustic_soda_captain"]),
        damageDIY.base,
      );
      const targetHp = pending.players[1].hp;

      expect(pending.pendingResponse?.sourceEffect.context.tags).toEqual(["base"]);
      const resolved = passResponse(pending);
      expect(resolved.players[1].hp).toBe(targetHp);
      expect(finalDamageLog(resolved)).toContain("受到 0 点碱性伤害");
    });

    it("does not immunize acid, FIRE, SO2_LEAK, or lose-HP", () => {
      const roles: CharacterPair = ["clumsy_party_secretary", "caustic_soda_captain"];
      const acidResolved = passResponse(
        startCardAttack(createRoleGame(roles), "substance_hcl_dilute_01"),
      );
      const fireResolved = passStatus(
        addStatusWindow(createRoleGame(roles), "player_2", "FIRE"),
      );
      const so2Resolved = passStatus(
        addStatusWindow(createRoleGame(roles), "player_2", "SO2_LEAK"),
      );
      const loseHpState = createRoleGame(roles);
      const loseHpResolved = applyLoseHpBatch(loseHpState, [
        { targetPlayerId: loseHpState.players[1].id, amount: 1 },
      ]);

      expect(acidResolved.players[1].hp).toBe(9);
      expect(fireResolved.players[1].hp).toBe(8);
      expect(so2Resolved.players[1].hp).toBe(8);
      expect(loseHpResolved.players[1].hp).toBe(9);
    });

    it("still lets a successful response cancel the original base DAMAGE exactly once", () => {
      let pending = startCardAttack(
        createRoleGame(["clumsy_party_secretary", "caustic_soda_captain"]),
        "substance_naoh_dilute_01",
      );
      const target = pending.players[1];
      pending = putCardInHand(pending, target.id, "substance_hcl_dilute_01");

      const resolved = engineReducer(pending, {
        type: "RESPOND_WITH_CARD",
        playerId: target.id,
        cardInstanceId: "substance_hcl_dilute_01",
      });

      expect(resolved.players[1].hp).toBe(target.hp);
      expect(resolved.pendingResponse).toBeUndefined();
      expect(resolved.discardPile.filter((id) => id === "substance_naoh_dilute_01")).toHaveLength(1);
      expect(resolved.log.some((entry) => renderGameLogEntry(entry).includes("受到 0 点"))).toBe(false);
    });
  });

  describe("strong alkali mastery", () => {
    it.each([
      "substance_naoh_dilute_01",
      "substance_koh_dilute_01",
      "substance_caoh2_limewater_01",
    ])("adds 1 for real strong-alkali card %s", (cardInstanceId) => {
      const pending = startCardAttack(
        createRoleGame(["caustic_soda_captain", "clumsy_party_secretary"]),
        cardInstanceId,
      );
      const attacker = pending.players[0];
      const resolution = getPendingResolution(pending);

      expect(resolution.trace[2]).toMatchObject({
        stage: "increase",
        inputAmount: 1,
        outputAmount: 2,
        modifier: { source: { skillId: "strong_alkali_mastery", sourcePlayerId: attacker.id } },
      });
      const resolved = passResponse(pending);
      expect(resolved.players[1].hp).toBe(8);
      expect(finalDamageLog(resolved)).toContain("受到 2 点碱性伤害");
    });

    it("does not apply to base DIY or another character's strong-alkali card", () => {
      const diyResolved = passResponse(
        startDIYAttack(
          createRoleGame(["caustic_soda_captain", "clumsy_party_secretary"]),
          damageDIY.base,
        ),
      );
      const otherRoleResolved = passResponse(
        startCardAttack(
          createRoleGame(["clumsy_party_secretary", "clumsy_party_secretary"]),
          "substance_naoh_dilute_01",
        ),
      );

      expect(diyResolved.players[1].hp).toBe(9);
      expect(otherRoleResolved.players[1].hp).toBe(9);
    });

    it("rejects an ordinary base ion as a mastery source using a real CardInstance", () => {
      const state = putCardInHand(
        createRoleGame(["caustic_soda_captain", "clumsy_party_secretary"]),
        "player_1",
        "ion_oh_01",
      );
      const context: DamageContext = {
        targetPlayerId: state.players[1].id,
        baseAmount: 1,
        source: {
          kind: "card",
          sourcePlayerId: state.players[0].id,
          cardInstanceId: "ion_oh_01",
          cardDefinitionId: "ion_oh",
        },
        tags: ["base"],
        responsePolicy: "acid-base",
      };

      expect(collectDamageModifiers(state, context)).toEqual({});
    });
  });

  describe("acid corrosion and acid-resistant layer", () => {
    it.each(["substance_hcl_dilute_01", "substance_h2so4_dilute_01"])(
      "sets real strong-acid card %s to 3 in set-value",
      (cardInstanceId) => {
        const pending = startCardAttack(
          createRoleGame(["acid_king", "clumsy_party_secretary"]),
          cardInstanceId,
        );
        const resolution = getPendingResolution(pending);

        expect(resolution.trace[1]).toMatchObject({
          stage: "set-value",
          inputAmount: 1,
          outputAmount: 3,
          modifier: { source: { skillId: "acid_corrosion", sourcePlayerId: "player_1" } },
        });
        expect(resolution.trace[2]).toMatchObject({ inputAmount: 3, outputAmount: 3 });
        const resolved = passResponse(pending);
        expect(resolved.players[1].hp).toBe(7);
        expect(finalDamageLog(resolved)).toContain("受到 3 点酸性伤害");
      },
    );

    it("does not apply corrosion to acid DIY, a non-substance acid source, or another role", () => {
      const diyResolved = passResponse(
        startDIYAttack(createRoleGame(["acid_king", "clumsy_party_secretary"]), damageDIY.acid),
      );
      const otherRoleResolved = passResponse(
        startCardAttack(
          createRoleGame(["clumsy_party_secretary", "clumsy_party_secretary"]),
          "substance_hcl_dilute_01",
        ),
      );
      const ionState = putCardInHand(
        createRoleGame(["acid_king", "clumsy_party_secretary"]),
        "player_1",
        "ion_h_01",
      );
      const ionContext: DamageContext = {
        targetPlayerId: ionState.players[1].id,
        baseAmount: 1,
        source: {
          kind: "card",
          sourcePlayerId: ionState.players[0].id,
          cardInstanceId: "ion_h_01",
          cardDefinitionId: "ion_h",
        },
        tags: ["acid"],
        responsePolicy: "acid-base",
      };

      expect(diyResolved.players[1].hp).toBe(9);
      expect(otherRoleResolved.players[1].hp).toBe(9);
      expect(collectDamageModifiers(ionState, ionContext)).toEqual({});
    });

    it("protects the exact current strong-acid data set and excludes harmful gas", () => {
      const definitions: readonly CardDefinition[] = cardDefinitions;
      const strongAcidIds = definitions
        .filter((definition) => definition.tags.includes("strong-acid"))
        .map((definition) => definition.id);

      expect(strongAcidIds).toEqual([
        "substance_hcl_dilute",
        "substance_h2so4_dilute",
      ]);
      expect(
        definitions
          .filter((definition) => definition.tags.includes("strong-acid"))
          .every((definition) => !definition.tags.includes("harmful-gas")),
      ).toBe(true);
    });

    it("applies reduction and minimum to both card and DIY acid DAMAGE", () => {
      const cardPending = startCardAttack(
        createRoleGame(["clumsy_party_secretary", "acid_king"]),
        "substance_hcl_dilute_01",
      );
      const diyPending = startDIYAttack(
        createRoleGame(["clumsy_party_secretary", "acid_king"]),
        damageDIY.acid,
      );

      for (const pending of [cardPending, diyPending]) {
        const resolution = getPendingResolution(pending);
        expect(resolution.trace[4]).toMatchObject({
          stage: "reduction",
          inputAmount: 1,
          outputAmount: 0,
          modifier: { source: { skillId: "acid_resistant_layer", sourcePlayerId: "player_2" } },
        });
        expect(resolution.trace[5]).toMatchObject({
          stage: "minimum",
          inputAmount: 0,
          outputAmount: 1,
          skippedByImmunity: false,
        });
        expect(passResponse(pending).players[1].hp).toBe(9);
      }
    });

    it("does not reduce base, FIRE, SO2_LEAK, or lose-HP", () => {
      const roles: CharacterPair = ["clumsy_party_secretary", "acid_king"];
      const baseResolved = passResponse(
        startCardAttack(createRoleGame(roles), "substance_naoh_dilute_01"),
      );
      const fireResolved = passStatus(addStatusWindow(createRoleGame(roles), "player_2", "FIRE"));
      const so2Resolved = passStatus(
        addStatusWindow(createRoleGame(roles), "player_2", "SO2_LEAK"),
      );
      const loseHpState = createRoleGame(roles);
      const loseHpResolved = applyLoseHpBatch(loseHpState, [
        { targetPlayerId: loseHpState.players[1].id, amount: 2 },
      ]);

      expect(baseResolved.players[1].hp).toBe(9);
      expect(fireResolved.players[1].hp).toBe(8);
      expect(so2Resolved.players[1].hp).toBe(8);
      expect(loseHpResolved.players[1].hp).toBe(8);
    });

    it("orders acid king source set-value before acid king target reduction", () => {
      const pending = startCardAttack(
        createRoleGame(["acid_king", "acid_king"]),
        "substance_hcl_dilute_01",
      );
      const resolution = getPendingResolution(pending);

      expect(resolution.trace[1].outputAmount).toBe(3);
      expect(resolution.trace[4]).toMatchObject({ inputAmount: 3, outputAmount: 2 });
      expect(resolution.finalAmount).toBe(2);
      const resolved = passResponse(pending);
      expect(resolved.players[1].hp).toBe(8);
      expect(finalDamageLog(resolved)).toContain("受到 2 点酸性伤害");
    });
  });

  describe("DIY experiment", () => {
    it.each([damageDIY.acid, damageDIY.base])(
      "adds 1 to the chemistry enthusiast's first legal $recipeId DAMAGE DIY",
      (recipe) => {
        const pending = startDIYAttack(
          createRoleGame(["chemistry_enthusiast", "clumsy_party_secretary"]),
          recipe,
        );
        const context = pending.pendingResponse?.sourceEffect.context;

        expect(context?.source).toMatchObject({ kind: "diy", sourcePlayerId: "player_1" });
        expect(context?.tags).toEqual([
          recipe === damageDIY.base ? "base" : "acid",
        ]);
        expect(pending.players[0].usedDIYThisCycle).toBe(true);
        expect(getPendingResolution(pending).trace[2]).toMatchObject({
          inputAmount: 1,
          outputAmount: 2,
          modifier: { source: { skillId: "diy_experiment", sourcePlayerId: "player_1" } },
        });
        expect(passResponse(pending).players[1].hp).toBe(8);
      },
    );

    it("does not apply to entity cards or another character's DIY", () => {
      const cardResolved = passResponse(
        startCardAttack(
          createRoleGame(["chemistry_enthusiast", "clumsy_party_secretary"]),
          "substance_hcl_dilute_01",
        ),
      );
      const otherDIYResolved = passResponse(
        startDIYAttack(
          createRoleGame(["clumsy_party_secretary", "clumsy_party_secretary"]),
          damageDIY.acid,
        ),
      );

      expect(cardResolved.players[1].hp).toBe(9);
      expect(otherDIYResolved.players[1].hp).toBe(9);
    });

    it("preserves the original DIY effect across pass and discards components only once", () => {
      const pending = startDIYAttack(
        createRoleGame(["chemistry_enthusiast", "clumsy_party_secretary"]),
        damageDIY.acid,
      );
      const sourceEffect = pending.pendingResponse?.sourceEffect;
      const context = sourceEffect?.context;

      expect(pending.pendingResponse?.effectsAfterPass[0]).toBe(sourceEffect);
      expect(context?.tags).toEqual(["acid"]);
      const resolved = passResponse(pending);
      expect(resolved.players[1].hp).toBe(8);
      expect(resolved.players[0].usedDIYThisCycle).toBe(true);
      expect(resolved.discardPile.filter((id) => id === "ion_h_01")).toHaveLength(1);
      expect(resolved.discardPile.filter((id) => id === "ion_cl_01")).toHaveLength(1);
      expect(Object.keys(resolved.cardInstances)).toHaveLength(starterDeckSize);
    });

    it("keeps a successful DIY response fully cancelling damage", () => {
      let pending = startDIYAttack(
        createRoleGame(["chemistry_enthusiast", "clumsy_party_secretary"]),
        damageDIY.acid,
      );
      pending = putCardInHand(pending, "player_2", "substance_naoh_dilute_01");

      const resolved = engineReducer(pending, {
        type: "RESPOND_WITH_CARD",
        playerId: "player_2",
        cardInstanceId: "substance_naoh_dilute_01",
      });

      expect(resolved.players[1].hp).toBe(10);
      expect(resolved.pendingResponse).toBeUndefined();
      expect(resolved.discardPile.filter((id) => id === "ion_h_01")).toHaveLength(1);
      expect(resolved.discardPile.filter((id) => id === "ion_cl_01")).toHaveLength(1);
    });

    it("does not reset usedDIYThisCycle in a new round and resets it in a new cycle", () => {
      let state = passResponse(
        startDIYAttack(
          createRoleGame(["chemistry_enthusiast", "clumsy_party_secretary"]),
          damageDIY.acid,
        ),
      );
      state = engineReducer(state, { type: "PASS_ACTION", playerId: state.activePlayerId });
      expect(state.roundInCycle).toBe(2);
      expect(state.activePlayerId).toBe("player_1");
      expect(state.players[0].usedDIYThisCycle).toBe(true);

      state = putCardsInHand(state, "player_1", damageDIY.base.componentCardInstanceIds);
      const rejected = engineReducer(state, {
        type: "START_ACTIVE_DIY",
        playerId: "player_1",
        recipeId: damageDIY.base.recipeId,
        componentCardInstanceIds: [...damageDIY.base.componentCardInstanceIds],
        targetPlayerId: "player_2",
      });
      expect(rejected).toBe(state);

      for (let action = 0; action < 4; action += 1) {
        state = engineReducer(state, { type: "PASS_ACTION", playerId: state.activePlayerId });
      }

      expect(state.cycleNumber).toBe(2);
      expect(state.roundInCycle).toBe(1);
      expect(state.players[0].usedDIYThisCycle).toBe(false);

      const nextCyclePending = startDIYAttack(state, damageDIY.base);
      expect(nextCyclePending.phase).toBe("responseWindow");
      expect(getPendingResolution(nextCyclePending).finalAmount).toBe(2);
    });

    it("does not turn a real non-damage SO2 DIY into DAMAGE", () => {
      let state = createRoleGame(["chemistry_enthusiast", "clumsy_party_secretary"]);
      state = putCardsInHand(state, "player_1", ["element_s_01", "element_o_01", "element_o_02"]);
      const resolved = engineReducer(state, {
        type: "START_ACTIVE_DIY",
        playerId: "player_1",
        recipeId: "diy_so2_from_s_o_o",
        componentCardInstanceIds: ["element_s_01", "element_o_01", "element_o_02"],
        targetPlayerId: "player_2",
      });

      expect(resolved.pendingResponse).toBeUndefined();
      expect(resolved.players[1].hp).toBe(10);
      expect(resolved.players[1].statuses.map((status) => status.statusId)).toEqual(["SO2_LEAK"]);
      expect(resolved.players[0].usedDIYThisCycle).toBe(true);
    });

    it("orders DIY increase before the acid king's reduction and minimum", () => {
      const pending = startDIYAttack(
        createRoleGame(["chemistry_enthusiast", "acid_king"]),
        damageDIY.acid,
      );
      const resolution = getPendingResolution(pending);

      expect(resolution.trace[2]).toMatchObject({ inputAmount: 1, outputAmount: 2 });
      expect(resolution.trace[4]).toMatchObject({ inputAmount: 2, outputAmount: 1 });
      expect(resolution.trace[5]).toMatchObject({ inputAmount: 1, outputAmount: 1 });
      expect(passResponse(pending).players[1].hp).toBe(9);
    });
  });

  describe("sulfuric acid process and cross-skill invariants", () => {
    it("adds 1 only for the director's real H2SO4 card and keeps attacker identity", () => {
      const pending = startCardAttack(
        createRoleGame(["sulfuric_acid_factory_director", "clumsy_party_secretary"]),
        "substance_h2so4_dilute_01",
      );
      const context = pending.pendingResponse?.sourceEffect.context;

      expect(context?.source).toMatchObject({
        kind: "card",
        sourcePlayerId: "player_1",
        cardDefinitionId: "substance_h2so4_dilute",
      });
      expect(getPendingResolution(pending).trace[2]).toMatchObject({
        inputAmount: 1,
        outputAmount: 2,
        modifier: { source: { skillId: "sulfuric_acid_process", sourcePlayerId: "player_1" } },
      });
      const resolved = passResponse(pending);
      expect(resolved.players[1].hp).toBe(8);
      expect(finalDamageLog(resolved)).toContain("受到 2 点酸性伤害");
    });

    it("does not apply to HCl, virtual H2SO4 DIY, SO4 ion play, or another role", () => {
      const hclResolved = passResponse(
        startCardAttack(
          createRoleGame(["sulfuric_acid_factory_director", "clumsy_party_secretary"]),
          "substance_hcl_dilute_01",
        ),
      );
      const diyResolved = passResponse(
        startDIYAttack(
          createRoleGame(["sulfuric_acid_factory_director", "clumsy_party_secretary"]),
          damageDIY.h2so4,
        ),
      );
      const otherRoleResolved = passResponse(
        startCardAttack(
          createRoleGame(["clumsy_party_secretary", "clumsy_party_secretary"]),
          "substance_h2so4_dilute_01",
        ),
      );
      const ionState = putCardInHand(
        createRoleGame(["sulfuric_acid_factory_director", "clumsy_party_secretary"]),
        "player_1",
        "ion_so4_01",
      );
      const rejectedIonPlay = engineReducer(ionState, {
        type: "PLAY_CARD",
        playerId: "player_1",
        cardInstanceId: "ion_so4_01",
        targetPlayerId: "player_2",
      });

      expect(hclResolved.players[1].hp).toBe(9);
      expect(diyResolved.players[1].hp).toBe(9);
      expect(otherRoleResolved.players[1].hp).toBe(9);
      expect(rejectedIonPlay).toBe(ionState);
    });

    it("orders the director's H2SO4 increase before acid resistance", () => {
      const pending = startCardAttack(
        createRoleGame(["sulfuric_acid_factory_director", "acid_king"]),
        "substance_h2so4_dilute_01",
      );
      const resolution = getPendingResolution(pending);

      expect(resolution.trace[2]).toMatchObject({ inputAmount: 1, outputAmount: 2 });
      expect(resolution.trace[4]).toMatchObject({ inputAmount: 2, outputAmount: 1 });
      expect(passResponse(pending).players[1].hp).toBe(9);
    });

    it("applies mastery before protection and immunity stays at 0 through minimum and cap", () => {
      const pending = startCardAttack(
        createRoleGame(["caustic_soda_captain", "caustic_soda_captain"]),
        "substance_naoh_dilute_01",
      );
      const resolution = getPendingResolution(pending);

      expect(resolution.trace[2]).toMatchObject({ inputAmount: 1, outputAmount: 2 });
      expect(resolution.trace[3]).toMatchObject({ inputAmount: 2, outputAmount: 0 });
      expect(resolution.trace[5]).toMatchObject({ outputAmount: 0, skippedByImmunity: true });
      expect(resolution.trace[6].outputAmount).toBe(0);
      expect(passResponse(pending).players[1].hp).toBe(10);
    });

    it("preserves card count, zero event instances, table reference, zones, and turn advance", () => {
      const pending = startCardAttack(
        createRoleGame(["sulfuric_acid_factory_director", "acid_king"]),
        "substance_h2so4_dilute_01",
      );
      const reference = pending.tableReference;
      const resolved = passResponse(pending);

      expect(Object.keys(resolved.cardInstances)).toHaveLength(68);
      expect(starterDeckSize).toBe(68);
      expect(
        Object.values(resolved.cardInstances).filter(
          (instance) => instance.definitionId === "event_lab_fire",
        ),
      ).toHaveLength(0);
      expect(resolved.tableReference).toEqual(reference);
      expect(resolved.activePlayerId).toBe("player_2");
      expect(resolved.discardPile).toContain("substance_h2so4_dilute_01");
      expectCardZonesToBeConsistent(resolved);
    });

    it("does not collect modifiers for unknown or eliminated players and never mutates tags", () => {
      const pending = startCardAttack(
        createRoleGame(["acid_king", "clumsy_party_secretary"]),
        "substance_hcl_dilute_01",
      );
      const context = pending.pendingResponse?.sourceEffect.context;
      if (!context) {
        throw new Error("Expected pending context.");
      }
      const tagsBefore = [...context.tags];
      const eliminatedAttacker = updatePlayer(pending, "player_1", (player) => ({
        ...player,
        eliminated: true,
      }));
      const unknownSourceContext: DamageContext = {
        ...context,
        source: {
          kind: "character-skill",
          sourcePlayerId: "player_missing",
          skillId: "acid_corrosion",
        },
      };
      const targetPending = startCardAttack(
        createRoleGame(["clumsy_party_secretary", "acid_king"]),
        "substance_hcl_dilute_01",
      );
      const targetContext = targetPending.pendingResponse?.sourceEffect.context;
      if (!targetContext) {
        throw new Error("Expected target passive context.");
      }
      const eliminatedTarget = updatePlayer(targetPending, "player_2", (player) => ({
        ...player,
        eliminated: true,
      }));

      expect(collectDamageModifiers(eliminatedAttacker, context).setValue).toBeUndefined();
      expect(collectDamageModifiers(pending, unknownSourceContext)).toEqual({});
      expect(collectDamageModifiers(eliminatedTarget, targetContext)).toEqual({});
      expect(context.tags).toEqual(tagsBefore);
    });
  });
});
