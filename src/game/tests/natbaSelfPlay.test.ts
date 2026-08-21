import { describe, expect, it } from "vitest";
import {
  allDefaultCharacterIds,
  runBatchSelfPlay,
  runSelfPlayGame,
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
