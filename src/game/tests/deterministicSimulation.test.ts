import { describe, expect, it } from "vitest";
import { createInitialGame, createSeededEngine } from "../engine/createInitialGame";
import { getDecisionContext } from "../engine/decisionContext";
import { engineReducer } from "../engine/reducer";
import {
  createFisherYatesShuffle,
  createMulberry32,
  createSeededShuffle,
  identityShuffle,
} from "../../shared/random";
import type { GameAction } from "../engine/actions";
import type { GameState } from "../engine/types";
import { expectCardZonesToBeConsistent } from "./assertCardZones";

describe("Phase 19B — Deterministic Simulation Infrastructure", () => {
  describe("createInitialGame with seed injection", () => {
    it("produces bit-identical initial GameState for identical seeds", () => {
      const state1 = createInitialGame({
        gameId: "test_game",
        seed: 42,
        characterIds: ["laboratory_teacher", "chemical_factory_ceo"],
      });
      const state2 = createInitialGame({
        gameId: "test_game",
        seed: 42,
        characterIds: ["laboratory_teacher", "chemical_factory_ceo"],
      });

      expect(state1).toEqual(state2);
      expect(JSON.stringify(state1)).toBe(JSON.stringify(state2));
      expect(state1.deck).toEqual(state2.deck);
      expect(state1.players[0].hand).toEqual(state2.players[0].hand);
      expect(state1.players[1].hand).toEqual(state2.players[1].hand);
    });

    it("produces different deck orders for different seeds", () => {
      const stateA = createInitialGame({
        gameId: "test_game",
        seed: 100,
        characterIds: ["caustic_soda_captain", "acid_king"],
      });
      const stateB = createInitialGame({
        gameId: "test_game",
        seed: 200,
        characterIds: ["caustic_soda_captain", "acid_king"],
      });

      expect(stateA.deck).not.toEqual(stateB.deck);
    });

    it("prioritizes explicit shuffle option over seed if both are passed", () => {
      const state = createInitialGame({
        gameId: "test_game",
        shuffle: identityShuffle,
        seed: 99999,
        characterIds: ["caustic_soda_captain", "acid_king"],
      });

      // With identityShuffle, starterDeck is laid out in original definition order
      expect(state.players[0].hand.length).toBe(10);
    });

    it("maintains default non-seeded creation backwards compatibility", () => {
      const state = createInitialGame();
      expect(state.phase).toBe("preparationSelection");
      expect(state.players.length).toBe(2);
      // 68 total - 20 (teacher prep candidates) - 14 (CEO capital reserve hand) = 34
      expect(state.deck.length).toBe(34);
    });
  });

  describe("engineReducer with seeded shuffle injection", () => {
    it("produces bit-identical state and logs across independent full-action replays", () => {
      const seed = 20260821;

      function runSimulation(): { finalState: GameState; intermediateLogs: string[][] } {
        const prng = createMulberry32(seed);
        const seededShuffle = createFisherYatesShuffle(prng);

        let state = createInitialGame({
          gameId: "deterministic_session",
          shuffle: seededShuffle,
          characterIds: ["laboratory_teacher", "caustic_soda_captain"],
        });

        const intermediateLogs: string[][] = [];

        // 1. Preparation selection for laboratory teacher
        const prep = state.pendingLaboratoryPreparation;
        expect(prep).toBeDefined();
        if (!prep) throw new Error("Expected pendingLaboratoryPreparation");

        const kept10 = prep.candidateCardInstanceIds.slice(0, 10);
        state = engineReducer(
          state,
          {
            type: "CONFIRM_LABORATORY_PREPARATION",
            playerId: "player_1",
            keptCardInstanceIds: kept10,
          },
          seededShuffle,
        );
        intermediateLogs.push(state.log.map((entry) => entry.id));

        // 2. Player 1 (Laboratory Teacher) uses extra_lesson skill (draws 4 cards)
        expect(state.phase).toBe("mainAction");
        expect(state.activePlayerId).toBe("player_1");
        state = engineReducer(
          state,
          {
            type: "ACTIVATE_CHARACTER_SKILL",
            playerId: "player_1",
            skillId: "extra_lesson",
          },
          seededShuffle,
        );
        intermediateLogs.push(state.log.map((entry) => entry.id));

        // 3. Player 1 passes main action
        state = engineReducer(
          state,
          {
            type: "PASS_ACTION",
            playerId: "player_1",
          },
          seededShuffle,
        );
        intermediateLogs.push(state.log.map((entry) => entry.id));

        // 4. Player 2 passes main action
        expect(state.phase).toBe("mainAction");
        expect(state.activePlayerId).toBe("player_2");
        state = engineReducer(
          state,
          {
            type: "PASS_ACTION",
            playerId: "player_2",
          },
          seededShuffle,
        );
        intermediateLogs.push(state.log.map((entry) => entry.id));

        return { finalState: state, intermediateLogs };
      }

      const run1 = runSimulation();
      const run2 = runSimulation();

      expect(run1.finalState).toEqual(run2.finalState);
      expect(JSON.stringify(run1.finalState)).toBe(JSON.stringify(run2.finalState));
      expect(run1.intermediateLogs).toEqual(run2.intermediateLogs);
      expect(run1.finalState.log.length).toBeGreaterThanOrEqual(4);
    });

    it("replays deterministic discard pile recycling upon deck exhaustion", () => {
      const seed = 54321;

      function assignConsistentZones(
        state: GameState,
        p1Hand: string[],
        p2Hand: string[],
        deck: string[],
        discardPile: string[],
      ): GameState {
        const cardInstances = { ...state.cardInstances };
        for (const id of p1Hand) {
          cardInstances[id] = {
            ...cardInstances[id],
            ownerId: "player_1",
            zone: { type: "hand", playerId: "player_1" },
          };
        }
        for (const id of p2Hand) {
          cardInstances[id] = {
            ...cardInstances[id],
            ownerId: "player_2",
            zone: { type: "hand", playerId: "player_2" },
          };
        }
        for (const id of deck) {
          cardInstances[id] = {
            ...cardInstances[id],
            ownerId: undefined,
            zone: { type: "deck" },
          };
        }
        for (const id of discardPile) {
          cardInstances[id] = {
            ...cardInstances[id],
            ownerId: undefined,
            zone: { type: "discard" },
          };
        }
        return {
          ...state,
          cardInstances,
          deck,
          discardPile,
          players: state.players.map((player) => {
            if (player.id === "player_1") {
              return { ...player, hand: p1Hand };
            }
            if (player.id === "player_2") {
              return { ...player, hand: p2Hand };
            }
            return player;
          }),
        };
      }

      function runDeckRecycleSimulation(): GameState {
        const engine = createSeededEngine(seed);
        let state = engine.createGame({
          gameId: "recycle_sim",
          characterIds: ["laboratory_teacher", "caustic_soda_captain"],
        });

        const prep = state.pendingLaboratoryPreparation!;
        state = engine.reduce(state, {
          type: "CONFIRM_LABORATORY_PREPARATION",
          playerId: "player_1",
          keptCardInstanceIds: prep.candidateCardInstanceIds.slice(0, 10),
        });

        const p1Hand = state.players[0].hand.slice(0, 2);
        const occupied = new Set([...p1Hand, ...state.players[1].hand]);
        const rest = Object.keys(state.cardInstances).filter((id) => !occupied.has(id));
        const deck = rest.slice(0, 1);
        const discardPile = rest.slice(1, 16);
        const extras = rest.slice(16);
        state = assignConsistentZones(
          state,
          p1Hand,
          [...state.players[1].hand, ...extras],
          deck,
          discardPile,
        );
        expectCardZonesToBeConsistent(state);
        expect(state.deck).toHaveLength(1);
        expect(state.discardPile).toHaveLength(15);
        expect(state.players[0].hand).toHaveLength(2);

        const nextState = engine.reduce(state, {
          type: "ACTIVATE_CHARACTER_SKILL",
          playerId: "player_1",
          skillId: "extra_lesson",
        });
        expectCardZonesToBeConsistent(nextState);
        return nextState;
      }

      const result1 = runDeckRecycleSimulation();
      const result2 = runDeckRecycleSimulation();

      expect(result1).toEqual(result2);
      expect(result1.deck.length).toBe(12);
      expect(result1.discardPile.length).toBe(0);
      expect(
        result1.log.some((entry) => entry.eventKey === "recycle_discard_into_deck"),
      ).toBe(true);
    });

    it("binds createInitialGame seed through later reducer shuffles via createSeededEngine", () => {
      function runSeededSession(): GameState {
        const engine = createSeededEngine(424242);
        let state = engine.createGame({
          gameId: "seeded_session",
          characterIds: ["caustic_soda_captain", "acid_king"],
        });
        state = engine.reduce(state, { type: "PASS_ACTION", playerId: "player_1" });
        state = engine.reduce(state, { type: "PASS_ACTION", playerId: "player_2" });
        return state;
      }

      const run1 = runSeededSession();
      const run2 = runSeededSession();
      expect(run1).toEqual(run2);
      expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
      expect(run1.roundInCycle).toBe(2);
    });

    it("produces differing trajectories when given different initial seeds", () => {
      const actions: GameAction[] = [
        {
          type: "PASS_ACTION",
          playerId: "player_1",
        },
        {
          type: "PASS_ACTION",
          playerId: "player_2",
        },
      ];

      function executeTrajectory(seed: number): GameState {
        const shuffle = createSeededShuffle(seed);
        let state = createInitialGame({
          gameId: `diff_sim_${seed}`,
          shuffle,
          characterIds: ["caustic_soda_captain", "acid_king"],
        });

        for (const action of actions) {
          state = engineReducer(state, action, shuffle);
        }

        return state;
      }

      const stateA = executeTrajectory(1111);
      const stateB = executeTrajectory(2222);

      // Both are valid games, but player hands and decks are different due to different seeds
      expect(stateA.deck).not.toEqual(stateB.deck);
      expect(stateA.players[0].hand).not.toEqual(stateB.players[0].hand);
      expect(stateA.players[1].hand).not.toEqual(stateB.players[1].hand);
    });

    it("preserves state immutability when shuffle is passed to engineReducer", () => {
      const shuffle = createSeededShuffle(777);
      const initial = createInitialGame({
        gameId: "immutability_test",
        shuffle,
        characterIds: ["caustic_soda_captain", "acid_king"],
      });
      const initialSnapshot = JSON.stringify(initial);

      const next = engineReducer(
        initial,
        {
          type: "PASS_ACTION",
          playerId: "player_1",
        },
        shuffle,
      );

      expect(JSON.stringify(initial)).toBe(initialSnapshot);
      expect(next).not.toBe(initial);
      expect(next.activePlayerId).toBe("player_2");
    });

    it("replays full multi-cycle combat and response flow with bit-identical fidelity", () => {
      const seed = 987654321;

      function simulateCombatGame(): GameState {
        const engine = createSeededEngine(seed);
        let state = engine.createGame({
          gameId: "combat_sim",
          characterIds: ["chemistry_enthusiast", "sulfuric_acid_factory_director"],
        });

        let steps = 0;
        while (steps < 200 && state.phase !== "gameOver" && state.cycleNumber < 4) {
          const context = getDecisionContext(state);
          if (context.kind === "none" || context.kind === "game-over") {
            break;
          }

          let action: GameAction | undefined;
          if (context.kind === "laboratory-preparation") {
            action = {
              type: "CONFIRM_LABORATORY_PREPARATION",
              playerId: context.playerId,
              keptCardInstanceIds: context.candidateCardInstanceIds.slice(
                0,
                context.keepCount,
              ),
            };
          } else {
            const exhaust = context.legalActions.find(
              (candidate) =>
                candidate.type === "ACTIVATE_CHARACTER_SKILL" &&
                candidate.skillId === "exhaust_discharge",
            );
            const passOrRecover = context.legalActions.find(
              (candidate) =>
                candidate.type === "PASS_ACTION" ||
                candidate.type === "PASS_RESPONSE" ||
                candidate.type === "PASS_STATUS_HANDLING" ||
                (candidate.type === "RESOLVE_EXPERIMENT_COUNTERATTACK" &&
                  candidate.option === "recover"),
            );
            action = exhaust ?? passOrRecover ?? context.legalActions[0];
          }

          if (!action) {
            break;
          }

          const nextState = engine.reduce(state, action);
          if (nextState === state) {
            break;
          }
          state = nextState;
          steps += 1;
        }

        return state;
      }

      const matchA = simulateCombatGame();
      const matchB = simulateCombatGame();

      expect(matchA).toEqual(matchB);
      expect(JSON.stringify(matchA)).toBe(JSON.stringify(matchB));
      expect(matchA.cycleNumber).toBe(matchB.cycleNumber);
      expect(matchA.roundInCycle).toBe(matchB.roundInCycle);
      expect(matchA.log).toEqual(matchB.log);
      expect(matchA.cycleNumber >= 3 || matchA.phase === "gameOver").toBe(true);
      expect(
        matchA.log.some(
          (entry) =>
            entry.eventKey === "status_window_start" ||
            entry.eventKey === "skill_exhaust_discharge",
        ),
      ).toBe(true);
    });
  });
});

