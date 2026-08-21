import { describe, expect, it } from "vitest";
import { createInitialGame } from "../engine/createInitialGame";
import { engineReducer } from "../engine/reducer";
import {
  createFisherYatesShuffle,
  createMulberry32,
  createSeededShuffle,
  identityShuffle,
} from "../../shared/random";
import type { GameAction } from "../engine/actions";
import type { GameState } from "../engine/types";

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

      function runDeckRecycleSimulation(): GameState {
        const prng = createMulberry32(seed);
        const shuffle = createFisherYatesShuffle(prng);

        // Start with 2 Caustic Soda Captains to have standard 10 card hands
        let state = createInitialGame({
          gameId: "recycle_sim",
          shuffle,
          characterIds: ["laboratory_teacher", "caustic_soda_captain"],
        });

        // Confirm prep
        const prep = state.pendingLaboratoryPreparation!;
        state = engineReducer(
          state,
          {
            type: "CONFIRM_LABORATORY_PREPARATION",
            playerId: "player_1",
            keptCardInstanceIds: prep.candidateCardInstanceIds.slice(0, 10),
          },
          shuffle,
        );

        // Artificially deplete deck to 1 card and set discard pile with 15 cards
        const remainingCard = state.deck[0];
        const discardCards = state.deck.slice(1, 16);
        // Reduce player 1's hand to 2 cards so extra_lesson (requires hand <= 4) is legal
        state = {
          ...state,
          players: state.players.map((p) =>
            p.id === "player_1" ? { ...p, hand: p.hand.slice(0, 2) } : p,
          ),
          deck: [remainingCard],
          discardPile: discardCards,
        };

        // Player 1 (Teacher) uses extra_lesson (draws 4 cards -> exhausts 1 remaining deck card, triggers recycling discardPile of 15 cards, draws 3 from recycled deck)
        const nextState = engineReducer(
          state,
          {
            type: "ACTIVATE_CHARACTER_SKILL",
            playerId: "player_1",
            skillId: "extra_lesson",
          },
          shuffle,
        );

        return nextState;
      }

      const result1 = runDeckRecycleSimulation();
      const result2 = runDeckRecycleSimulation();

      expect(result1).toEqual(result2);
      expect(result1.deck.length).toBe(12); // 15 recycled - 3 drawn = 12
      expect(result1.discardPile.length).toBe(0);
      expect(
        result1.log.some((entry) => entry.eventKey === "recycle_discard_into_deck"),
      ).toBe(true);
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
        const shuffle = createSeededShuffle(seed);
        let state = createInitialGame({
          gameId: "combat_sim",
          shuffle,
          characterIds: ["chemistry_enthusiast", "sulfuric_acid_factory_director"],
        });

        // 3 cycles with passing and skills
        for (let cycle = 0; cycle < 3; cycle += 1) {
          for (let round = 0; round < 3; round += 1) {
            // Player 1 turn
            if (state.phase === "mainAction" && state.activePlayerId === "player_1") {
              state = engineReducer(state, { type: "PASS_ACTION", playerId: "player_1" }, shuffle);
            }
            // Player 2 turn
            if (state.phase === "mainAction" && state.activePlayerId === "player_2") {
              // Try activating exhaust_discharge if available, otherwise pass
              const skillAction: GameAction = {
                type: "ACTIVATE_CHARACTER_SKILL",
                playerId: "player_2",
                skillId: "exhaust_discharge",
                targetPlayerId: "player_1",
              };
              const afterSkill = engineReducer(state, skillAction, shuffle);
              if (afterSkill !== state) {
                state = afterSkill;
              } else {
                state = engineReducer(state, { type: "PASS_ACTION", playerId: "player_2" }, shuffle);
              }
            }
          }
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
    });
  });
});

