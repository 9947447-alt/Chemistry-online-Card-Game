import { starterDeck } from "../data/starterDeck";
import { getCharacterDefinition } from "../data/characterDefinitions";
import { fisherYatesShuffle } from "../../shared/random";
import type { CardInstance, CharacterId, GameState, Player } from "./types";
import { createEmptyCharacterUsage } from "./characterUsage";
import { beginActionForPlayer, dealCycleStartHands } from "./turnFlow";
import { createLogPresentationContext } from "./logEvents";

export type CreateInitialGameOptions = {
  gameId?: string;
  playerNames?: [string, string];
  characterIds?: [CharacterId, CharacterId];
  shuffle?: <T>(items: readonly T[]) => T[];
};

const defaultPlayerNames: [string, string] = ["玩家 A", "玩家 B"];
const defaultCharacterIds: [CharacterId, CharacterId] = [
  "laboratory_teacher",
  "chemical_factory_ceo",
];

export function createInitialGame(options: CreateInitialGameOptions = {}): GameState {
  const playerNames = options.playerNames ?? defaultPlayerNames;
  const characterIdsInput: readonly unknown[] = options.characterIds ?? defaultCharacterIds;

  if (characterIdsInput.length !== 2) {
    throw new Error("Character configuration must contain exactly 2 characterIds.");
  }

  const selectedCharacters = characterIdsInput.map((characterId) => {
    if (typeof characterId !== "string") {
      throw new Error(`Unknown character definition: ${String(characterId)}`);
    }

    return getCharacterDefinition(characterId as CharacterId);
  });
  const characterIds: [CharacterId, CharacterId] = [
    selectedCharacters[0].id,
    selectedCharacters[1].id,
  ];
  const shuffle = options.shuffle ?? fisherYatesShuffle;
  const cardInstances: Record<string, CardInstance> = {};
  const unshuffledDeck: string[] = [];

  for (const entry of starterDeck) {
    for (let copyIndex = 1; copyIndex <= entry.count; copyIndex += 1) {
      const id = `${entry.definitionId}_${String(copyIndex).padStart(2, "0")}`;
      cardInstances[id] = {
        id,
        definitionId: entry.definitionId,
        zone: { type: "deck" },
      };
      unshuffledDeck.push(id);
    }
  }

  const players: Player[] = playerNames.map((name, index) => {
    const characterId = characterIds[index];
    const character = selectedCharacters[index];

    return {
      id: `player_${index + 1}`,
      name,
      characterId,
      hp: character.maxHp,
      maxHp: character.maxHp,
      hand: [],
      statuses: [],
      eliminated: false,
      usedDIYThisCycle: false,
      characterUsage: createEmptyCharacterUsage(),
    };
  });

  const logPresentationContext = createLogPresentationContext(options.playerNames);

  let state: GameState = {
    id: options.gameId ?? "mvp0_game",
    phase: "cycleStart",
    players,
    activePlayerId: players[0].id,
    startingPlayerId: players[0].id,
    cycleNumber: 1,
    roundInCycle: 1,
    cardInstances,
    deck: shuffle(unshuffledDeck),
    discardPile: [],
    effectQueue: [],
    log: [{ id: "log_001", eventKey: "game_start", params: { cycleNumber: 1 } }],
    logPresentationContext,
    settings: {
      playersPerGame: 2,
      handSize: 10,
      roundsPerCycle: 3,
    },
  };

  state = dealCycleStartHands(state, shuffle);

  if (state.phase !== "cycleStart") {
    return state;
  }

  return beginActionForPlayer(state, state.startingPlayerId);
}
