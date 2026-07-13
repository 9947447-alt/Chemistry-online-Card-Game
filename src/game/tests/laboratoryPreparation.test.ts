import { describe, expect, it } from "vitest";
import { starterDeckSize } from "../data/starterDeck";
import type { GameAction } from "../engine/actions";
import { createInitialGame } from "../engine/createInitialGame";
import { dealCycleStartHands, drawCardsForPlayer } from "../engine/turnFlow";
import type { CardInstanceId, CharacterId, GameState } from "../engine/types";
import { engineReducer } from "../engine/reducer";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";

function confirmCurrentPreparation(state: GameState): GameState {
  const pending = state.pendingLaboratoryPreparation;

  if (!pending) {
    throw new Error("Expected a laboratory preparation selection.");
  }

  return engineReducer(state, {
    type: "CONFIRM_LABORATORY_PREPARATION",
    playerId: pending.playerId,
    keptCardInstanceIds: pending.candidateCardInstanceIds.slice(0, pending.keepCount),
  });
}

function passCurrentAction(state: GameState): GameState {
  return engineReducer(state, {
    type: "PASS_ACTION",
    playerId: state.activePlayerId,
  });
}

function moveHandCardsToDeck(
  state: GameState,
  playerId: string,
  cardIds: CardInstanceId[],
): GameState {
  const movedIds = new Set(cardIds);
  const cardInstances = { ...state.cardInstances };

  for (const cardId of cardIds) {
    cardInstances[cardId] = {
      ...cardInstances[cardId],
      ownerId: undefined,
      zone: { type: "deck" },
    };
  }

  return {
    ...state,
    cardInstances,
    deck: [...cardIds, ...state.deck],
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, hand: player.hand.filter((cardId) => !movedIds.has(cardId)) }
        : player,
    ),
  };
}

function moveCardsToPlayerHand(
  state: GameState,
  playerId: string,
  cardIds: CardInstanceId[],
): GameState {
  const movedIds = new Set(cardIds);
  const cardInstances = { ...state.cardInstances };

  for (const cardId of cardIds) {
    cardInstances[cardId] = {
      ...cardInstances[cardId],
      ownerId: playerId,
      zone: { type: "hand", playerId },
    };
  }

  return {
    ...state,
    cardInstances,
    deck: state.deck.filter((cardId) => !movedIds.has(cardId)),
    discardPile: state.discardPile.filter((cardId) => !movedIds.has(cardId)),
    players: state.players.map((player) => ({
      ...player,
      hand: [
        ...player.hand.filter((cardId) => !movedIds.has(cardId)),
        ...(player.id === playerId ? cardIds : []),
      ],
    })),
  };
}

function withPendingLaboratoryPreparation(
  state: GameState,
  pending: unknown,
): GameState {
  return {
    ...state,
    pendingLaboratoryPreparation:
      pending as GameState["pendingLaboratoryPreparation"],
  };
}

function expectPreparationRejection(state: GameState, action: GameAction): void {
  const rejected = engineReducer(state, action);

  expect(rejected).toBe(state);
  expect(rejected.players).toBe(state.players);
  expect(rejected.deck).toBe(state.deck);
  expect(rejected.discardPile).toBe(state.discardPile);
  expect(rejected.log).toBe(state.log);
  expect(rejected.tableReference).toBe(state.tableReference);
  expectCardZonesToBeConsistent(rejected);
}

describe("Phase 8B-1 cycle draws and laboratory preparation", () => {
  it("deals 20 candidates to the default teacher and 14 cards to the CEO", () => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const pending = state.pendingLaboratoryPreparation;

    expect(state.phase).toBe("preparationSelection");
    expect(state.players[0].characterId).toBe("laboratory_teacher");
    expect(state.players[0].hand).toHaveLength(20);
    expect(state.players[1].characterId).toBe("chemical_factory_ceo");
    expect(state.players[1].hand).toHaveLength(14);
    expect(pending?.playerId).toBe(state.players[0].id);
    expect(pending?.candidateCardInstanceIds).toEqual(state.players[0].hand);
    expect(pending?.keepCount).toBe(10);
    expect(pending?.remainingSelections).toEqual([]);
    expect(Object.keys(state.cardInstances)).toHaveLength(68);
    expect(
      Object.values(state.cardInstances).some(
        (instance) => instance.definitionId === "event_lab_fire",
      ),
    ).toBe(false);
    expectCardZonesToBeConsistent(state);
  });

  it.each([
    "clumsy_party_secretary",
    "caustic_soda_captain",
    "acid_king",
    "chemistry_enthusiast",
    "sulfuric_acid_factory_director",
  ] satisfies CharacterId[])(
    "deals 10 cards to ordinary character %s without opening a selection",
    (characterId) => {
      const state = createInitialGame({
        characterIds: [characterId, characterId],
        shuffle: identityShuffle,
      });

      expect(state.phase).toBe("mainAction");
      expect(state.players.map((player) => player.hand.length)).toEqual([10, 10]);
      expect(state.pendingLaboratoryPreparation).toBeUndefined();
      expectCardZonesToBeConsistent(state);
    },
  );

  it("keeps exactly 10 selected candidates and discards the other 10", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const pending = state.pendingLaboratoryPreparation!;
    const keptIds = pending.candidateCardInstanceIds.slice(0, 10);
    const discardedIds = pending.candidateCardInstanceIds.slice(10);
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === pending.playerId
          ? {
              ...player,
              usedDIYThisCycle: true,
              characterUsage: {
                perCycle: { laboratory_teacher_extra_lesson: 1 },
                perRound: { sulfuric_acid_factory_director_sulfate_byproduct: 1 },
              },
            }
          : player,
      ),
    };

    const resolved = engineReducer(state, {
      type: "CONFIRM_LABORATORY_PREPARATION",
      playerId: pending.playerId,
      keptCardInstanceIds: keptIds,
    });

    expect(resolved.phase).toBe("mainAction");
    expect(resolved.activePlayerId).toBe(state.startingPlayerId);
    expect(resolved.pendingLaboratoryPreparation).toBeUndefined();
    expect(resolved.players[0].hand).toEqual(keptIds);
    expect(resolved.discardPile).toEqual(discardedIds);
    expect(resolved.tableReference).toBeUndefined();
    expect(resolved.players[0].usedDIYThisCycle).toBe(true);
    expect(resolved.players[0].characterUsage).toEqual(
      state.players[0].characterUsage,
    );
    expect(resolved.log.at(-1)?.message).toContain("完成备课");
    expectCardZonesToBeConsistent(resolved);
  });

  it.each([
    ["fewer than 10 IDs", (state: GameState) => state.pendingLaboratoryPreparation!.candidateCardInstanceIds.slice(0, 9)],
    ["more than 10 IDs", (state: GameState) => state.pendingLaboratoryPreparation!.candidateCardInstanceIds.slice(0, 11)],
    [
      "a duplicate ID",
      (state: GameState) => {
        const candidates = state.pendingLaboratoryPreparation!.candidateCardInstanceIds;
        return [...candidates.slice(0, 9), candidates[0]];
      },
    ],
    [
      "a non-candidate ID",
      (state: GameState) => [
        ...state.pendingLaboratoryPreparation!.candidateCardInstanceIds.slice(0, 9),
        state.deck[0],
      ],
    ],
    [
      "another player's card ID",
      (state: GameState) => [
        ...state.pendingLaboratoryPreparation!.candidateCardInstanceIds.slice(0, 9),
        state.players[1].hand[0],
      ],
    ],
  ])("rejects a preparation confirmation containing %s without side effects", (_label, makeIds) => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const pending = state.pendingLaboratoryPreparation!;
    const rejected = engineReducer(state, {
      type: "CONFIRM_LABORATORY_PREPARATION",
      playerId: pending.playerId,
      keptCardInstanceIds: makeIds(state),
    });

    expect(rejected).toBe(state);
    expectCardZonesToBeConsistent(rejected);
  });

  it("rejects confirmation by a player who is not the current selector", () => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const pending = state.pendingLaboratoryPreparation!;
    const rejected = engineReducer(state, {
      type: "CONFIRM_LABORATORY_PREPARATION",
      playerId: state.players[1].id,
      keptCardInstanceIds: pending.candidateCardInstanceIds.slice(0, 10),
    });

    expect(rejected).toBe(state);
    expectCardZonesToBeConsistent(rejected);
  });

  it.each([
    [
      "a missing current player",
      (state: GameState) =>
        withPendingLaboratoryPreparation(state, {
          ...state.pendingLaboratoryPreparation!,
          playerId: "missing_player",
        }),
    ],
    [
      "a non-teacher current player",
      (state: GameState) => ({
        ...state,
        players: state.players.map((player) =>
          player.id === state.pendingLaboratoryPreparation!.playerId
            ? { ...player, characterId: "acid_king" as const }
            : player,
        ),
      }),
    ],
    [
      "an eliminated current teacher",
      (state: GameState) => ({
        ...state,
        players: state.players.map((player) =>
          player.id === state.pendingLaboratoryPreparation!.playerId
            ? { ...player, eliminated: true }
            : player,
        ),
      }),
    ],
    [
      "a runtime keepCount other than 10",
      (state: GameState) =>
        withPendingLaboratoryPreparation(state, {
          ...state.pendingLaboratoryPreparation!,
          keepCount: 9,
        }),
    ],
    [
      "duplicate candidate IDs",
      (state: GameState) => {
        const pending = state.pendingLaboratoryPreparation!;
        return withPendingLaboratoryPreparation(state, {
          ...pending,
          candidateCardInstanceIds: [
            ...pending.candidateCardInstanceIds.slice(0, 19),
            pending.candidateCardInstanceIds[0],
          ],
        });
      },
    ],
    [
      "fewer than 20 candidates",
      (state: GameState) => {
        const pending = state.pendingLaboratoryPreparation!;
        return withPendingLaboratoryPreparation(state, {
          ...pending,
          candidateCardInstanceIds: pending.candidateCardInstanceIds.slice(0, 19),
        });
      },
    ],
    [
      "a missing candidate instance",
      (state: GameState) => {
        const pending = state.pendingLaboratoryPreparation!;
        return withPendingLaboratoryPreparation(state, {
          ...pending,
          candidateCardInstanceIds: [
            ...pending.candidateCardInstanceIds.slice(0, 19),
            "missing_card_instance",
          ],
        });
      },
    ],
    [
      "a candidate outside the current teacher hand",
      (state: GameState) => {
        const pending = state.pendingLaboratoryPreparation!;
        return withPendingLaboratoryPreparation(state, {
          ...pending,
          candidateCardInstanceIds: [
            ...pending.candidateCardInstanceIds.slice(0, 19),
            state.deck[0],
          ],
        });
      },
    ],
  ] satisfies [string, (state: GameState) => GameState][])(
    "rejects pending with %s",
    (_label, corruptState) => {
      const state = corruptState(createInitialGame({ shuffle: identityShuffle }));
      const pending = state.pendingLaboratoryPreparation!;

      expectPreparationRejection(state, {
        type: "CONFIRM_LABORATORY_PREPARATION",
        playerId: pending.playerId,
        keptCardInstanceIds: pending.candidateCardInstanceIds.slice(0, 10),
      });
    },
  );

  it.each([
    [
      "a missing waiting player",
      (state: GameState) => {
        const pending = state.pendingLaboratoryPreparation!;
        const [waiting] = pending.remainingSelections;
        return withPendingLaboratoryPreparation(state, {
          ...pending,
          remainingSelections: [{ ...waiting, playerId: "missing_player" }],
        });
      },
    ],
    [
      "a duplicate waiting player",
      (state: GameState) => {
        const pending = state.pendingLaboratoryPreparation!;
        const [waiting] = pending.remainingSelections;
        return withPendingLaboratoryPreparation(state, {
          ...pending,
          remainingSelections: [waiting, waiting],
        });
      },
    ],
    [
      "the current player in the waiting queue",
      (state: GameState) => {
        const pending = state.pendingLaboratoryPreparation!;
        return withPendingLaboratoryPreparation(state, {
          ...pending,
          remainingSelections: [
            ...pending.remainingSelections,
            {
              playerId: pending.playerId,
              candidateCardInstanceIds: pending.candidateCardInstanceIds,
            },
          ],
        });
      },
    ],
    [
      "a non-teacher waiting player",
      (state: GameState) => ({
        ...state,
        players: state.players.map((player) =>
          player.id === state.pendingLaboratoryPreparation!.remainingSelections[0].playerId
            ? { ...player, characterId: "acid_king" as const }
            : player,
        ),
      }),
    ],
    [
      "an eliminated waiting teacher",
      (state: GameState) => ({
        ...state,
        players: state.players.map((player) =>
          player.id === state.pendingLaboratoryPreparation!.remainingSelections[0].playerId
            ? { ...player, eliminated: true }
            : player,
        ),
      }),
    ],
  ] satisfies [string, (state: GameState) => GameState][])(
    "rejects a waiting queue containing %s",
    (_label, corruptState) => {
      const state = corruptState(
        createInitialGame({
          characterIds: ["laboratory_teacher", "laboratory_teacher"],
          shuffle: identityShuffle,
        }),
      );
      const pending = state.pendingLaboratoryPreparation!;

      expectPreparationRejection(state, {
        type: "CONFIRM_LABORATORY_PREPARATION",
        playerId: pending.playerId,
        keptCardInstanceIds: pending.candidateCardInstanceIds.slice(0, 10),
      });
    },
  );

  it("rejects confirmation outside preparation phase and inconsistent pending states", () => {
    const preparationState = createInitialGame({ shuffle: identityShuffle });
    const pending = preparationState.pendingLaboratoryPreparation!;
    const action: GameAction = {
      type: "CONFIRM_LABORATORY_PREPARATION",
      playerId: pending.playerId,
      keptCardInstanceIds: pending.candidateCardInstanceIds.slice(0, 10),
    };
    const missingPending = {
      ...preparationState,
      pendingLaboratoryPreparation: undefined,
    };
    const wrongPhase = { ...preparationState, phase: "mainAction" as const };

    expectPreparationRejection(missingPending, action);
    expectPreparationRejection(wrongPhase, action);

    const resolved = confirmCurrentPreparation(preparationState);
    const residualPending = withPendingLaboratoryPreparation(resolved, pending);
    expectPreparationRejection(residualPending, action);
  });

  it("rejects an action containing a missing instance ID", () => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const pending = state.pendingLaboratoryPreparation!;

    expectPreparationRejection(state, {
      type: "CONFIRM_LABORATORY_PREPARATION",
      playerId: pending.playerId,
      keptCardInstanceIds: [
        ...pending.candidateCardInstanceIds.slice(0, 9),
        "missing_card_instance",
      ],
    });
  });

  it("rejects every existing non-preparation action during selection", () => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const teacherCardId = state.players[0].hand[0];
    const actions: GameAction[] = [
      { type: "PASS_ACTION", playerId: state.players[0].id },
      {
        type: "PLAY_REFERENCE_CARD",
        playerId: state.players[0].id,
        cardInstanceId: teacherCardId,
      },
      {
        type: "PLAY_CARD",
        playerId: state.players[0].id,
        cardInstanceId: teacherCardId,
        targetPlayerId: state.players[1].id,
      },
      {
        type: "START_ACTIVE_DIY",
        playerId: state.players[0].id,
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: state.players[0].hand.slice(0, 2),
        targetPlayerId: state.players[1].id,
      },
      {
        type: "RESPOND_WITH_CARD",
        playerId: state.players[0].id,
        cardInstanceId: teacherCardId,
      },
      { type: "PASS_RESPONSE", playerId: state.players[0].id },
      {
        type: "HANDLE_STATUS_WITH_CARD",
        playerId: state.players[0].id,
        statusInstanceId: "status_not_open",
        cardInstanceId: teacherCardId,
      },
      {
        type: "PASS_STATUS_HANDLING",
        playerId: state.players[0].id,
        statusInstanceId: "status_not_open",
      },
    ];

    for (const action of actions) {
      expect(engineReducer(state, action), action.type).toBe(state);
    }
    expectCardZonesToBeConsistent(state);
  });

  it("processes two laboratory teachers in player order before main action", () => {
    let state = createInitialGame({
      characterIds: ["laboratory_teacher", "laboratory_teacher"],
      shuffle: identityShuffle,
    });

    expect(state.players.map((player) => player.hand.length)).toEqual([20, 20]);
    expect(state.pendingLaboratoryPreparation?.playerId).toBe("player_1");
    expect(state.pendingLaboratoryPreparation?.remainingSelections).toHaveLength(1);

    state = confirmCurrentPreparation(state);

    expect(state.phase).toBe("preparationSelection");
    expect(state.pendingLaboratoryPreparation?.playerId).toBe("player_2");
    expect(state.players.map((player) => player.hand.length)).toEqual([10, 20]);
    expect(passCurrentAction(state)).toBe(state);

    state = confirmCurrentPreparation(state);

    expect(state.phase).toBe("mainAction");
    expect(state.activePlayerId).toBe("player_1");
    expect(state.players.map((player) => player.hand.length)).toEqual([10, 10]);
    expectCardZonesToBeConsistent(state);
  });

  it("reapplies teacher and CEO cycle draws at the next cycle", () => {
    let state = confirmCurrentPreparation(
      createInitialGame({ shuffle: identityShuffle }),
    );

    for (let action = 0; action < 6; action += 1) {
      state = passCurrentAction(state);
    }

    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.phase).toBe("preparationSelection");
    expect(state.players[0].hand).toHaveLength(20);
    expect(state.players[1].hand).toHaveLength(14);
    expect(state.pendingLaboratoryPreparation?.playerId).toBe("player_1");
    expect(state.tableReference).toBeUndefined();
    expect(state.players.every((player) => !player.usedDIYThisCycle)).toBe(true);
    expect(
      state.players.every(
        (player) =>
          Object.keys(player.characterUsage.perCycle).length === 0 &&
          Object.keys(player.characterUsage.perRound).length === 0,
      ),
    ).toBe(true);
    expectCardZonesToBeConsistent(state);
  });

  it("caps CEO draws at 14 without drawing and then discarding", () => {
    let state = createInitialGame({
      characterIds: ["acid_king", "chemical_factory_ceo"],
      shuffle: identityShuffle,
    });
    const ceo = state.players[1];
    const returnedIds = ceo.hand.slice(0, 2);
    state = moveHandCardsToDeck(state, ceo.id, returnedIds);
    const discardBefore = [...state.discardPile];

    const drawn = drawCardsForPlayer(state, ceo.id, 3, identityShuffle);

    expect(drawn.players[1].hand).toHaveLength(14);
    expect(drawn.deck).toHaveLength(state.deck.length - 2);
    expect(drawn.discardPile).toEqual(discardBefore);
    expectCardZonesToBeConsistent(drawn);

    const atLimit = drawCardsForPlayer(drawn, ceo.id, 3, identityShuffle);
    expect(atLimit).toBe(drawn);
  });

  it("draws only one card when a 13-card CEO requests three", () => {
    let state = createInitialGame({
      characterIds: ["acid_king", "chemical_factory_ceo"],
      shuffle: identityShuffle,
    });
    const ceo = state.players[1];
    state = moveHandCardsToDeck(state, ceo.id, ceo.hand.slice(0, 1));
    const deckSizeBefore = state.deck.length;
    const discardBefore = state.discardPile;

    const drawn = drawCardsForPlayer(state, ceo.id, 3, identityShuffle);

    expect(drawn.players[1].hand).toHaveLength(14);
    expect(drawn.deck).toHaveLength(deckSizeBefore - 1);
    expect(drawn.discardPile).toBe(discardBefore);
    expect(Object.keys(drawn.cardInstances)).toHaveLength(68);
    expectCardZonesToBeConsistent(drawn);
  });

  it("does not impose the CEO hand limit on ordinary characters", () => {
    const state = createInitialGame({
      characterIds: ["acid_king", "chemistry_enthusiast"],
      shuffle: identityShuffle,
    });
    const drawn = drawCardsForPlayer(state, state.players[0].id, 1, identityShuffle);

    expect(drawn.players[0].hand).toHaveLength(11);
    expectCardZonesToBeConsistent(drawn);
  });

  it("uses the existing discard recycle path for capacity-limited CEO draws", () => {
    let state = createInitialGame({
      characterIds: ["acid_king", "chemical_factory_ceo"],
      shuffle: identityShuffle,
    });
    const ceo = state.players[1];
    const returnedIds = ceo.hand.slice(0, 2);
    state = moveHandCardsToDeck(state, ceo.id, returnedIds);
    const discardIds = [...state.deck];
    const cardInstances = { ...state.cardInstances };

    for (const cardId of discardIds) {
      cardInstances[cardId] = {
        ...cardInstances[cardId],
        ownerId: undefined,
        zone: { type: "discard" },
      };
    }
    state = {
      ...state,
      cardInstances,
      deck: [],
      discardPile: discardIds,
    };

    const drawn = drawCardsForPlayer(state, ceo.id, 3, identityShuffle);

    expect(drawn.players[1].hand).toHaveLength(14);
    expect(drawn.discardPile).toEqual([]);
    expect(drawn.deck).toHaveLength(discardIds.length - 2);
    expect(drawn.log.some((entry) => entry.message.includes("弃牌堆洗回主牌堆"))).toBe(true);
    expectCardZonesToBeConsistent(drawn);
  });

  it("stops an incomplete teacher draw without opening an impossible selection", () => {
    let state = createInitialGame({
      characterIds: ["acid_king", "acid_king"],
      shuffle: identityShuffle,
    });
    const playerOneHand = [...state.players[0].hand];
    const cardsToReserve = state.deck.slice(0, 15);
    const cardsToMove = [
      ...playerOneHand,
      ...state.deck.filter((cardId) => !cardsToReserve.includes(cardId)),
    ];
    state = moveCardsToPlayerHand(state, state.players[1].id, cardsToMove);
    state = {
      ...state,
      phase: "cycleStart",
      players: state.players.map((player) =>
        player.id === state.players[0].id
          ? { ...player, characterId: "laboratory_teacher" }
          : player,
      ),
    };

    const dealt = dealCycleStartHands(state, identityShuffle);

    expect(dealt.phase).toBe("setup");
    expect(dealt.pendingLaboratoryPreparation).toBeUndefined();
    expect(dealt.players[0].hand).toHaveLength(15);
    expect(Object.keys(dealt.cardInstances)).toHaveLength(68);
    expect(new Set(Object.keys(dealt.cardInstances))).toHaveLength(68);
    expect(
      dealt.log.filter((entry) => entry.message.includes("摸牌停止")),
    ).toHaveLength(1);
    expectCardZonesToBeConsistent(dealt);
  });

  it("enters the existing status window after the final teacher confirms", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const pending = state.pendingLaboratoryPreparation!;
    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === state.startingPlayerId
          ? {
              ...player,
              usedDIYThisCycle: true,
              characterUsage: {
                perCycle: { laboratory_teacher_extra_lesson: 1 },
                perRound: { sulfuric_acid_factory_director_sulfate_byproduct: 1 },
              },
              statuses: [
                ...player.statuses,
                {
                  id: "status_test_fire",
                  statusId: "FIRE",
                  sourcePlayerId: state.players[1].id,
                  createdAt: 1,
                },
              ],
            }
          : player,
      ),
    };

    const resolved = engineReducer(state, {
      type: "CONFIRM_LABORATORY_PREPARATION",
      playerId: pending.playerId,
      keptCardInstanceIds: pending.candidateCardInstanceIds.slice(0, 10),
    });

    expect(resolved.pendingLaboratoryPreparation).toBeUndefined();
    expect(resolved.phase).toBe("statusWindow");
    expect(resolved.activePlayerId).toBe(state.startingPlayerId);
    expect(resolved.cycleNumber).toBe(1);
    expect(resolved.roundInCycle).toBe(1);
    expect(resolved.pendingStatusHandling).toEqual({
      playerId: state.startingPlayerId,
      statusInstanceId: "status_test_fire",
    });
    expect(resolved.tableReference).toBe(state.tableReference);
    expect(resolved.players[0].usedDIYThisCycle).toBe(true);
    expect(resolved.players[0].characterUsage).toEqual(state.players[0].characterUsage);
    expectCardZonesToBeConsistent(resolved);
  });

  it("keeps the ordinary card pool at 68 with zero lab-fire instances", () => {
    const state = createInitialGame({ shuffle: identityShuffle });

    expect(starterDeckSize).toBe(68);
    expect(Object.keys(state.cardInstances)).toHaveLength(68);
    expect(
      Object.values(state.cardInstances).filter(
        (instance) => instance.definitionId === "event_lab_fire",
      ),
    ).toHaveLength(0);
  });
});
