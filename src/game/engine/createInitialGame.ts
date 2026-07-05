import { starterDeck } from "../data/starterDeck";
import { fisherYatesShuffle } from "../../shared/random";
import type { CardInstance, GameState, Player } from "./types";
import { dealInitialHands } from "./turnFlow";

export type CreateInitialGameOptions = {
  gameId?: string;
  playerNames?: [string, string];
  shuffle?: <T>(items: readonly T[]) => T[];
};

const defaultPlayerNames: [string, string] = ["玩家 A", "玩家 B"];

export function createInitialGame(options: CreateInitialGameOptions = {}): GameState {
  const playerNames = options.playerNames ?? defaultPlayerNames;
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

  const players: Player[] = playerNames.map((name, index) => ({
    id: `player_${index + 1}`,
    name,
    hp: 10,
    maxHp: 10,
    hand: [],
    statuses: [],
    eliminated: false,
    usedDIYThisCycle: false,
  }));

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
    log: [{ id: "log_001", message: "游戏开始，进入第 1 实验周期。" }],
    settings: {
      playersPerGame: 2,
      handSize: 10,
      roundsPerCycle: 3,
    },
  };

  state = dealInitialHands(state, shuffle);

  return {
    ...state,
    phase: "mainAction",
  };
}
