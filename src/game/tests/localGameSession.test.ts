import { describe, expect, it, vi } from "vitest";
import { characterDefinitions, getCharacterDefinition } from "../data/characterDefinitions";
import { starterDeckSize } from "../data/starterDeck";
import { createInitialGame } from "../engine/createInitialGame";
import type { CharacterId, GameState } from "../engine/types";
import { identityShuffle } from "../../shared/random";
import {
  createConfiguringLocalGameSession,
  createFatalLocalGameSession,
  defaultCharacterSelection,
  formatFatalDiagnostics,
  isCharacterSelection,
  localGameSessionReducer,
  type CharacterSelection,
  type LocalGameFactory,
  type LocalGameSessionState,
  type PlayingLocalGameSession,
} from "../../features/local-game/localGameSession";

const deterministicGameFactory: LocalGameFactory = (characterIds) =>
  createInitialGame({
    characterIds: [characterIds[0], characterIds[1]],
    shuffle: identityShuffle,
  });

function configureAndStart(
  characterIds: CharacterSelection,
  createGame: LocalGameFactory = deterministicGameFactory,
): PlayingLocalGameSession {
  let state: LocalGameSessionState = createConfiguringLocalGameSession();

  state = localGameSessionReducer(state, {
    type: "SELECT_CHARACTER",
    playerIndex: 0,
    characterId: characterIds[0],
  });
  state = localGameSessionReducer(state, {
    type: "SELECT_CHARACTER",
    playerIndex: 1,
    characterId: characterIds[1],
  });
  const game = createGame(state.characterIds);
  state = localGameSessionReducer(state, {
    type: "APPLY_STARTED_LOCAL_GAME",
    expectedRevision: state.revision,
    characterIds: state.characterIds,
    game,
  });

  if (state.mode !== "playing") {
    throw new Error("Expected a playing local game session.");
  }

  return state;
}

function restartCurrentLineup(
  state: PlayingLocalGameSession,
  createGame: LocalGameFactory = deterministicGameFactory,
): PlayingLocalGameSession {
  const game = createGame(state.characterIds);
  const restarted = localGameSessionReducer(state, {
    type: "APPLY_RESTARTED_LOCAL_GAME",
    expectedRevision: state.revision,
    characterIds: state.characterIds,
    game,
  });

  if (restarted.mode !== "playing") {
    throw new Error("Expected a restarted playing local game session.");
  }

  return restarted;
}

const orderedCharacterLineups = characterDefinitions.flatMap((playerOne) =>
  characterDefinitions.map((playerTwo) => ({
    label: `${playerOne.id} / ${playerTwo.id}`,
    characterIds: [playerOne.id, playerTwo.id] satisfies CharacterSelection,
  })),
);

describe("Phase 9 local Debug Alpha configuration", () => {
  it("starts in configuring mode with the frozen teacher and CEO defaults", () => {
    const state = createConfiguringLocalGameSession();

    expect(state).toEqual({
      mode: "configuring",
      characterIds: defaultCharacterSelection,
      revision: 0,
      error: null,
    });
    expect("game" in state).toBe(false);
  });

  it("uses all seven formal character definitions as the display source", () => {
    expect(characterDefinitions).toHaveLength(7);
    expect(new Set(characterDefinitions.map((character) => character.id)).size).toBe(7);

    for (const character of characterDefinitions) {
      expect(getCharacterDefinition(character.id)).toBe(character);
      expect(character.name).not.toBe("");
      expect(character.maxHp).toBeGreaterThan(0);
      expect(character.skills.length).toBeGreaterThan(0);
      expect(character.skills.every((skill) => (
        skill.name.length > 0 &&
        skill.rulesText.length > 0 &&
        skill.implementationStatus.length > 0
      ))).toBe(true);
    }
  });

  it("rejects an unknown runtime selection before any game factory is called", () => {
    const createGame = vi.fn(deterministicGameFactory);
    const state = createConfiguringLocalGameSession();
    const nextState = localGameSessionReducer(state, {
      type: "SELECT_CHARACTER",
      playerIndex: 0,
      characterId: "missing_character",
    });

    expect(nextState.mode).toBe("configuring");
    expect(nextState.characterIds).toBe(state.characterIds);
    expect(nextState.error).toContain("未知角色");
    expect(createGame).not.toHaveBeenCalled();
    expect(isCharacterSelection(["missing_character", "chemical_factory_ceo"])).toBe(false);
  });

  it("applies one pre-created GameState and ignores a duplicate start result", () => {
    const createGame = vi.fn(deterministicGameFactory);
    const configuring = createConfiguringLocalGameSession();
    const game = createGame(configuring.characterIds);
    const action = {
      type: "APPLY_STARTED_LOCAL_GAME" as const,
      expectedRevision: configuring.revision,
      characterIds: configuring.characterIds,
      game,
    };
    const first = localGameSessionReducer(configuring, action);
    const second = localGameSessionReducer(first, action);

    expect(first.mode).toBe("playing");
    expect(second).toBe(first);
    expect(createGame).toHaveBeenCalledOnce();
    expect(createGame).toHaveBeenCalledWith(defaultCharacterSelection);
    if (first.mode === "playing") {
      expect(first.game).toBe(game);
    }
  });

  it("rejects a pre-created GameState whose players do not match the selected lineup", () => {
    const configuring = createConfiguringLocalGameSession();
    const mismatchedGame = deterministicGameFactory([
      "acid_king",
      "chemistry_enthusiast",
    ]);
    const nextState = localGameSessionReducer(configuring, {
      type: "APPLY_STARTED_LOCAL_GAME",
      expectedRevision: configuring.revision,
      characterIds: configuring.characterIds,
      game: mismatchedGame,
    });

    expect(nextState.mode).toBe("fatal");
    expect("game" in nextState).toBe(false);
    if (nextState.mode === "fatal") {
      expect(nextState.error.code).toBe("GAME_STATE_VALIDATION_FAILED");
    }
  });

  it.each(orderedCharacterLineups)(
    "creates the ordered lineup $label through the real initializer",
    ({ characterIds }) => {
      const state = configureAndStart(characterIds);
      const containsTeacher = characterIds.includes("laboratory_teacher");

      expect(state.characterIds).toEqual(characterIds);
      expect(state.game.players.map((player) => player.characterId)).toEqual(characterIds);
      expect(state.game.players.map((player) => [player.hp, player.maxHp])).toEqual(
        characterIds.map((characterId) => {
          const maxHp = getCharacterDefinition(characterId).maxHp;
          return [maxHp, maxHp];
        }),
      );
      expect(state.game.phase).toBe(containsTeacher ? "preparationSelection" : "mainAction");
      expect(Object.keys(state.game.cardInstances)).toHaveLength(starterDeckSize);
      expect(
        Object.values(state.game.cardInstances).filter(
          (card) => card.definitionId === "event_lab_fire",
        ),
      ).toHaveLength(0);
    },
  );

  it("queues mirrored teachers for preparation in player order", () => {
    const state = configureAndStart([
      "laboratory_teacher",
      "laboratory_teacher",
    ]);
    const firstPreparation = state.game.pendingLaboratoryPreparation;

    expect(state.game.phase).toBe("preparationSelection");
    expect(firstPreparation?.playerId).toBe("player_1");
    expect(firstPreparation?.remainingSelections.map((selection) => selection.playerId)).toEqual([
      "player_2",
    ]);

    if (!firstPreparation) {
      throw new Error("Expected the first teacher preparation selection.");
    }

    const afterFirstTeacher = localGameSessionReducer(state, {
      type: "DISPATCH_GAME_ACTION",
      action: {
        type: "CONFIRM_LABORATORY_PREPARATION",
        playerId: firstPreparation.playerId,
        keptCardInstanceIds: firstPreparation.candidateCardInstanceIds.slice(0, 10),
      },
    });

    expect(afterFirstTeacher.mode).toBe("playing");
    if (afterFirstTeacher.mode !== "playing") {
      return;
    }
    expect(afterFirstTeacher.game.phase).toBe("preparationSelection");
    expect(afterFirstTeacher.game.pendingLaboratoryPreparation?.playerId).toBe("player_2");
    expect(afterFirstTeacher.game.pendingLaboratoryPreparation?.remainingSelections).toEqual([]);
  });
});

describe("Phase 9 current-lineup restart", () => {
  it("rebuilds every in-game field from initialization without mutating the old state", () => {
    const started = configureAndStart([
      "chemistry_enthusiast",
      "chemical_factory_ceo",
    ]);
    const firstCardId = started.game.players[0].hand[0];
    const dirtyGame: GameState = {
      ...started.game,
      phase: "statusWindow",
      cycleNumber: 3,
      roundInCycle: 2,
      players: started.game.players.map((player, index) => ({
        ...player,
        hp: player.hp - 2,
        statuses: index === 0
          ? [{ id: "dirty_fire", statusId: "FIRE", createdAt: 99 }]
          : [],
        usedDIYThisCycle: true,
        characterUsage: {
          perCycle: { chemistry_enthusiast_counterattack: 1 },
          perRound: { sulfuric_acid_factory_director_sulfate_byproduct: 1 },
        },
      })),
      deck: started.game.deck.slice(2),
      discardPile: [...started.game.discardPile, ...started.game.deck.slice(0, 2)],
      tableReference: {
        cardInstanceId: firstCardId,
        definitionId: started.game.cardInstances[firstCardId].definitionId,
        displayName: "旧场面基准",
        playedBy: "player_1",
        cycle: 3,
        round: 2,
      },
      pendingStatusHandling: {
        playerId: "player_1",
        statusInstanceId: "dirty_fire",
      },
      effectQueue: [{ type: "ADVANCE_TURN" }],
      log: [...started.game.log, { id: "dirty_log", message: "旧对局日志" }],
      winnerPlayerId: "player_2",
    };
    const dirtySession: PlayingLocalGameSession = {
      ...started,
      game: dirtyGame,
      error: "旧错误",
    };
    const oldSnapshot = structuredClone(dirtyGame);
    const expectedFreshGame = deterministicGameFactory(dirtySession.characterIds);
    const restarted = restartCurrentLineup(dirtySession);

    expect(restarted.mode).toBe("playing");
    if (restarted.mode !== "playing") {
      return;
    }
    expect(restarted.characterIds).toEqual(dirtySession.characterIds);
    expect(restarted.revision).toBe(dirtySession.revision + 1);
    expect(restarted.game).not.toBe(dirtyGame);
    expect(restarted.game.players).not.toBe(dirtyGame.players);
    expect(restarted.game.cardInstances).not.toBe(dirtyGame.cardInstances);
    expect(restarted.game).toEqual(expectedFreshGame);
    expect(dirtyGame).toEqual(oldSnapshot);
    expect(restarted.error).toBeNull();
  });

  it.each([
    {
      label: "mirrored teachers",
      characterIds: ["laboratory_teacher", "laboratory_teacher"] satisfies CharacterSelection,
      expectedPhase: "preparationSelection",
      expectedHands: [20, 20],
      expectedHp: [10, 10],
    },
    {
      label: "teacher and CEO",
      characterIds: ["laboratory_teacher", "chemical_factory_ceo"] satisfies CharacterSelection,
      expectedPhase: "preparationSelection",
      expectedHands: [20, 14],
      expectedHp: [10, 10],
    },
    {
      label: "CEO and chemistry enthusiast",
      characterIds: ["chemical_factory_ceo", "chemistry_enthusiast"] satisfies CharacterSelection,
      expectedPhase: "mainAction",
      expectedHands: [14, 10],
      expectedHp: [10, 8],
    },
  ])("restores the $label initialization boundary", ({
    characterIds,
    expectedPhase,
    expectedHands,
    expectedHp,
  }) => {
    const started = configureAndStart(characterIds);
    const restarted = restartCurrentLineup(started);

    expect(restarted.mode).toBe("playing");
    if (restarted.mode !== "playing") {
      return;
    }
    expect(restarted.game.phase).toBe(expectedPhase);
    expect(restarted.game.players.map((player) => player.hand.length)).toEqual(expectedHands);
    expect(restarted.game.players.map((player) => player.hp)).toEqual(expectedHp);
    expect(restarted.game.players.every((player) => (
      player.statuses.length === 0 &&
      !player.usedDIYThisCycle &&
      Object.keys(player.characterUsage.perCycle).length === 0 &&
      Object.keys(player.characterUsage.perRound).length === 0
    ))).toBe(true);
  });

  it("restarts safely from gameOver without mutating the finished game", () => {
    const started = configureAndStart([
      "acid_king",
      "sulfuric_acid_factory_director",
    ]);
    const finishedGame: GameState = {
      ...started.game,
      phase: "gameOver",
      players: started.game.players.map((player, index) => index === 1
        ? { ...player, hp: 0, eliminated: true }
        : player),
      winnerPlayerId: "player_1",
      log: [...started.game.log, { id: "finished", message: "旧对局结束" }],
    };
    const finishedSession: PlayingLocalGameSession = {
      ...started,
      game: finishedGame,
    };
    const oldSnapshot = structuredClone(finishedGame);
    const restarted = restartCurrentLineup(finishedSession);

    expect(restarted.game).not.toBe(finishedGame);
    expect(restarted.game.phase).toBe("mainAction");
    expect(restarted.game.winnerPlayerId).toBeUndefined();
    expect(restarted.game.players.every((player) => !player.eliminated)).toBe(true);
    expect(finishedGame).toEqual(oldSnapshot);
  });
});

describe("Phase 9 return to character selection", () => {
  it("discards the active game, preserves the lineup, and waits for another explicit start", () => {
    const started = configureAndStart([
      "acid_king",
      "sulfuric_acid_factory_director",
    ]);
    const oldGame = started.game;
    const configuring = localGameSessionReducer(
      started,
      { type: "RETURN_TO_CHARACTER_SELECTION" },
    );

    expect(configuring).toMatchObject({
      mode: "configuring",
      characterIds: started.characterIds,
      revision: started.revision + 1,
      error: null,
    });
    expect("game" in configuring).toBe(false);

    const repeatedReturn = localGameSessionReducer(configuring, {
      type: "RETURN_TO_CHARACTER_SELECTION",
    });
    expect(repeatedReturn).toBe(configuring);

    const ignoredOldAction = localGameSessionReducer(configuring, {
      type: "DISPATCH_GAME_ACTION",
      action: { type: "PASS_ACTION", playerId: "player_1" },
    });
    expect(ignoredOldAction).toBe(configuring);

    const changed = localGameSessionReducer(configuring, {
      type: "SELECT_CHARACTER",
      playerIndex: 1,
      characterId: "chemistry_enthusiast",
    });
    expect(changed.mode).toBe("configuring");
    expect("game" in changed).toBe(false);

    if (changed.mode !== "configuring") {
      throw new Error("Expected a configuring local game session.");
    }
    const restartedGame = deterministicGameFactory(changed.characterIds);
    const restarted = localGameSessionReducer(changed, {
      type: "APPLY_STARTED_LOCAL_GAME",
      expectedRevision: changed.revision,
      characterIds: changed.characterIds,
      game: restartedGame,
    });
    expect(restarted.mode).toBe("playing");
    if (restarted.mode !== "playing") {
      return;
    }
    expect(restarted.game).not.toBe(oldGame);
    expect(restarted.game.players.map((player) => player.characterId)).toEqual([
      "acid_king",
      "chemistry_enthusiast",
    ] satisfies CharacterId[]);
    expect(restarted.game.players.map((player) => player.hp)).toEqual([10, 8]);
  });
});

describe("Phase 11 fatal local session boundary", () => {
  it("enters a strict fatal union when the engine reducer throws and removes GameState", () => {
    const started = configureAndStart([
      "acid_king",
      "chemical_factory_ceo",
    ]);
    const rawMessage = "SECRET_HAND_AND_STACK";
    const fatal = localGameSessionReducer(
      started,
      {
        type: "DISPATCH_GAME_ACTION",
        action: { type: "PASS_ACTION", playerId: started.game.activePlayerId },
      },
      () => {
        throw new Error(rawMessage);
      },
    );

    expect(fatal.mode).toBe("fatal");
    expect("game" in fatal).toBe(false);
    expect(JSON.stringify(fatal)).not.toContain(rawMessage);
    if (fatal.mode !== "fatal") {
      throw new Error("Expected a fatal local game session.");
    }
    expect(fatal).toMatchObject({
      characterIds: started.characterIds,
      revision: started.revision + 1,
      error: { code: "GAME_ACTION_FAILED" },
    });
    expect(formatFatalDiagnostics(fatal.error)).toContain("错误码：GAME_ACTION_FAILED");
    expect(formatFatalDiagnostics(fatal.error)).not.toContain(rawMessage);
  });

  it("atomically rejects old actions after fatal", () => {
    const started = configureAndStart(defaultCharacterSelection);
    const fatal = createFatalLocalGameSession(
      started.characterIds,
      started.revision,
      "GAME_ACTION_FAILED",
    );

    const oldGameAction = localGameSessionReducer(fatal, {
      type: "DISPATCH_GAME_ACTION",
      action: { type: "PASS_ACTION", playerId: "player_1" },
    });
    const oldRestartResult = localGameSessionReducer(fatal, {
      type: "APPLY_RESTARTED_LOCAL_GAME",
      expectedRevision: started.revision,
      characterIds: started.characterIds,
      game: started.game,
    });
    const selectionAction = localGameSessionReducer(fatal, {
      type: "SELECT_CHARACTER",
      playerIndex: 0,
      characterId: "acid_king",
    });

    expect(oldGameAction).toBe(fatal);
    expect(oldRestartResult).toBe(fatal);
    expect(selectionAction).toBe(fatal);
  });

  it("recovers only by applying a newly created matching GameState", () => {
    const started = configureAndStart([
      "chemistry_enthusiast",
      "sulfuric_acid_factory_director",
    ]);
    const fatal = createFatalLocalGameSession(
      started.characterIds,
      started.revision,
      "GAME_RESTART_FAILED",
    );
    const recoveredGame = deterministicGameFactory(fatal.characterIds);
    const recovered = localGameSessionReducer(fatal, {
      type: "APPLY_RECOVERED_LOCAL_GAME",
      expectedRevision: fatal.revision,
      characterIds: fatal.characterIds,
      game: recoveredGame,
    });

    expect(recovered.mode).toBe("playing");
    if (recovered.mode !== "playing") {
      throw new Error("Expected recovery to create a playing session.");
    }
    expect(recovered.game).toBe(recoveredGame);
    expect(recovered.game).not.toBe(started.game);
    expect(recovered.revision).toBe(fatal.revision + 1);
  });

  it("returns from fatal to configuration without retaining GameState", () => {
    const fatal = createFatalLocalGameSession(
      defaultCharacterSelection,
      12,
      "GAME_RECOVERY_FAILED",
    );
    const configuring = localGameSessionReducer(fatal, {
      type: "RETURN_TO_CHARACTER_SELECTION",
    });

    expect(configuring).toMatchObject({
      mode: "configuring",
      characterIds: defaultCharacterSelection,
      revision: fatal.revision + 1,
      error: null,
    });
    expect("game" in configuring).toBe(false);
  });
});
