import { describe, expect, it } from "vitest";
import type { DecisionContext } from "../engine/decisionContext";
import {
  allDefaultCharacterIds,
  natba0RandomLegalPolicy,
  natba1HeuristicPolicy,
  runBatchSelfPlay,
  runSelfPlayGame,
  type NATBAPolicy,
} from "../natba";

describe("Phase 19C — NATBA-0 Self-Play & Deterministic Replay", () => {
  it("replays full AI vs AI game deterministically with bit-identical final states and logs", () => {
    const seed = 987654321;
    const run1 = runSelfPlayGame({
      gameId: "replay_test",
      seed,
      characterIds: ["laboratory_teacher", "chemistry_enthusiast"],
    });

    const run2 = runSelfPlayGame({
      gameId: "replay_test",
      seed,
      characterIds: ["laboratory_teacher", "chemistry_enthusiast"],
    });

    expect(run1.completed).toBe(true);
    expect(run2.completed).toBe(true);
    expect(run1.deadlocked).toBe(false);
    expect(run2.deadlocked).toBe(false);
    expect(run1.illegalActionAttempts).toBe(0);
    expect(run2.illegalActionAttempts).toBe(0);

    expect(run1.totalSteps).toBe(run2.totalSteps);
    expect(run1.actionLog).toEqual(run2.actionLog);
    expect(run1.finalState).toEqual(run2.finalState);
    expect(JSON.stringify(run1.finalState)).toBe(JSON.stringify(run2.finalState));
    expect(run1.finalState.log).toEqual(run2.finalState.log);
    expect(run1.rounds).toBe(
      (run1.finalState.cycleNumber - 1) * run1.finalState.settings.roundsPerCycle +
        run1.finalState.roundInCycle,
    );
    expect(run1.rounds).toBeGreaterThan(run1.finalState.roundInCycle);
    expect(run1.phasesVisited.mainAction).toBeGreaterThan(0);
  });

  it("completes clean self-play matches across all 7 playable characters with zero illegal actions", () => {
    // Test matches pairing each character with different opponents
    const testPairs = [
      ["laboratory_teacher", "chemical_factory_ceo"] as const,
      ["clumsy_party_secretary", "caustic_soda_captain"] as const,
      ["acid_king", "chemistry_enthusiast"] as const,
      ["sulfuric_acid_factory_director", "laboratory_teacher"] as const,
      ["caustic_soda_captain", "acid_king"] as const,
      ["chemistry_enthusiast", "clumsy_party_secretary"] as const,
      ["chemical_factory_ceo", "sulfuric_acid_factory_director"] as const,
    ];

    for (let index = 0; index < testPairs.length; index += 1) {
      const pair = testPairs[index];
      const result = runSelfPlayGame({
        gameId: `char_test_${index}`,
        seed: 1000 + index * 37,
        characterIds: pair,
        maxSteps: 1000,
      });

      expect(result.completed).toBe(true);
      expect(result.deadlocked).toBe(false);
      expect(result.illegalActionAttempts).toBe(0);
      expect(result.totalSteps).toBeGreaterThan(0);
      expect(result.finalState.phase).toBe("gameOver");
    }
  });

  it("runs batch self-play and collects valid telemetry without deadlock or illegal action", () => {
    const gameCount = 50;
    const summary = runBatchSelfPlay({
      gameCount,
      baseSeed: 20260821,
      maxStepsPerGame: 1000,
    });

    expect(summary.totalGames).toBe(gameCount);
    expect(summary.abortedGames).toBe(0);
    expect(summary.winsPlayer1 + summary.winsPlayer2 + summary.draws).toBe(
      gameCount,
    );
    expect(
      Number(
        (
          summary.firstPlayerWinRate +
          summary.secondPlayerWinRate +
          summary.drawRate
        ).toFixed(4),
      ),
    ).toBe(1);

    expect(summary.totalIllegalActionAttempts).toBe(0);
    expect(summary.totalDeadlocks).toBe(0);
    expect(summary.averageSteps).toBeGreaterThan(0);
    expect(summary.minSteps).toBeGreaterThan(0);
    expect(summary.maxSteps).toBeGreaterThanOrEqual(summary.minSteps);
    expect(summary.averageCycles).toBeGreaterThan(0);
    expect(summary.averageRounds).toBeGreaterThan(0);

    // Verify all character statistics are tracked
    for (const charId of allDefaultCharacterIds) {
      const charStat = summary.characterStats[charId];
      expect(charStat).toBeDefined();
      expect(charStat.matches).toBeGreaterThanOrEqual(0);
      expect(charStat.winRate).toBeGreaterThanOrEqual(0);
      expect(charStat.winRate).toBeLessThanOrEqual(1);
    }

    // Verify action types include common game actions
    expect(summary.actionTypeCounts.PASS_ACTION).toBeGreaterThan(0);
    expect(
      (summary.actionTypeCounts.PLAY_CARD ?? 0) +
        (summary.actionTypeCounts.PLAY_REFERENCE_CARD ?? 0) +
        (summary.actionTypeCounts.PLAY_DIY_SELECTION ?? 0) +
        (summary.actionTypeCounts.ACTIVATE_CHARACTER_SKILL ?? 0),
    ).toBeGreaterThan(0);

    // Verify no legacy actions were ever generated
    expect(summary.actionTypeCounts.START_ACTIVE_DIY).toBeUndefined();
    expect(summary.phasesVisited.mainAction).toBeGreaterThan(0);
    expect(Object.keys(summary.cardDefinitionPlayCounts).length).toBeGreaterThan(0);
  });

  it("rejects policy actions outside the current decision context before dispatch", () => {
    const startActiveDiyPolicy: NATBAPolicy = () => ({
      type: "START_ACTIVE_DIY",
      playerId: "player_1",
      recipeId: "diy_hcl_from_h_cl",
      componentCardInstanceIds: [],
    });

    const diyResult = runSelfPlayGame({
      gameId: "illegal_diy",
      seed: 11,
      characterIds: ["caustic_soda_captain", "acid_king"],
      policyPlayer1: startActiveDiyPolicy,
      policyPlayer2: startActiveDiyPolicy,
    });
    expect(diyResult.completed).toBe(false);
    expect(diyResult.illegalActionAttempts).toBe(1);
    expect(diyResult.actionLog).toEqual([]);
    expect(diyResult.actionLog.some((action) => action.type === "START_ACTIVE_DIY")).toBe(
      false,
    );

    const wrongKeepCountPolicy: NATBAPolicy = (observation, context, random) => {
      if (context.kind === "laboratory-preparation") {
        return {
          type: "CONFIRM_LABORATORY_PREPARATION",
          playerId: context.playerId,
          keptCardInstanceIds: context.candidateCardInstanceIds.slice(0, 3),
        };
      }
      return natba0RandomLegalPolicy(observation, context, random);
    };

    const prepResult = runSelfPlayGame({
      gameId: "illegal_prep",
      seed: 12,
      characterIds: ["laboratory_teacher", "chemical_factory_ceo"],
      policyPlayer1: wrongKeepCountPolicy,
      policyPlayer2: wrongKeepCountPolicy,
    });
    expect(prepResult.completed).toBe(false);
    expect(prepResult.illegalActionAttempts).toBe(1);
    expect(prepResult.actionLog).toEqual([]);
    expect(prepResult.finalState.phase).toBe("preparationSelection");

    const outsiderFinitePolicy: NATBAPolicy = (
      _observation,
      context: DecisionContext,
    ) => {
      if (context.kind !== "finite-actions") {
        return undefined;
      }
      return {
        type: "PASS_ACTION",
        playerId: context.playerId === "player_1" ? "player_2" : "player_1",
      };
    };

    const finiteResult = runSelfPlayGame({
      gameId: "illegal_finite",
      seed: 13,
      characterIds: ["caustic_soda_captain", "acid_king"],
      policyPlayer1: outsiderFinitePolicy,
      policyPlayer2: outsiderFinitePolicy,
    });
    expect(finiteResult.completed).toBe(false);
    expect(finiteResult.illegalActionAttempts).toBe(1);
    expect(finiteResult.actionLog).toEqual([]);
  });

  it("returns zero-valued batch statistics when gameCount is 0", () => {
    const summary = runBatchSelfPlay({ gameCount: 0, baseSeed: 1 });
    expect(summary.totalGames).toBe(0);
    expect(summary.abortedGames).toBe(0);
    expect(summary.firstPlayerWinRate).toBe(0);
    expect(summary.secondPlayerWinRate).toBe(0);
    expect(summary.drawRate).toBe(0);
    expect(summary.averageSteps).toBe(0);
    expect(summary.averageCycles).toBe(0);
    expect(summary.averageRounds).toBe(0);
    expect(summary.minSteps).toBe(0);
    expect(summary.maxSteps).toBe(0);
    expect(summary.phasesVisited).toEqual({});
    expect(summary.cardDefinitionPlayCounts).toEqual({});
  });

  it("excludes aborted games from character win-rate denominators", () => {
    const summary = runBatchSelfPlay({
      gameCount: 4,
      baseSeed: 99,
      maxStepsPerGame: 1,
      characterPairs: [
        ["laboratory_teacher", "chemical_factory_ceo"],
        ["caustic_soda_captain", "acid_king"],
      ],
    });

    expect(summary.abortedGames).toBe(4);
    expect(summary.winsPlayer1 + summary.winsPlayer2 + summary.draws).toBe(0);
    expect(summary.firstPlayerWinRate).toBe(0);
    expect(summary.totalDeadlocks).toBe(4);
    for (const charId of allDefaultCharacterIds) {
      expect(summary.characterStats[charId].matches).toBe(0);
      expect(summary.characterStats[charId].wins).toBe(0);
      expect(summary.characterStats[charId].winRate).toBe(0);
    }
  });

  it("covers all 5 decision phases across structured self-play scenarios", () => {
    // 1. preparationSelection: covered when laboratory_teacher is present
    const prepGame = runSelfPlayGame({
      seed: 42,
      characterIds: ["laboratory_teacher", "chemical_factory_ceo"],
    });
    expect(
      prepGame.actionLog.some(
        (action) => action.type === "CONFIRM_LABORATORY_PREPARATION",
      ),
    ).toBe(true);

    // 2. mainAction: universally covered in all games
    expect(
      prepGame.actionLog.some((action) => action.type === "PASS_ACTION"),
    ).toBe(true);

    // 3. statusWindow & responseWindow & experimentCounterattackWindow:
    // Run batch of matches with chemistry_enthusiast, clumsy_party_secretary and sulfuric_acid_factory_director
    const tacticalSummary = runBatchSelfPlay({
      gameCount: 30,
      baseSeed: 55555,
      characterPairs: [
        ["clumsy_party_secretary", "caustic_soda_captain"],
        ["sulfuric_acid_factory_director", "chemistry_enthusiast"],
        ["chemistry_enthusiast", "acid_king"],
        ["laboratory_teacher", "clumsy_party_secretary"],
      ],
    });

    expect(tacticalSummary.totalIllegalActionAttempts).toBe(0);
    expect(tacticalSummary.totalDeadlocks).toBe(0);

    // Verify active actions were generated
    const hasActiveOrResponseActions =
      (tacticalSummary.actionTypeCounts.RESPOND_WITH_CARD ?? 0) > 0 ||
      (tacticalSummary.actionTypeCounts.PASS_RESPONSE ?? 0) > 0 ||
      (tacticalSummary.actionTypeCounts.HANDLE_STATUS_WITH_CARD ?? 0) > 0 ||
      (tacticalSummary.actionTypeCounts.PASS_STATUS_HANDLING ?? 0) > 0 ||
      (tacticalSummary.actionTypeCounts.ACTIVATE_CHARACTER_SKILL ?? 0) > 0 ||
      (tacticalSummary.actionTypeCounts.RESOLVE_EXPERIMENT_COUNTERATTACK ?? 0) >
        0;

    expect(hasActiveOrResponseActions).toBe(true);
  });
});

describe("Phase 19E — NATBA-1 Heuristic Policy Self-Play & Win-Rate Benchmark", () => {
  it("replays full NATBA-1 vs NATBA-1 game deterministically with bit-identical final states and logs", () => {
    const seed = 543216789;
    const run1 = runSelfPlayGame({
      gameId: "natba1_replay_test",
      seed,
      characterIds: ["laboratory_teacher", "chemistry_enthusiast"],
      policyPlayer1: natba1HeuristicPolicy,
      policyPlayer2: natba1HeuristicPolicy,
    });

    const run2 = runSelfPlayGame({
      gameId: "natba1_replay_test",
      seed,
      characterIds: ["laboratory_teacher", "chemistry_enthusiast"],
      policyPlayer1: natba1HeuristicPolicy,
      policyPlayer2: natba1HeuristicPolicy,
    });
    expect(run1.completed).toBe(true);
    expect(run2.completed).toBe(true);
    expect(run1.deadlocked).toBe(false);
    expect(run2.deadlocked).toBe(false);
    expect(run1.illegalActionAttempts).toBe(0);
    expect(run2.illegalActionAttempts).toBe(0);

    expect(run1.totalSteps).toBe(run2.totalSteps);
    expect(run1.actionLog).toEqual(run2.actionLog);
    expect(run1.finalState).toEqual(run2.finalState);
    expect(JSON.stringify(run1.finalState)).toBe(JSON.stringify(run2.finalState));
    expect(run1.finalState.log).toEqual(run2.finalState.log);
  });

  it("completes clean NATBA-1 self-play matches across all 7 playable characters with zero illegal actions", () => {
    const testPairs = [
      ["laboratory_teacher", "chemical_factory_ceo"] as const,
      ["clumsy_party_secretary", "caustic_soda_captain"] as const,
      ["acid_king", "chemistry_enthusiast"] as const,
      ["sulfuric_acid_factory_director", "laboratory_teacher"] as const,
      ["caustic_soda_captain", "acid_king"] as const,
      ["chemistry_enthusiast", "clumsy_party_secretary"] as const,
      ["chemical_factory_ceo", "sulfuric_acid_factory_director"] as const,
    ];

    for (let index = 0; index < testPairs.length; index += 1) {
      const pair = testPairs[index];
      const result = runSelfPlayGame({
        gameId: `natba1_char_test_${index}`,
        seed: 2000 + index * 41,
        characterIds: pair,
        policyPlayer1: natba1HeuristicPolicy,
        policyPlayer2: natba1HeuristicPolicy,
        maxSteps: 1000,
      });

      expect(result.completed).toBe(true);
      expect(result.deadlocked).toBe(false);
      expect(result.illegalActionAttempts).toBe(0);
      expect(result.totalSteps).toBeGreaterThan(0);
      expect(result.finalState.phase).toBe("gameOver");
    }
  });

  it("demonstrates significant win-rate superiority of NATBA-1 over NATBA-0 baseline in paired matchups", () => {
    const summaryP1Heuristic = runBatchSelfPlay({
      gameCount: 50,
      baseSeed: 20260901,
      policyPlayer1: natba1HeuristicPolicy,
      policyPlayer2: natba0RandomLegalPolicy,
      maxStepsPerGame: 1000,
    });

    const summaryP2Heuristic = runBatchSelfPlay({
      gameCount: 50,
      baseSeed: 20260901,
      policyPlayer1: natba0RandomLegalPolicy,
      policyPlayer2: natba1HeuristicPolicy,
      maxStepsPerGame: 1000,
    });

    expect(summaryP1Heuristic.totalIllegalActionAttempts).toBe(0);
    expect(summaryP1Heuristic.totalDeadlocks).toBe(0);
    expect(summaryP1Heuristic.abortedGames).toBe(0);

    expect(summaryP2Heuristic.totalIllegalActionAttempts).toBe(0);
    expect(summaryP2Heuristic.totalDeadlocks).toBe(0);
    expect(summaryP2Heuristic.abortedGames).toBe(0);

    const totalHeuristicWins =
      summaryP1Heuristic.winsPlayer1 + summaryP2Heuristic.winsPlayer2;
    const totalRandomWins =
      summaryP1Heuristic.winsPlayer2 + summaryP2Heuristic.winsPlayer1;
    const totalCompleted =
      100 - (summaryP1Heuristic.draws + summaryP2Heuristic.draws);

    const overallHeuristicWinRate = totalHeuristicWins / totalCompleted;

    expect(overallHeuristicWinRate).toBeGreaterThanOrEqual(0.7);
    expect(totalHeuristicWins).toBeGreaterThan(totalRandomWins * 2);
  });
});

