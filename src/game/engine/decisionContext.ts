import type { GameAction } from "./actions";
import { getValidPendingExperimentCounterattack } from "./experimentCounterattack";
import { getLegalActions } from "./legalActions";
import {
  getValidMultiTargetPendingResponse,
  isMultiTargetPendingResponse,
} from "./multiTargetResponse";
import { getValidSinglePendingResponse } from "./resolution";
import { getValidLaboratoryPreparationContext } from "./turnFlow";
import type { CardInstanceId, GameState, PlayerId } from "./types";

export type FiniteActionDecisionPhase =
  | "mainAction"
  | "responseWindow"
  | "statusWindow"
  | "experimentCounterattackWindow";

export type DecisionContext =
  | { readonly kind: "none" }
  | {
      readonly kind: "finite-actions";
      readonly phase: FiniteActionDecisionPhase;
      readonly playerId: PlayerId;
      readonly legalActions: readonly GameAction[];
    }
  | {
      readonly kind: "laboratory-preparation";
      readonly phase: "preparationSelection";
      readonly playerId: PlayerId;
      readonly candidateCardInstanceIds: readonly CardInstanceId[];
      readonly keepCount: 10;
    }
  | {
      readonly kind: "game-over";
      readonly winnerPlayerId?: PlayerId;
      readonly isDraw?: boolean;
    };

export function getAuthoritativeDecisionMaker(state: GameState): PlayerId | undefined {
  if (state.phase === "gameOver") {
    return undefined;
  }

  if (state.phase === "preparationSelection") {
    const pending = getValidLaboratoryPreparationContext(state);
    if (!pending) {
      return undefined;
    }
    const player = state.players.find((candidate) => candidate.id === pending.playerId);
    return player && !player.eliminated ? player.id : undefined;
  }

  if (state.phase === "mainAction") {
    const activePlayer = state.players.find(
      (candidate) => candidate.id === state.activePlayerId,
    );
    return activePlayer && !activePlayer.eliminated ? activePlayer.id : undefined;
  }

  if (state.phase === "responseWindow") {
    if (isMultiTargetPendingResponse(state)) {
      const responderId = state.pendingResponse?.responderId;
      if (!responderId) {
        return undefined;
      }
      const validPending = getValidMultiTargetPendingResponse(state, responderId);
      const responder = state.players.find((candidate) => candidate.id === responderId);
      return validPending && responder && !responder.eliminated ? responder.id : undefined;
    }

    const responderId = state.pendingResponse?.responderId;
    return responderId && getValidSinglePendingResponse(state, responderId)
      ? responderId
      : undefined;
  }

  if (state.phase === "statusWindow") {
    const pending = state.pendingStatusHandling;
    if (!pending || pending.playerId !== state.activePlayerId) {
      return undefined;
    }
    const player = state.players.find((candidate) => candidate.id === pending.playerId);
    if (!player || player.eliminated) {
      return undefined;
    }
    const status = player.statuses.find(
      (candidate) => candidate.id === pending.statusInstanceId,
    );
    if (!status || (status.statusId !== "FIRE" && status.statusId !== "SO2_LEAK")) {
      return undefined;
    }
    return player.id;
  }

  if (state.phase === "experimentCounterattackWindow") {
    const responderId = state.pendingExperimentCounterattack?.responderPlayerId;
    if (!responderId) {
      return undefined;
    }
    const validPending = getValidPendingExperimentCounterattack(state, responderId);
    return validPending ? responderId : undefined;
  }

  return undefined;
}

export function getDecisionContext(state: GameState): DecisionContext {
  if (state.phase === "gameOver") {
    return {
      kind: "game-over",
      winnerPlayerId: state.winnerPlayerId,
      isDraw: state.isDraw,
    };
  }

  if (state.phase === "preparationSelection") {
    const pending = getValidLaboratoryPreparationContext(state);
    if (!pending) {
      return { kind: "none" };
    }

    return {
      kind: "laboratory-preparation",
      phase: "preparationSelection",
      playerId: pending.playerId,
      candidateCardInstanceIds: [...pending.candidateCardInstanceIds],
      keepCount: 10,
    };
  }

  if (
    state.phase === "mainAction" ||
    state.phase === "responseWindow" ||
    state.phase === "statusWindow" ||
    state.phase === "experimentCounterattackWindow"
  ) {
    const decisionMakerId = getAuthoritativeDecisionMaker(state);
    if (!decisionMakerId) {
      return { kind: "none" };
    }

    const legalActions = getLegalActions(state, decisionMakerId);
    if (legalActions.length === 0) {
      return { kind: "none" };
    }

    return {
      kind: "finite-actions",
      phase: state.phase,
      playerId: decisionMakerId,
      legalActions,
    };
  }

  return { kind: "none" };
}
