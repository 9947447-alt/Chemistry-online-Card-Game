import {
  createFisherYatesShuffle,
  createMulberry32,
  type RandomSource,
  type ShuffleFunction,
} from "../../shared/random";
import type { GameAction } from "../engine/actions";
import { getAIObservation } from "../engine/aiObservation";
import { createInitialGame } from "../engine/createInitialGame";
import { getDecisionContext } from "../engine/decisionContext";
import { engineReducer } from "../engine/reducer";
import type { CharacterId, GameState } from "../engine/types";
import { natba0RandomLegalPolicy } from "./natba0Policy";
import type {
  BatchSelfPlayOptions,
  CharacterMatchupRecord,
  CharacterStatsRecord,
  NATBAPolicy,
  SelfPlayBatchSummary,
  SelfPlayGameResult,
  SelfPlayOptions,
} from "./types";

export const allDefaultCharacterIds: readonly CharacterId[] = [
  "laboratory_teacher",
  "chemical_factory_ceo",
  "clumsy_party_secretary",
  "caustic_soda_captain",
  "acid_king",
  "chemistry_enthusiast",
  "sulfuric_acid_factory_director",
];

export function runSelfPlayGame(options: SelfPlayOptions = {}): SelfPlayGameResult {
  const {
    gameId = `self_play_${options.seed ?? Math.floor(Math.random() * 1000000)}`,
    seed,
    characterIds = ["laboratory_teacher", "chemical_factory_ceo"],
    policyPlayer1 = natba0RandomLegalPolicy,
    policyPlayer2 = natba0RandomLegalPolicy,
    maxSteps = 1000,
  } = options;

  let shuffle: ShuffleFunction | undefined = undefined;
  let decisionRandom: RandomSource = Math.random;

  if (seed !== undefined) {
    const shufflePrng = createMulberry32((seed ^ 0xa5a5a5a5) >>> 0);
    shuffle = createFisherYatesShuffle(shufflePrng);
    decisionRandom = createMulberry32((seed ^ 0x5a5a5a5a) >>> 0);
  }

  let state: GameState = createInitialGame({
    gameId,
    seed,
    shuffle,
    characterIds: [characterIds[0], characterIds[1]],
  });

  const actionLog: GameAction[] = [];
  let illegalActionAttempts = 0;
  let deadlocked = false;
  let steps = 0;

  while (steps < maxSteps && state.phase !== "gameOver") {
    const context = getDecisionContext(state);
    if (context.kind === "game-over") {
      break;
    }

    if (context.kind === "none") {
      deadlocked = true;
      break;
    }

    const decisionPlayerId = context.playerId;
    const observation = getAIObservation(state, decisionPlayerId);
    const isPlayer1 = decisionPlayerId === state.players[0]?.id;
    const activePolicy: NATBAPolicy = isPlayer1 ? policyPlayer1 : policyPlayer2;

    const action = activePolicy(observation, context, decisionRandom);
    if (!action) {
      deadlocked = true;
      break;
    }

    actionLog.push(action);
    const nextState = engineReducer(state, action, shuffle);

    if (nextState === state) {
      illegalActionAttempts += 1;
      deadlocked = true;
      break;
    }

    state = nextState;
    steps += 1;
  }

  if (steps >= maxSteps && state.phase !== "gameOver") {
    deadlocked = true;
  }

  const completed =
    state.phase === "gameOver" && !deadlocked && illegalActionAttempts === 0;

  return {
    gameId: state.id,
    winnerPlayerId: state.winnerPlayerId,
    isDraw: state.isDraw,
    totalSteps: steps,
    cycles: state.cycleNumber,
    rounds: state.roundInCycle,
    actionLog,
    finalState: state,
    completed,
    illegalActionAttempts,
    deadlocked,
    characterPlayer1: characterIds[0],
    characterPlayer2: characterIds[1],
  };
}

function buildDefaultCharacterPairs(): [CharacterId, CharacterId][] {
  const pairs: [CharacterId, CharacterId][] = [];
  for (const charA of allDefaultCharacterIds) {
    for (const charB of allDefaultCharacterIds) {
      pairs.push([charA, charB]);
    }
  }
  return pairs;
}

function createInitialCharacterStats(): Record<CharacterId, CharacterStatsRecord> {
  const stats = {} as Record<CharacterId, CharacterStatsRecord>;
  for (const charId of allDefaultCharacterIds) {
    stats[charId] = { matches: 0, wins: 0, winRate: 0 };
  }
  return stats;
}

function createInitialMatchupMatrix(): Record<
  CharacterId,
  Record<CharacterId, CharacterMatchupRecord>
> {
  const matrix = {} as Record<
    CharacterId,
    Record<CharacterId, CharacterMatchupRecord>
  >;
  for (const charA of allDefaultCharacterIds) {
    matrix[charA] = {} as Record<CharacterId, CharacterMatchupRecord>;
    for (const charB of allDefaultCharacterIds) {
      matrix[charA][charB] = { matches: 0, winsP1: 0, winsP2: 0, draws: 0 };
    }
  }
  return matrix;
}

export function runBatchSelfPlay(
  options: BatchSelfPlayOptions,
): SelfPlayBatchSummary {
  const {
    gameCount,
    baseSeed = 20260821,
    characterPairs,
    policyPlayer1 = natba0RandomLegalPolicy,
    policyPlayer2 = natba0RandomLegalPolicy,
    maxStepsPerGame = 1000,
  } = options;

  const pairs =
    characterPairs && characterPairs.length > 0
      ? characterPairs
      : buildDefaultCharacterPairs();

  let winsPlayer1 = 0;
  let winsPlayer2 = 0;
  let draws = 0;
  let totalStepsSum = 0;
  let minSteps = Number.POSITIVE_INFINITY;
  let maxSteps = 0;
  let totalCyclesSum = 0;
  let totalRoundsSum = 0;
  let totalIllegalActionAttempts = 0;
  let totalDeadlocks = 0;

  const actionTypeCounts: Record<string, number> = {};
  const phasesVisited: Record<string, number> = {};

  const characterStats = createInitialCharacterStats();
  const matchupMatrix = createInitialMatchupMatrix();

  for (let index = 0; index < gameCount; index += 1) {
    const pair = pairs[index % pairs.length];
    const char1 = pair[0];
    const char2 = pair[1];
    const seed =
      baseSeed !== undefined
        ? (baseSeed + index * 1013) >>> 0
        : undefined;

    const result = runSelfPlayGame({
      gameId: `batch_game_${index + 1}`,
      seed,
      characterIds: [char1, char2],
      policyPlayer1,
      policyPlayer2,
      maxSteps: maxStepsPerGame,
    });

    totalStepsSum += result.totalSteps;
    if (result.totalSteps < minSteps) {
      minSteps = result.totalSteps;
    }
    if (result.totalSteps > maxSteps) {
      maxSteps = result.totalSteps;
    }
    totalCyclesSum += result.cycles;
    totalRoundsSum += result.rounds;
    totalIllegalActionAttempts += result.illegalActionAttempts;
    if (result.deadlocked) {
      totalDeadlocks += 1;
    }

    for (const action of result.actionLog) {
      actionTypeCounts[action.type] = (actionTypeCounts[action.type] ?? 0) + 1;
    }

    if (!matchupMatrix[char1]) {
      matchupMatrix[char1] = {} as Record<CharacterId, CharacterMatchupRecord>;
    }
    if (!matchupMatrix[char1][char2]) {
      matchupMatrix[char1][char2] = { matches: 0, winsP1: 0, winsP2: 0, draws: 0 };
    }
    const matchup = matchupMatrix[char1][char2];
    matchup.matches += 1;

    if (!characterStats[char1]) {
      characterStats[char1] = { matches: 0, wins: 0, winRate: 0 };
    }
    if (!characterStats[char2]) {
      characterStats[char2] = { matches: 0, wins: 0, winRate: 0 };
    }
    characterStats[char1].matches += 1;
    characterStats[char2].matches += 1;

    if (result.isDraw) {
      draws += 1;
      matchup.draws += 1;
    } else if (result.winnerPlayerId === "player_1") {
      winsPlayer1 += 1;
      matchup.winsP1 += 1;
      characterStats[char1].wins += 1;
    } else if (result.winnerPlayerId === "player_2") {
      winsPlayer2 += 1;
      matchup.winsP2 += 1;
      characterStats[char2].wins += 1;
    }

    for (const logEntry of result.finalState.log) {
      if (
        logEntry.params &&
        typeof logEntry.params === "object" &&
        "phase" in logEntry.params
      ) {
        const phaseValue = (logEntry.params as { phase?: unknown }).phase;
        if (phaseValue !== undefined) {
          const phaseName = String(phaseValue);
          phasesVisited[phaseName] = (phasesVisited[phaseName] ?? 0) + 1;
        }
      }
    }
  }

  for (const charId of Object.keys(characterStats) as CharacterId[]) {
    const stat = characterStats[charId];
    if (stat && stat.matches > 0) {
      stat.winRate = Number((stat.wins / stat.matches).toFixed(4));
    }
  }

  return {
    totalGames: gameCount,
    winsPlayer1,
    winsPlayer2,
    draws,
    firstPlayerWinRate: Number((winsPlayer1 / gameCount).toFixed(4)),
    secondPlayerWinRate: Number((winsPlayer2 / gameCount).toFixed(4)),
    drawRate: Number((draws / gameCount).toFixed(4)),
    characterStats,
    matchupMatrix,
    averageSteps: Number((totalStepsSum / gameCount).toFixed(2)),
    minSteps: minSteps === Number.POSITIVE_INFINITY ? 0 : minSteps,
    maxSteps,
    averageCycles: Number((totalCyclesSum / gameCount).toFixed(2)),
    averageRounds: Number((totalRoundsSum / gameCount).toFixed(2)),
    actionTypeCounts,
    phasesVisited,
    totalIllegalActionAttempts,
    totalDeadlocks,
  };
}
