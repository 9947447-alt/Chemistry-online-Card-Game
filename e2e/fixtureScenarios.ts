import { createInitialGame } from "../src/game/engine/createInitialGame";
import { engineReducer } from "../src/game/engine/reducer";
import type {
  CardInstanceId,
  GameState,
  PlayerId,
} from "../src/game/engine/types";
import {
  createFatalLocalGameSession,
  defaultCharacterSelection,
  isCharacterSelection,
  type LocalGameFactory,
  type LocalGameSessionInitializer,
  type PlayingLocalGameSession,
} from "../src/features/local-game/localGameSession";
import { identityShuffle } from "../src/shared/random";

let fixtureFactoryInvocationCount = 0;
const factoryCountListeners = new Set<() => void>();

export function getFixtureFactoryInvocationCount(): number {
  return fixtureFactoryInvocationCount;
}

export function subscribeToFixtureFactoryCount(listener: () => void): () => void {
  factoryCountListeners.add(listener);
  return () => factoryCountListeners.delete(listener);
}

export const deterministicFixtureFactory: LocalGameFactory = (characterIds) => {
  fixtureFactoryInvocationCount += 1;
  for (const listener of factoryCountListeners) {
    listener();
  }
  return createInitialGame({
    characterIds: [characterIds[0], characterIds[1]],
    shuffle: identityShuffle,
  });
};

function requirePlayingSession(game: GameState): PlayingLocalGameSession {
  const characterIds = game.players.map((player) => player.characterId);
  if (!isCharacterSelection(characterIds)) {
    throw new Error("E2E fixture requires exactly two formal characters.");
  }

  return {
    mode: "playing",
    characterIds: [characterIds[0], characterIds[1]],
    playerControllers: ["human", "human"],
    revision: 1,
    game,
    error: null,
  };
}

function putCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState {
  const card = state.cardInstances[cardInstanceId];
  if (!card) {
    throw new Error(`Missing formal fixture card ${cardInstanceId}.`);
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

function createCardReaction(
  responseCardId: CardInstanceId,
): GameState {
  let state = deterministicFixtureFactory([
    "clumsy_party_secretary",
    "caustic_soda_captain",
  ]);
  state = putCardInHand(state, "player_1", "substance_hcl_dilute_01");
  state = putCardInHand(state, "player_2", responseCardId);
  state = engineReducer(state, {
    type: "PLAY_CARD",
    playerId: "player_1",
    cardInstanceId: "substance_hcl_dilute_01",
    targetPlayerId: "player_2",
  });
  return engineReducer(state, {
    type: "RESPOND_WITH_CARD",
    playerId: "player_2",
    cardInstanceId: responseCardId,
  });
}

function reducePlayerToOneThroughFormalAttacks(state: GameState): GameState {
  const attackCardIds: CardInstanceId[] = [
    "substance_naoh_dilute_01",
    "substance_koh_dilute_01",
    "substance_caoh2_limewater_01",
    "substance_naoh_dilute_02",
    "substance_hcl_dilute_01",
  ];

  let nextState = state;
  for (const cardInstanceId of attackCardIds) {
    nextState = putCardInHand(nextState, "player_2", cardInstanceId);
    nextState = engineReducer(nextState, {
      type: "PASS_ACTION",
      playerId: nextState.activePlayerId,
    });
    nextState = engineReducer(nextState, {
      type: "PLAY_CARD",
      playerId: "player_2",
      cardInstanceId,
      targetPlayerId: "player_1",
    });
    nextState = engineReducer(nextState, {
      type: "PASS_RESPONSE",
      playerId: "player_1",
    });
  }

  const target = nextState.players.find((player) => player.id === "player_1");
  if (target?.hp !== 1) {
    throw new Error(`Formal game-over fixture expected player_1 HP 1, received ${target?.hp}.`);
  }
  return nextState;
}

function createImmediateSo2Reaction(gameOver: boolean): GameState {
  let state = deterministicFixtureFactory([
    "clumsy_party_secretary",
    "caustic_soda_captain",
  ]);
  if (gameOver) {
    state = reducePlayerToOneThroughFormalAttacks(state);
  }
  state = putCardInHand(state, "player_2", "ion_oh_01");
  state = engineReducer(state, {
    type: "ACTIVATE_CHARACTER_SKILL",
    playerId: "player_1",
    skillId: "exhaust_leak",
  });
  return engineReducer(state, {
    type: "RESPOND_WITH_CARD",
    playerId: "player_2",
    cardInstanceId: "ion_oh_01",
  });
}

function createStatusSo2Reaction(): GameState {
  let state = deterministicFixtureFactory(defaultCharacterSelection);
  state = putCardInHand(state, "player_1", "substance_naoh_dilute_01");
  state = {
    ...state,
    activePlayerId: "player_1",
    phase: "statusWindow",
    pendingLaboratoryPreparation: undefined,
    pendingStatusHandling: {
      playerId: "player_1",
      statusInstanceId: "status_phase11_fixture_so2",
    },
    players: state.players.map((player) => player.id === "player_1"
      ? {
          ...player,
          statuses: [
            ...player.statuses,
            {
              id: "status_phase11_fixture_so2",
              statusId: "SO2_LEAK",
              createdAt: state.log.length + 1,
            },
          ],
        }
      : player),
  };
  return engineReducer(state, {
    type: "HANDLE_STATUS_WITH_CARD",
    playerId: "player_1",
    statusInstanceId: "status_phase11_fixture_so2",
    cardInstanceId: "substance_naoh_dilute_01",
  });
}

function createResponseWindow(): GameState {
  let state = deterministicFixtureFactory([
    "clumsy_party_secretary",
    "caustic_soda_captain",
  ]);
  state = putCardInHand(state, "player_1", "substance_hcl_dilute_01");
  state = putCardInHand(state, "player_2", "substance_naoh_dilute_01");
  return engineReducer(state, {
    type: "PLAY_CARD",
    playerId: "player_1",
    cardInstanceId: "substance_hcl_dilute_01",
    targetPlayerId: "player_2",
  });
}

function createStatusWindow(): GameState {
  let state = deterministicFixtureFactory(defaultCharacterSelection);
  state = putCardInHand(state, "player_1", "substance_naoh_dilute_01");
  return {
    ...state,
    activePlayerId: "player_1",
    phase: "statusWindow",
    pendingLaboratoryPreparation: undefined,
    pendingStatusHandling: {
      playerId: "player_1",
      statusInstanceId: "status_phase13_fixture_so2",
    },
    players: state.players.map((player) => player.id === "player_1"
      ? {
          ...player,
          statuses: [
            ...player.statuses,
            {
              id: "status_phase13_fixture_so2",
              statusId: "SO2_LEAK",
              createdAt: state.log.length + 1,
            },
          ],
        }
      : player),
  };
}

function createExperimentCounterattackWindow(): GameState {
  let state = deterministicFixtureFactory([
    "clumsy_party_secretary",
    "chemistry_enthusiast",
  ]);
  state = putCardInHand(state, "player_1", "substance_hcl_dilute_01");
  state = putCardInHand(state, "player_2", "substance_naoh_dilute_01");
  const initialResponder = state.players.find((player) => player.id === "player_2");
  if (initialResponder?.hp !== 8) {
    throw new Error(`Formal experiment fixture expected player_2 HP 8 before damage, received ${initialResponder?.hp}.`);
  }
  state = engineReducer(state, {
    type: "PLAY_CARD",
    playerId: "player_1",
    cardInstanceId: "substance_hcl_dilute_01",
    targetPlayerId: "player_2",
  });
  state = engineReducer(state, {
    type: "PASS_RESPONSE",
    playerId: "player_2",
  });
  const damagedResponder = state.players.find((player) => player.id === "player_2");
  if (damagedResponder?.hp !== 7) {
    throw new Error(`Formal experiment fixture expected player_2 HP 7 after damage, received ${damagedResponder?.hp}.`);
  }
  state = engineReducer(state, {
    type: "PASS_ACTION",
    playerId: state.activePlayerId,
  });
  state = putCardInHand(state, "player_1", "substance_hcl_dilute_02");
  state = putCardInHand(state, "player_2", "substance_naoh_dilute_02");
  state = engineReducer(state, {
    type: "PLAY_CARD",
    playerId: "player_1",
    cardInstanceId: "substance_hcl_dilute_02",
    targetPlayerId: "player_2",
  });
  state = engineReducer(state, {
    type: "RESPOND_WITH_CARD",
    playerId: "player_2",
    cardInstanceId: "substance_naoh_dilute_02",
  });
  if (!state.pendingExperimentCounterattack?.legalOptions.includes("recover")) {
    throw new Error("Formal experiment fixture expected recover in legalOptions.");
  }
  return state;
}

function createLongLogGame(): GameState {
  let state = deterministicFixtureFactory([
    "chemical_factory_ceo",
    "acid_king",
  ]);

  for (let index = 0; index < 96; index += 1) {
    state = engineReducer(state, {
      type: "PASS_ACTION",
      playerId: state.activePlayerId,
    });
  }

  return state;
}

function playingInitializer(game: GameState): LocalGameSessionInitializer {
  return () => requirePlayingSession(game);
}

export type FixtureScenario =
  | "default"
  | "fatal"
  | "game-over"
  | "long-log"
  | "reaction-h2o"
  | "reaction-co2"
  | "reaction-so2-immediate"
  | "reaction-so2-status"
  | "response-window"
  | "status-window"
  | "experiment-counterattack-window";

export function getFixtureInitializer(
  scenario: FixtureScenario,
): LocalGameSessionInitializer | undefined {
  switch (scenario) {
    case "default":
      return undefined;
    case "fatal":
      return () => createFatalLocalGameSession(
        defaultCharacterSelection,
        0,
        "GAME_ACTION_FAILED",
      );
    case "game-over":
      return playingInitializer(createImmediateSo2Reaction(true));
    case "long-log":
      return playingInitializer(createLongLogGame());
    case "reaction-h2o":
      return playingInitializer(createCardReaction("substance_naoh_dilute_01"));
    case "reaction-co2":
      return playingInitializer(createCardReaction("ion_co3_01"));
    case "reaction-so2-immediate":
      return playingInitializer(createImmediateSo2Reaction(false));
    case "reaction-so2-status":
      return playingInitializer(createStatusSo2Reaction());
    case "response-window":
      return playingInitializer(createResponseWindow());
    case "status-window":
      return playingInitializer(createStatusWindow());
    case "experiment-counterattack-window":
      return playingInitializer(createExperimentCounterattackWindow());
  }
}

export function isFixtureScenario(value: string | null): value is FixtureScenario {
  return value !== null && [
    "default",
    "fatal",
    "game-over",
    "long-log",
    "reaction-h2o",
    "reaction-co2",
    "reaction-so2-immediate",
    "reaction-so2-status",
    "response-window",
    "status-window",
    "experiment-counterattack-window",
  ].includes(value);
}

export function readFixtureScenario(): FixtureScenario {
  const requested = new URLSearchParams(window.location.search).get("scenario");
  if (requested === null || !isFixtureScenario(requested)) {
    return "default";
  }
  return requested;
}
