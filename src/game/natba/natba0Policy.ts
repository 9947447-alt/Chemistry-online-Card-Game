import type { RandomSource } from "../../shared/random";
import type { GameAction } from "../engine/actions";
import type { AIObservation } from "../engine/aiObservation";
import type { DecisionContext } from "../engine/decisionContext";
import type { NATBAPolicy } from "./types";

export const natba0RandomLegalPolicy: NATBAPolicy = (
  _observation: AIObservation,
  context: DecisionContext,
  random: RandomSource = Math.random,
): GameAction | undefined => {
  if (context.kind === "finite-actions") {
    if (context.legalActions.length === 0) {
      return undefined;
    }
    const selectedIndex = Math.floor(random() * context.legalActions.length);
    const clampedIndex = Math.min(
      Math.max(0, selectedIndex),
      context.legalActions.length - 1,
    );
    return context.legalActions[clampedIndex];
  }

  if (context.kind === "laboratory-preparation") {
    const candidates = [...context.candidateCardInstanceIds];
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [candidates[index], candidates[swapIndex]] = [
        candidates[swapIndex],
        candidates[index],
      ];
    }
    const keptCardInstanceIds = candidates.slice(0, context.keepCount);
    return {
      type: "CONFIRM_LABORATORY_PREPARATION",
      playerId: context.playerId,
      keptCardInstanceIds,
    };
  }

  return undefined;
};
