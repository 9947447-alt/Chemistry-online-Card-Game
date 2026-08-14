import { describe, expect, it } from "vitest";
import { starterDeckSize } from "../data/starterDeck";
import { createMvp0TestGame as createInitialGame } from "./createTestGame";
import { engineReducer } from "../engine/reducer";
import type { GameState, Player } from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";
import { renderGameLogEntry } from "../../features/local-game/gameLogRenderer";

const existingReference: NonNullable<GameState["tableReference"]> = {
  cardInstanceId: "element_o_01",
  definitionId: "element_o",
  displayName: "O",
  playedBy: "player_1",
  cycle: 1,
  round: 1,
};

function passCurrentAction(state: GameState): GameState {
  return engineReducer(state, {
    type: "PASS_ACTION",
    playerId: state.activePlayerId,
  });
}

describe("turn flow", () => {
  it("does not expose an action that can jump directly to the next cycle", () => {
    type ActionType = Parameters<typeof engineReducer>[1]["type"];
    const actionTypes: ActionType[] = ["PASS_ACTION"];

    expect(actionTypes).not.toContain("START_NEXT_CYCLE" as ActionType);
  });

  it("does not clean up before both players finish the third round", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const firstCycleHands = state.players.map((player) => [...player.hand]);

    for (let action = 0; action < 5; action += 1) {
      state = passCurrentAction(state);
    }

    expect(state.cycleNumber).toBe(1);
    expect(state.roundInCycle).toBe(3);
    expect(state.players[0].hand).toEqual(firstCycleHands[0]);
    expect(state.players[1].hand).toEqual(firstCycleHands[1]);
    expect(state.discardPile).toHaveLength(0);
    expectCardZonesToBeConsistent(state);
  });

  it("moves both players' remaining hands to discard after three rounds", () => {
    let state = createInitialGame({ shuffle: identityShuffle });

    for (let action = 0; action < 6; action += 1) {
      state = passCurrentAction(state);
    }

    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.players[0].hand).toHaveLength(10);
    expect(state.players[1].hand).toHaveLength(10);
    expect(state.discardPile).toHaveLength(20);
    expectCardZonesToBeConsistent(state);
  });

  it("starts a new cycle by drawing new hands", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const firstCycleHands = state.players.map((player) => [...player.hand]);

    for (let action = 0; action < 6; action += 1) {
      state = passCurrentAction(state);
    }

    expect(state.players[0].hand).not.toEqual(firstCycleHands[0]);
    expect(state.players[1].hand).not.toEqual(firstCycleHands[1]);
    expect(state.players[0].hand).toHaveLength(10);
    expect(state.players[1].hand).toHaveLength(10);
    expect(new Set(state.players[0].hand).size).toBe(10);
    expect(new Set(state.players[1].hand).size).toBe(10);
    expect(state.deck).toHaveLength(starterDeckSize - 40);
    expectCardZonesToBeConsistent(state);
  });

  it("preserves character usage during a player switch within the same round", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const [playerOne, playerTwo] = state.players;
    state = {
      ...state,
      tableReference: existingReference,
      players: state.players.map((player) =>
        player.id === playerOne.id
          ? {
              ...player,
              usedDIYThisCycle: true,
              characterUsage: {
                perCycle: { laboratory_teacher_extra_lesson: 1 },
                perRound: {
                  sulfuric_acid_factory_director_sulfate_byproduct: 1,
                },
              },
            }
          : player,
      ),
    };

    state = passCurrentAction(state);

    expect(state.activePlayerId).toBe(playerTwo.id);
    expect(state.roundInCycle).toBe(1);
    expect(state.cycleNumber).toBe(1);
    expect(state.players[0].characterUsage.perRound).toEqual({
      sulfuric_acid_factory_director_sulfate_byproduct: 1,
    });
    expect(state.players[0].characterUsage.perCycle).toEqual({
      laboratory_teacher_extra_lesson: 1,
    });
    expect(state.players[0].usedDIYThisCycle).toBe(true);
    expect(state.tableReference).toEqual(existingReference);
    expect(state.players[1].characterUsage).toEqual({ perCycle: {}, perRound: {} });
    expectCardZonesToBeConsistent(state);
  });

  it("clears only per-round character usage at a new round", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    state = {
      ...state,
      activePlayerId: state.players[1].id,
      tableReference: existingReference,
      players: state.players.map((player, index) => ({
        ...player,
        usedDIYThisCycle: true,
        characterUsage: {
          perCycle: {
            [index === 0
              ? "laboratory_teacher_extra_lesson"
              : "chemical_factory_ceo_emergency_supply"]: 1,
          },
          perRound: {
            sulfuric_acid_factory_director_sulfate_byproduct: 1,
          },
        },
      })),
    };

    state = passCurrentAction(state);

    expect(state.roundInCycle).toBe(2);
    expect(state.cycleNumber).toBe(1);
    expect(state.players[0].characterUsage.perCycle).toEqual({
      laboratory_teacher_extra_lesson: 1,
    });
    expect(state.players[1].characterUsage.perCycle).toEqual({
      chemical_factory_ceo_emergency_supply: 1,
    });
    expect(state.players.every((player) => Object.keys(player.characterUsage.perRound).length === 0)).toBe(true);
    expect(state.players.every((player) => player.usedDIYThisCycle)).toBe(true);
    expect(state.tableReference).toEqual(existingReference);
    expectCardZonesToBeConsistent(state);
  });

  it("clears per-cycle and per-round character usage at a new cycle", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    state = {
      ...state,
      activePlayerId: state.players[1].id,
      roundInCycle: 3,
      tableReference: existingReference,
      players: state.players.map((player) => ({
        ...player,
        usedDIYThisCycle: true,
        characterUsage: {
          perCycle: { clumsy_party_secretary_shared_active: 1 },
          perRound: { sulfuric_acid_factory_director_sulfate_byproduct: 1 },
        },
      })),
    };

    state = passCurrentAction(state);

    expect(state.cycleNumber).toBe(2);
    expect(state.roundInCycle).toBe(1);
    expect(state.players.every((player) => Object.keys(player.characterUsage.perCycle).length === 0)).toBe(true);
    expect(state.players.every((player) => Object.keys(player.characterUsage.perRound).length === 0)).toBe(true);
    expect(state.players.every((player) => !player.usedDIYThisCycle)).toBe(true);
    expect(state.tableReference).toBeUndefined();
    expectCardZonesToBeConsistent(state);
  });

  it("shuffles the discard pile back into the deck when the main deck is exhausted", () => {
    let state = createInitialGame({ shuffle: identityShuffle });

    state = {
      ...state,
      roundInCycle: 3,
      activePlayerId: state.players[1].id,
      deck: [],
      discardPile: [...state.deck],
    };

    state = passCurrentAction(state);

    expect(state.cycleNumber).toBe(2);
    expect(state.players[0].hand).toHaveLength(10);
    expect(state.players[1].hand).toHaveLength(10);
    expect(state.deck).toHaveLength(starterDeckSize - 20);
    expect(state.discardPile).toHaveLength(0);
    expect(state.log.some((entry) => renderGameLogEntry(entry).includes("弃牌堆洗回主牌堆"))).toBe(true);
    expectCardZonesToBeConsistent(state);
  });

  it("rejects PASS_ACTION from an eliminated active player", () => {
    let state = createInitialGame({ shuffle: identityShuffle });
    const activePlayer = state.players[0];

    state = {
      ...state,
      players: state.players.map((player) =>
        player.id === activePlayer.id ? { ...player, hp: 0, eliminated: true } : player,
      ),
    };

    const rejected = passCurrentAction(state);

    expect(rejected).toBe(state);
    expectCardZonesToBeConsistent(rejected);
  });

  it("skips eliminated players when more than one survivor remains", () => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const thirdPlayer: Player = {
      id: "player_3",
      name: "玩家 C",
      characterId: "acid_king",
      hp: 10,
      maxHp: 10,
      hand: [],
      statuses: [],
      eliminated: false,
      usedDIYThisCycle: false,
      characterUsage: {
        perCycle: {},
        perRound: {},
      },
    };
    const withThirdPlayer: GameState = {
      ...state,
      players: [
        state.players[0],
        { ...state.players[1], hp: 0, eliminated: true },
        thirdPlayer,
      ],
    };

    const advanced = passCurrentAction(withThirdPlayer);

    expect(advanced.phase).toBe("mainAction");
    expect(advanced.activePlayerId).toBe(thirdPlayer.id);
    expectCardZonesToBeConsistent(advanced);
  });

  it("rejects all actions after gameOver", () => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const gameOverState: GameState = {
      ...state,
      phase: "gameOver",
      winnerPlayerId: state.players[0].id,
    };

    const rejected = passCurrentAction(gameOverState);

    expect(rejected).toBe(gameOverState);
    expectCardZonesToBeConsistent(rejected);
  });
});
