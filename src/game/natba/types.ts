import type { RandomSource } from "../../shared/random";
import type { GameAction } from "../engine/actions";
import type { AIObservation } from "../engine/aiObservation";
import type { DecisionContext } from "../engine/decisionContext";
import type { CharacterId, GameState, PlayerId } from "../engine/types";

export type NATBAPolicy = (
  observation: AIObservation,
  context: DecisionContext,
  random: RandomSource,
) => GameAction | undefined;

export type SelfPlayOptions = {
  readonly gameId?: string;
  readonly seed?: number;
  readonly characterIds?: readonly [CharacterId, CharacterId];
  readonly policyPlayer1?: NATBAPolicy;
  readonly policyPlayer2?: NATBAPolicy;
  readonly maxSteps?: number;
};

export type SelfPlayGameResult = {
  readonly gameId: string;
  readonly winnerPlayerId?: PlayerId;
  readonly isDraw?: boolean;
  readonly totalSteps: number;
  readonly cycles: number;
  readonly rounds: number;
  readonly actionLog: readonly GameAction[];
  readonly finalState: GameState;
  readonly completed: boolean;
  readonly illegalActionAttempts: number;
  readonly deadlocked: boolean;
  readonly characterPlayer1: CharacterId;
  readonly characterPlayer2: CharacterId;
};

export type BatchSelfPlayOptions = {
  readonly gameCount: number;
  readonly baseSeed?: number;
  readonly characterPairs?: readonly (readonly [CharacterId, CharacterId])[];
  readonly policyPlayer1?: NATBAPolicy;
  readonly policyPlayer2?: NATBAPolicy;
  readonly maxStepsPerGame?: number;
};

export type CharacterMatchupRecord = {
  matches: number;
  winsP1: number;
  winsP2: number;
  draws: number;
};

export type CharacterStatsRecord = {
  matches: number;
  wins: number;
  winRate: number;
};

export type SelfPlayBatchSummary = {
  readonly totalGames: number;
  readonly winsPlayer1: number;
  readonly winsPlayer2: number;
  readonly draws: number;
  readonly firstPlayerWinRate: number;
  readonly secondPlayerWinRate: number;
  readonly drawRate: number;
  readonly characterStats: Record<CharacterId, CharacterStatsRecord>;
  readonly matchupMatrix: Record<CharacterId, Record<CharacterId, CharacterMatchupRecord>>;
  readonly averageSteps: number;
  readonly minSteps: number;
  readonly maxSteps: number;
  readonly averageCycles: number;
  readonly averageRounds: number;
  readonly actionTypeCounts: Record<string, number>;
  readonly phasesVisited: Record<string, number>;
  readonly totalIllegalActionAttempts: number;
  readonly totalDeadlocks: number;
};
