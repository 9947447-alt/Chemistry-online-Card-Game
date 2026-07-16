import { createExhaustLeakDamageContext } from "./damageContext";
import { applyLoseHpBatch } from "./loseHp";
import type {
  DamageEffect,
  GameState,
  MultiTargetPendingResponse,
  MultiTargetResponseSequence,
  PlayerId,
  ResponseContinuation,
} from "./types";
import {
  advanceTurnFromReducer,
  finishGameIfResolved,
  type ShuffleFunction,
} from "./turnFlow";

function createExhaustLeakEffect(
  sourcePlayerId: PlayerId,
  targetPlayerId: PlayerId,
): DamageEffect {
  return {
    type: "DAMAGE",
    context: createExhaustLeakDamageContext({
      sourcePlayerId,
      targetPlayerId,
      baseAmount: 2,
      skillId: "exhaust_leak",
    }),
  };
}

export function createExhaustLeakPendingResponse(
  sequence: MultiTargetResponseSequence,
  responderId: PlayerId,
): MultiTargetPendingResponse {
  const sourceEffect = createExhaustLeakEffect(sequence.sourcePlayerId, responderId);
  return {
    responderId,
    sourceEffect,
    chainDepth: 1,
    effectsAfterPass: [sourceEffect],
    multiTargetSequence: sequence,
  };
}

export function resumeResponseContinuation(
  state: GameState,
  continuation: ResponseContinuation,
  shuffle: ShuffleFunction,
): GameState {
  const clearedState: GameState = {
    ...state,
    phase: "mainAction",
    pendingResponse: undefined,
    pendingExperimentCounterattack: undefined,
  };

  if (continuation.kind === "single-response") {
    const gameOverChecked = finishGameIfResolved(clearedState);
    return gameOverChecked.phase === "gameOver"
      ? gameOverChecked
      : advanceTurnFromReducer(gameOverChecked, shuffle);
  }

  const { sequence, completedResult } = continuation;
  const completedResults = [...sequence.completedResults, completedResult];
  const [nextTargetPlayerId, ...remainingTargetPlayerIds] =
    sequence.remainingTargetPlayerIds;

  if (nextTargetPlayerId) {
    const nextSequence: MultiTargetResponseSequence = {
      ...sequence,
      remainingTargetPlayerIds,
      completedResults,
    };
    return {
      ...clearedState,
      phase: "responseWindow",
      pendingResponse: createExhaustLeakPendingResponse(nextSequence, nextTargetPlayerId),
    };
  }

  const allTargetsAbsorbed =
    completedResults.length === sequence.targetPlayerIds.length &&
    completedResults.every((completed) => completed.outcome === "absorbed");
  const afterPenalty = allTargetsAbsorbed
    ? applyLoseHpBatch(clearedState, [
        { targetPlayerId: sequence.sourcePlayerId, amount: 1 },
      ])
    : clearedState;
  const gameOverChecked = finishGameIfResolved(afterPenalty);

  return gameOverChecked.phase === "gameOver"
    ? gameOverChecked
    : advanceTurnFromReducer(gameOverChecked, shuffle);
}
