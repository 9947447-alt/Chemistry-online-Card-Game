import { cardDefinitions } from "../data/cardDefinitions";
import { diyRecipes } from "../data/diyRecipes";
import type {
  ActivateCharacterSkillAction,
  GameAction,
  PlayDiySelectionAction,
  ResolveExperimentCounterattackAction,
} from "./actions";
import { canPlayCardAgainstTableReference } from "./cardAssociation";
import {
  getLegalCharacterSkillActions,
  validateCharacterSkillAction,
} from "./characterSkills";
import { getAcidBaseDamageTag } from "./damageContext";
import { analyzeDIYSelection } from "./diy";
import {
  getValidPendingExperimentCounterattack,
  isLegalExperimentCounterattackPursuitDefinition,
} from "./experimentCounterattack";
import {
  getValidMultiTargetPendingResponse,
  isAlkalineAbsorptionDefinition,
  isMultiTargetPendingResponse,
} from "./multiTargetResponse";
import {
  createAcidBaseResponseReactionEvent,
  createImmediateSo2AbsorptionReactionEvent,
} from "./reactions";
import { canRecoverHp } from "./recovery";
import {
  canGenerateCarbonDioxideAgainstAcid,
  canNeutralize,
  getAcidBaseDamageKind,
} from "./resolution";
import { isValidLaboratoryPreparationConfirmation } from "./turnFlow";
import type {
  CardDefinition,
  CardInstanceId,
  GameState,
  Player,
  PlayerId,
} from "./types";

const definitionsById = new Map<string, CardDefinition>(
  cardDefinitions.map((definition) => [definition.id, definition]),
);

function getPlayer(state: GameState, playerId: PlayerId): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}

function getOtherAlivePlayers(state: GameState, sourcePlayerId: PlayerId): Player[] {
  return state.players.filter(
    (player) => player.id !== sourcePlayerId && !player.eliminated,
  );
}

function getCombinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) {
    return [[]];
  }
  if (items.length < k) {
    return [];
  }
  if (items.length === k) {
    return [[...items]];
  }

  const [head, ...tail] = items;
  const withHead = getCombinations(tail, k - 1).map((combo) => [head, ...combo]);
  const withoutHead = getCombinations(tail, k);
  return [...withHead, ...withoutHead];
}

const registeredDiyComponentSizes: readonly number[] = Array.from(
  new Set(
    diyRecipes.map((recipe) =>
      recipe.requiredComponents.reduce((sum, req) => sum + req.count, 0),
    ),
  ),
).sort((a, b) => a - b);

export function validatePassAction(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== "mainAction" || state.activePlayerId !== playerId) {
    return false;
  }
  const player = getPlayer(state, playerId);
  return Boolean(player && !player.eliminated);
}

export function validatePlayReferenceCardAction(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): boolean {
  if (state.phase !== "mainAction" || state.activePlayerId !== playerId) {
    return false;
  }
  const actor = getPlayer(state, playerId);
  if (!actor || actor.eliminated || !actor.hand.includes(cardInstanceId)) {
    return false;
  }

  const instance = state.cardInstances[cardInstanceId];
  if (
    !instance ||
    instance.ownerId !== playerId ||
    instance.zone.type !== "hand" ||
    instance.zone.playerId !== playerId
  ) {
    return false;
  }

  const definition = definitionsById.get(instance.definitionId);
  if (!definition) {
    return false;
  }

  return canPlayCardAgainstTableReference(state, playerId, cardInstanceId);
}

export function validatePlayCardAction(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  targetPlayerId?: PlayerId,
): boolean {
  if (state.phase !== "mainAction" || state.activePlayerId !== playerId) {
    return false;
  }
  const actor = getPlayer(state, playerId);
  if (!actor || actor.eliminated || !actor.hand.includes(cardInstanceId)) {
    return false;
  }

  const instance = state.cardInstances[cardInstanceId];
  if (
    !instance ||
    instance.ownerId !== playerId ||
    instance.zone.type !== "hand" ||
    instance.zone.playerId !== playerId
  ) {
    return false;
  }

  const definition = definitionsById.get(instance.definitionId);
  if (!definition || !definition.allowedTimings.includes("main-action")) {
    return false;
  }

  if (!canPlayCardAgainstTableReference(state, playerId, cardInstanceId)) {
    return false;
  }

  if (definition.id === "substance_o2") {
    return targetPlayerId === actor.id && canRecoverHp(actor);
  }

  if (!targetPlayerId || targetPlayerId === actor.id) {
    return false;
  }

  const target = getPlayer(state, targetPlayerId);
  if (!target || target.eliminated) {
    return false;
  }

  if (definition.id === "substance_so2") {
    return true;
  }

  if (definition.type !== "substance" || definition.baseDamage !== 1) {
    return false;
  }

  const damageKind = getAcidBaseDamageKind(definition);
  return damageKind !== undefined;
}

export function validatePlayDiySelectionAction(
  state: GameState,
  playerId: PlayerId,
  componentCardInstanceIds: readonly CardInstanceId[],
  targetPlayerId?: PlayerId,
): boolean {
  const analysis = analyzeDIYSelection(
    state,
    playerId,
    componentCardInstanceIds,
    targetPlayerId,
  );
  return analysis.status === "EXECUTABLE";
}

export function validateRespondWithCardAction(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): boolean {
  if (state.phase !== "responseWindow") {
    return false;
  }

  const responder = getPlayer(state, playerId);
  if (!responder || responder.eliminated || !responder.hand.includes(cardInstanceId)) {
    return false;
  }

  const instance = state.cardInstances[cardInstanceId];
  if (
    !instance ||
    instance.ownerId !== playerId ||
    instance.zone.type !== "hand" ||
    instance.zone.playerId !== playerId
  ) {
    return false;
  }

  const definition = definitionsById.get(instance.definitionId);
  if (!definition) {
    return false;
  }

  if (isMultiTargetPendingResponse(state)) {
    const pendingResponse = getValidMultiTargetPendingResponse(state, playerId);
    if (!pendingResponse || !isAlkalineAbsorptionDefinition(definition)) {
      return false;
    }
    const event = createImmediateSo2AbsorptionReactionEvent({
      context: pendingResponse.sourceEffect.context,
      responsePlayerId: playerId,
      responseCardInstanceId: cardInstanceId,
      responseCardDefinitionId: definition.id,
    });
    return Boolean(event);
  }

  const pendingResponse = state.pendingResponse;
  if (!pendingResponse || pendingResponse.responderId !== playerId) {
    return false;
  }

  const sourceEffect = pendingResponse.sourceEffect;
  const damageContext = sourceEffect?.context;
  if (!damageContext || damageContext.responsePolicy !== "acid-base") {
    return false;
  }

  const damageKind = getAcidBaseDamageTag(damageContext);
  if (!damageKind) {
    return false;
  }

  const isCarbonateResponse =
    damageKind === "acid" && canGenerateCarbonDioxideAgainstAcid(damageKind, definition);

  if (!canNeutralize(damageKind, definition) && !isCarbonateResponse) {
    return false;
  }

  const event = createAcidBaseResponseReactionEvent({
    context: damageContext,
    responsePlayerId: playerId,
    responseCardInstanceId: cardInstanceId,
    responseCardDefinitionId: definition.id,
    responseKind: isCarbonateResponse ? "carbonate" : "neutralization",
  });
  return Boolean(event);
}

export function validatePassResponseAction(
  state: GameState,
  playerId: PlayerId,
): boolean {
  if (state.phase !== "responseWindow") {
    return false;
  }

  if (isMultiTargetPendingResponse(state)) {
    return Boolean(getValidMultiTargetPendingResponse(state, playerId));
  }

  const pendingResponse = state.pendingResponse;
  if (!pendingResponse || pendingResponse.responderId !== playerId) {
    return false;
  }

  const sourceEffect = pendingResponse.sourceEffect;
  if (!sourceEffect) {
    return false;
  }

  const responder = getPlayer(state, playerId);
  const target = getPlayer(state, sourceEffect.context.targetPlayerId);
  return Boolean(responder && !responder.eliminated && target && !target.eliminated);
}

export function validateHandleStatusWithCardAction(
  state: GameState,
  playerId: PlayerId,
  statusInstanceId: string,
  cardInstanceId: CardInstanceId,
): boolean {
  if (state.phase !== "statusWindow" || state.activePlayerId !== playerId) {
    return false;
  }

  const pending = state.pendingStatusHandling;
  if (!pending || pending.playerId !== playerId || pending.statusInstanceId !== statusInstanceId) {
    return false;
  }

  const player = getPlayer(state, playerId);
  if (!player || player.eliminated || !player.hand.includes(cardInstanceId)) {
    return false;
  }

  const instance = state.cardInstances[cardInstanceId];
  if (
    !instance ||
    instance.ownerId !== playerId ||
    instance.zone.type !== "hand" ||
    instance.zone.playerId !== playerId
  ) {
    return false;
  }

  const status = player.statuses.find((s) => s.id === statusInstanceId);
  if (!status) {
    return false;
  }

  const definition = definitionsById.get(instance.definitionId);
  if (!definition) {
    return false;
  }

  const canHandleSo2Leak =
    status.statusId === "SO2_LEAK" &&
    definition.allowedTimings.includes("status-window") &&
    definition.tags.includes("alkaline-absorb");
  const canHandleFire =
    status.statusId === "FIRE" &&
    (definition.id === "substance_h2o" || definition.id === "substance_co2") &&
    definition.allowedTimings.includes("status-window") &&
    definition.tags.includes("fire-extinguish");

  return canHandleSo2Leak || canHandleFire;
}

export function validatePassStatusHandlingAction(
  state: GameState,
  playerId: PlayerId,
  statusInstanceId: string,
): boolean {
  if (state.phase !== "statusWindow" || state.activePlayerId !== playerId) {
    return false;
  }

  const pending = state.pendingStatusHandling;
  if (!pending || pending.playerId !== playerId || pending.statusInstanceId !== statusInstanceId) {
    return false;
  }

  const player = getPlayer(state, playerId);
  if (!player || player.eliminated) {
    return false;
  }

  const status = player.statuses.find((s) => s.id === statusInstanceId);
  return Boolean(status && (status.statusId === "SO2_LEAK" || status.statusId === "FIRE"));
}

export function validateExperimentCounterattackAction(
  state: GameState,
  action: ResolveExperimentCounterattackAction,
): boolean {
  if (state.phase !== "experimentCounterattackWindow") {
    return false;
  }

  const pending = getValidPendingExperimentCounterattack(state, action.playerId);
  if (!pending) {
    return false;
  }

  const responder = getPlayer(state, action.playerId);
  const attacker = getPlayer(state, pending.attackerPlayerId);
  if (!responder || responder.eliminated || !attacker || attacker.eliminated) {
    return false;
  }

  if (action.option === "recover") {
    return pending.legalOptions.includes("recover") && canRecoverHp(responder);
  }

  if (action.option === "acid-base-pursuit") {
    if (
      !pending.legalOptions.includes("acid-base-pursuit") ||
      !pending.legalPursuitCardInstanceIds.includes(action.cardInstanceId)
    ) {
      return false;
    }
    const instance = state.cardInstances[action.cardInstanceId];
    const definition = instance ? definitionsById.get(instance.definitionId) : undefined;
    return Boolean(definition && isLegalExperimentCounterattackPursuitDefinition(definition));
  }

  if (action.option === "metal-counterattack") {
    return false;
  }

  return false;
}

export function validateConfirmLaboratoryPreparationAction(
  state: GameState,
  playerId: PlayerId,
  keptCardInstanceIds: CardInstanceId[],
): boolean {
  return isValidLaboratoryPreparationConfirmation(state, playerId, keptCardInstanceIds);
}

export function validateGameAction(state: GameState, action: GameAction): boolean {
  switch (action.type) {
    case "PASS_ACTION":
      return validatePassAction(state, action.playerId);
    case "PLAY_REFERENCE_CARD":
      return validatePlayReferenceCardAction(state, action.playerId, action.cardInstanceId);
    case "PLAY_CARD":
      return validatePlayCardAction(
        state,
        action.playerId,
        action.cardInstanceId,
        action.targetPlayerId,
      );
    case "ACTIVATE_CHARACTER_SKILL":
      return validateCharacterSkillAction(state, action);
    case "PLAY_DIY_SELECTION":
      return validatePlayDiySelectionAction(
        state,
        action.playerId,
        action.componentCardInstanceIds,
        action.targetPlayerId,
      );
    case "START_ACTIVE_DIY":
      return false;
    case "RESPOND_WITH_CARD":
      return validateRespondWithCardAction(state, action.playerId, action.cardInstanceId);
    case "PASS_RESPONSE":
      return validatePassResponseAction(state, action.playerId);
    case "HANDLE_STATUS_WITH_CARD":
      return validateHandleStatusWithCardAction(
        state,
        action.playerId,
        action.statusInstanceId,
        action.cardInstanceId,
      );
    case "PASS_STATUS_HANDLING":
      return validatePassStatusHandlingAction(
        state,
        action.playerId,
        action.statusInstanceId,
      );
    case "RESOLVE_EXPERIMENT_COUNTERATTACK":
      return validateExperimentCounterattackAction(state, action);
    case "CONFIRM_LABORATORY_PREPARATION":
      return validateConfirmLaboratoryPreparationAction(
        state,
        action.playerId,
        action.keptCardInstanceIds,
      );
    default: {
      const exhaustiveAction: never = action;
      return exhaustiveAction;
    }
  }
}

export function getLegalActions(
  state: GameState,
  playerId: PlayerId,
): readonly GameAction[] {
  if (state.phase === "gameOver") {
    return [];
  }

  const player = getPlayer(state, playerId);
  if (!player || player.eliminated) {
    return [];
  }

  const legalActions: GameAction[] = [];

  if (state.phase === "mainAction" && state.activePlayerId === playerId) {
    if (validatePassAction(state, playerId)) {
      legalActions.push({ type: "PASS_ACTION", playerId });
    }

    const aliveOpponents = getOtherAlivePlayers(state, playerId);

    for (const cardInstanceId of player.hand) {
      const instance = state.cardInstances[cardInstanceId];
      const definition = instance ? definitionsById.get(instance.definitionId) : undefined;
      if (!definition) {
        continue;
      }

      if (definition.allowedTimings.includes("main-action")) {
        if (definition.id === "substance_o2") {
          if (validatePlayCardAction(state, playerId, cardInstanceId, playerId)) {
            legalActions.push({
              type: "PLAY_CARD",
              playerId,
              cardInstanceId,
              targetPlayerId: playerId,
            });
          }
        } else {
          for (const opponent of aliveOpponents) {
            if (validatePlayCardAction(state, playerId, cardInstanceId, opponent.id)) {
              legalActions.push({
                type: "PLAY_CARD",
                playerId,
                cardInstanceId,
                targetPlayerId: opponent.id,
              });
            }
          }
        }
      }

      if (validatePlayReferenceCardAction(state, playerId, cardInstanceId)) {
        legalActions.push({
          type: "PLAY_REFERENCE_CARD",
          playerId,
          cardInstanceId,
        });
      }
    }

    const skillActions = getLegalCharacterSkillActions(state, playerId);
    legalActions.push(...skillActions);

    if (!player.usedDIYThisCycle) {
      for (const size of registeredDiyComponentSizes) {
        if (size <= player.hand.length) {
          const combinations = getCombinations(player.hand, size);
          for (const combo of combinations) {
            if (validatePlayDiySelectionAction(state, playerId, combo, undefined)) {
              legalActions.push({
                type: "PLAY_DIY_SELECTION",
                playerId,
                componentCardInstanceIds: combo,
              });
            }

            for (const opponent of aliveOpponents) {
              if (validatePlayDiySelectionAction(state, playerId, combo, opponent.id)) {
                legalActions.push({
                  type: "PLAY_DIY_SELECTION",
                  playerId,
                  componentCardInstanceIds: combo,
                  targetPlayerId: opponent.id,
                });
              }
            }
          }
        }
      }
    }

    return legalActions;
  }

  if (state.phase === "responseWindow") {
    const expectedResponderId = state.pendingResponse?.responderId;
    if (expectedResponderId !== playerId) {
      return [];
    }

    for (const cardInstanceId of player.hand) {
      if (validateRespondWithCardAction(state, playerId, cardInstanceId)) {
        legalActions.push({
          type: "RESPOND_WITH_CARD",
          playerId,
          cardInstanceId,
        });
      }
    }

    if (validatePassResponseAction(state, playerId)) {
      legalActions.push({ type: "PASS_RESPONSE", playerId });
    }

    return legalActions;
  }

  if (state.phase === "statusWindow" && state.activePlayerId === playerId) {
    const pending = state.pendingStatusHandling;
    if (!pending || pending.playerId !== playerId) {
      return [];
    }

    for (const cardInstanceId of player.hand) {
      if (
        validateHandleStatusWithCardAction(
          state,
          playerId,
          pending.statusInstanceId,
          cardInstanceId,
        )
      ) {
        legalActions.push({
          type: "HANDLE_STATUS_WITH_CARD",
          playerId,
          statusInstanceId: pending.statusInstanceId,
          cardInstanceId,
        });
      }
    }

    if (validatePassStatusHandlingAction(state, playerId, pending.statusInstanceId)) {
      legalActions.push({
        type: "PASS_STATUS_HANDLING",
        playerId,
        statusInstanceId: pending.statusInstanceId,
      });
    }

    return legalActions;
  }

  if (state.phase === "experimentCounterattackWindow") {
    const pending = state.pendingExperimentCounterattack;
    if (!pending || pending.responderPlayerId !== playerId) {
      return [];
    }

    const recoverAction: ResolveExperimentCounterattackAction = {
      type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
      playerId,
      option: "recover",
    };
    if (validateExperimentCounterattackAction(state, recoverAction)) {
      legalActions.push(recoverAction);
    }

    for (const cardInstanceId of pending.legalPursuitCardInstanceIds) {
      const pursuitAction: ResolveExperimentCounterattackAction = {
        type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
        playerId,
        option: "acid-base-pursuit",
        cardInstanceId,
      };
      if (validateExperimentCounterattackAction(state, pursuitAction)) {
        legalActions.push(pursuitAction);
      }
    }

    return legalActions;
  }

  return [];
}
