import { cardDefinitionsById } from "../data/cardDefinitions";
import { diyRecipes } from "../data/diyRecipes";
import {
  reactionDefinitions,
  type ReactionDefinitionId,
} from "../data/reactions";
import { getAllowedDrawCount } from "./handCapacity";
import type {
  CardDefinition,
  CardDefinitionId,
  CardInstanceId,
  DamageContext,
  GameState,
  PlayerId,
} from "./types";
import {
  drawCardsForPlayer,
  getAvailableDrawCardCount,
  type ShuffleFunction,
} from "./turnFlow";
import { appendEvent } from "./logEvents";

type AttackingCardParticipant = Readonly<{
  kind: "card";
  playerId: PlayerId;
  cardInstanceId: CardInstanceId;
  cardDefinitionId: CardDefinitionId;
  role: "attacker";
}>;

type RespondingCardParticipant = Readonly<{
  kind: "card";
  playerId: PlayerId;
  cardInstanceId: CardInstanceId;
  cardDefinitionId: CardDefinitionId;
  role: "responder";
}>;

type StatusHandlingCardParticipant = Readonly<{
  kind: "card";
  playerId: PlayerId;
  cardInstanceId: CardInstanceId;
  cardDefinitionId: CardDefinitionId;
  role: "status-handler";
}>;

type DiyAttackParticipant = Readonly<{
  kind: "diy";
  playerId: PlayerId;
  recipeId: string;
  role: "attacker";
}>;

type CharacterSkillParticipant = Readonly<{
  kind: "character-skill";
  sourcePlayerId: PlayerId;
  skillId: "exhaust_leak";
  role: "attacker";
}>;

type StatusParticipant = Readonly<{
  kind: "status";
  targetPlayerId: PlayerId;
  statusInstanceId: string;
  statusId: "SO2_LEAK";
  role: "affected-status";
}>;

export type ReactionParticipant =
  | AttackingCardParticipant
  | RespondingCardParticipant
  | StatusHandlingCardParticipant
  | DiyAttackParticipant
  | CharacterSkillParticipant
  | StatusParticipant;

export type ReactionTrigger =
  | Readonly<{
      kind: "single-damage-response";
      responsePolicy: "acid-base";
    }>
  | Readonly<{
      kind: "multi-target-damage-response";
      sourceSkillId: "exhaust_leak";
    }>
  | Readonly<{
      kind: "status-handling";
      statusId: "SO2_LEAK";
    }>;

type VirtualProductOutcome = Readonly<{
  kind: "virtual-product";
  product: "H2O" | "CO2";
  damageCancelled: true;
}>;

type DamageCancelledOutcome = Readonly<{
  kind: "damage-cancelled";
  finalDamage: 0;
}>;

type StatusRemovedOutcome = Readonly<{
  kind: "status-removed";
  targetPlayerId: PlayerId;
  statusInstanceId: string;
  statusId: "SO2_LEAK";
}>;

export type ReactionOutcome =
  | VirtualProductOutcome
  | DamageCancelledOutcome
  | StatusRemovedOutcome;

type AcidBaseAttackParticipant = AttackingCardParticipant | DiyAttackParticipant;

export type SuccessfulReactionEvent =
  | Readonly<{
      definitionId: "acid_base_neutralization";
      trigger: Extract<ReactionTrigger, { kind: "single-damage-response" }>;
      participants: readonly [AcidBaseAttackParticipant, RespondingCardParticipant];
      outcome: VirtualProductOutcome & Readonly<{ product: "H2O" }>;
    }>
  | Readonly<{
      definitionId: "acid_carbonate_co2";
      trigger: Extract<ReactionTrigger, { kind: "single-damage-response" }>;
      participants: readonly [AcidBaseAttackParticipant, RespondingCardParticipant];
      outcome: VirtualProductOutcome & Readonly<{ product: "CO2" }>;
    }>
  | Readonly<{
      definitionId: "so2_alkaline_absorption";
      trigger: Extract<ReactionTrigger, { kind: "multi-target-damage-response" }>;
      participants: readonly [CharacterSkillParticipant, RespondingCardParticipant];
      outcome: DamageCancelledOutcome;
    }>
  | Readonly<{
      definitionId: "so2_alkaline_absorption";
      trigger: Extract<ReactionTrigger, { kind: "status-handling" }>;
      participants: readonly [StatusParticipant, StatusHandlingCardParticipant];
      outcome: StatusRemovedOutcome;
    }>;

type SingleDamageResponseReactionEvent = Extract<
  SuccessfulReactionEvent,
  { trigger: { kind: "single-damage-response" } }
>;
type MultiTargetDamageResponseReactionEvent = Extract<
  SuccessfulReactionEvent,
  { trigger: { kind: "multi-target-damage-response" } }
>;
type StatusHandlingReactionEvent = Extract<
  SuccessfulReactionEvent,
  { trigger: { kind: "status-handling" } }
>;

function isSingleDamageResponseReactionEvent(
  event: SuccessfulReactionEvent,
): event is SingleDamageResponseReactionEvent {
  return event.trigger.kind === "single-damage-response";
}

function isMultiTargetDamageResponseReactionEvent(
  event: SuccessfulReactionEvent,
): event is MultiTargetDamageResponseReactionEvent {
  return event.trigger.kind === "multi-target-damage-response";
}

function isStatusHandlingReactionEvent(
  event: SuccessfulReactionEvent,
): event is StatusHandlingReactionEvent {
  return event.trigger.kind === "status-handling";
}

const diyRecipesById = new Map(diyRecipes.map((recipe) => [recipe.id, recipe]));
const sulfateIon = "SO4^2-";

function createAttackParticipant(
  context: DamageContext,
): AcidBaseAttackParticipant | undefined {
  if (context.source.kind === "card" && !context.source.sourceSkillId) {
    return {
      kind: "card",
      playerId: context.source.sourcePlayerId,
      cardInstanceId: context.source.cardInstanceId,
      cardDefinitionId: context.source.cardDefinitionId,
      role: "attacker",
    };
  }

  if (context.source.kind === "diy") {
    return {
      kind: "diy",
      playerId: context.source.sourcePlayerId,
      recipeId: context.source.recipeId,
      role: "attacker",
    };
  }

  return undefined;
}

export function createAcidBaseResponseReactionEvent(input: {
  context: DamageContext;
  responsePlayerId: PlayerId;
  responseCardInstanceId: CardInstanceId;
  responseCardDefinitionId: CardDefinitionId;
  responseKind: "neutralization" | "carbonate";
}): SuccessfulReactionEvent | undefined {
  const attackParticipant = createAttackParticipant(input.context);
  if (!attackParticipant) {
    return undefined;
  }

  const responder: RespondingCardParticipant = {
    kind: "card",
    playerId: input.responsePlayerId,
    cardInstanceId: input.responseCardInstanceId,
    cardDefinitionId: input.responseCardDefinitionId,
    role: "responder",
  };

  if (input.responseKind === "carbonate") {
    return {
      definitionId: "acid_carbonate_co2",
      trigger: { kind: "single-damage-response", responsePolicy: "acid-base" },
      participants: [attackParticipant, responder],
      outcome: { kind: "virtual-product", product: "CO2", damageCancelled: true },
    };
  }

  return {
    definitionId: "acid_base_neutralization",
    trigger: { kind: "single-damage-response", responsePolicy: "acid-base" },
    participants: [attackParticipant, responder],
    outcome: { kind: "virtual-product", product: "H2O", damageCancelled: true },
  };
}

export function createImmediateSo2AbsorptionReactionEvent(input: {
  context: DamageContext;
  responsePlayerId: PlayerId;
  responseCardInstanceId: CardInstanceId;
  responseCardDefinitionId: CardDefinitionId;
}): SuccessfulReactionEvent | undefined {
  if (
    input.context.source.kind !== "character-skill" ||
    input.context.source.skillId !== "exhaust_leak"
  ) {
    return undefined;
  }

  return {
    definitionId: "so2_alkaline_absorption",
    trigger: {
      kind: "multi-target-damage-response",
      sourceSkillId: "exhaust_leak",
    },
    participants: [
      {
        kind: "character-skill",
        sourcePlayerId: input.context.source.sourcePlayerId,
        skillId: input.context.source.skillId,
        role: "attacker",
      },
      {
        kind: "card",
        playerId: input.responsePlayerId,
        cardInstanceId: input.responseCardInstanceId,
        cardDefinitionId: input.responseCardDefinitionId,
        role: "responder",
      },
    ],
    outcome: { kind: "damage-cancelled", finalDamage: 0 },
  };
}

export function createSo2StatusHandlingReactionEvent(input: {
  targetPlayerId: PlayerId;
  statusInstanceId: string;
  handlerCardInstanceId: CardInstanceId;
  handlerCardDefinitionId: CardDefinitionId;
}): SuccessfulReactionEvent {
  return {
    definitionId: "so2_alkaline_absorption",
    trigger: { kind: "status-handling", statusId: "SO2_LEAK" },
    participants: [
      {
        kind: "status",
        targetPlayerId: input.targetPlayerId,
        statusInstanceId: input.statusInstanceId,
        statusId: "SO2_LEAK",
        role: "affected-status",
      },
      {
        kind: "card",
        playerId: input.targetPlayerId,
        cardInstanceId: input.handlerCardInstanceId,
        cardDefinitionId: input.handlerCardDefinitionId,
        role: "status-handler",
      },
    ],
    outcome: {
      kind: "status-removed",
      targetPlayerId: input.targetPlayerId,
      statusInstanceId: input.statusInstanceId,
      statusId: "SO2_LEAK",
    },
  };
}

function isKnownReactionDefinitionId(
  definitionId: ReactionDefinitionId,
): boolean {
  return reactionDefinitions.some((definition) => definition.id === definitionId);
}

function isValidCardSnapshotBeforeReaction(
  state: GameState,
  participant: Extract<ReactionParticipant, { kind: "card" }>,
): boolean {
  const player = state.players.find((candidate) => candidate.id === participant.playerId);
  const instance = state.cardInstances[participant.cardInstanceId];

  return Boolean(
    player &&
      !player.eliminated &&
      player.hand.includes(participant.cardInstanceId) &&
      instance &&
      instance.definitionId === participant.cardDefinitionId &&
      instance.ownerId === participant.playerId &&
      instance.zone.type === "hand" &&
      instance.zone.playerId === participant.playerId &&
      cardDefinitionsById.has(participant.cardDefinitionId),
  );
}

function isValidParticipantBeforeReaction(
  state: GameState,
  participant: ReactionParticipant,
): boolean {
  if (participant.kind === "card") {
    return isValidCardSnapshotBeforeReaction(state, participant);
  }

  if (participant.kind === "diy") {
    const player = state.players.find((candidate) => candidate.id === participant.playerId);
    const recipe = diyRecipesById.get(participant.recipeId);
    return Boolean(player && !player.eliminated && recipe?.result === "VIRTUAL_ATTACK");
  }

  if (participant.kind === "character-skill") {
    const player = state.players.find(
      (candidate) => candidate.id === participant.sourcePlayerId,
    );
    return Boolean(player && !player.eliminated && participant.skillId === "exhaust_leak");
  }

  const player = state.players.find(
    (candidate) => candidate.id === participant.targetPlayerId,
  );
  return Boolean(
    player &&
      !player.eliminated &&
      participant.statusId === "SO2_LEAK" &&
      player.statuses.some(
        (status) =>
          status.id === participant.statusInstanceId &&
          status.statusId === participant.statusId,
      ),
  );
}

function isCardDiscardedExactlyOnce(
  state: GameState,
  participant: Extract<ReactionParticipant, { kind: "card" }>,
): boolean {
  const instance = state.cardInstances[participant.cardInstanceId];
  const discardOccurrences = state.discardPile.filter(
    (cardId) => cardId === participant.cardInstanceId,
  ).length;

  return Boolean(
    instance &&
      instance.definitionId === participant.cardDefinitionId &&
      instance.ownerId === undefined &&
      instance.zone.type === "discard" &&
      discardOccurrences === 1 &&
      state.players.every(
        (player) => !player.hand.includes(participant.cardInstanceId),
      ),
  );
}

function isResponseDefinitionValid(
  definition: CardDefinition | undefined,
  expected: "acid" | "base" | "carbonate" | "alkaline-absorb",
): boolean {
  if (
    !definition ||
    (definition.type !== "ion" && definition.type !== "substance")
  ) {
    return false;
  }

  if (expected === "alkaline-absorb") {
    return (
      definition.allowedTimings.includes("status-window") &&
      definition.tags.includes("alkaline-absorb")
    );
  }

  if (!definition.allowedTimings.includes("response")) {
    return false;
  }

  return expected === "carbonate"
    ? definition.tags.includes("carbonate")
    : definition.tags.includes(expected);
}

function isAcidBaseEventValid(
  state: GameState,
  event: Extract<
    SuccessfulReactionEvent,
    { definitionId: "acid_base_neutralization" | "acid_carbonate_co2" }
  >,
): boolean {
  const pending = state.pendingResponse;
  const context = pending?.sourceEffect.context;
  const [attacker, responder] = event.participants;
  const responseDefinition = cardDefinitionsById.get(responder.cardDefinitionId);
  const sourceMatches = context?.source.kind === "card"
    ? attacker.kind === "card" &&
      !context.source.sourceSkillId &&
      context.source.sourcePlayerId === attacker.playerId &&
      context.source.cardInstanceId === attacker.cardInstanceId &&
      context.source.cardDefinitionId === attacker.cardDefinitionId
    : context?.source.kind === "diy" &&
      attacker.kind === "diy" &&
      context.source.sourcePlayerId === attacker.playerId &&
      context.source.recipeId === attacker.recipeId;

  if (
    state.phase !== "responseWindow" ||
    !pending ||
    !context ||
    context.responsePolicy !== "acid-base" ||
    pending.responderId !== responder.playerId ||
    context.targetPlayerId !== responder.playerId ||
    !sourceMatches
  ) {
    return false;
  }

  if (event.definitionId === "acid_carbonate_co2") {
    return (
      context.tags.includes("acid") &&
      isResponseDefinitionValid(responseDefinition, "carbonate")
    );
  }

  return context.tags.includes("acid")
    ? isResponseDefinitionValid(responseDefinition, "base")
    : context.tags.includes("base") &&
        isResponseDefinitionValid(responseDefinition, "acid");
}

function isImmediateSo2EventValid(
  state: GameState,
  event: Extract<
    SuccessfulReactionEvent,
    { trigger: { kind: "multi-target-damage-response" } }
  >,
): boolean {
  const pending = state.pendingResponse;
  const context = pending?.sourceEffect.context;
  const [skill, responder] = event.participants;
  const responseDefinition = cardDefinitionsById.get(responder.cardDefinitionId);

  return Boolean(
    state.phase === "responseWindow" &&
      pending?.multiTargetSequence &&
      pending.responderId === responder.playerId &&
      context?.targetPlayerId === responder.playerId &&
      context.responsePolicy === "alkali-absorption" &&
      context.source.kind === "character-skill" &&
      context.source.sourcePlayerId === skill.sourcePlayerId &&
      context.source.skillId === skill.skillId &&
      context.tags.includes("so2") &&
      !context.tags.includes("status") &&
      isResponseDefinitionValid(responseDefinition, "alkaline-absorb"),
  );
}

function isStatusHandlingEventValid(
  state: GameState,
  event: Extract<
    SuccessfulReactionEvent,
    { trigger: { kind: "status-handling" } }
  >,
): boolean {
  const [status, handler] = event.participants;
  const definition = cardDefinitionsById.get(handler.cardDefinitionId);

  return Boolean(
    state.phase === "statusWindow" &&
      state.activePlayerId === status.targetPlayerId &&
      state.pendingStatusHandling?.playerId === status.targetPlayerId &&
      state.pendingStatusHandling.statusInstanceId === status.statusInstanceId &&
      handler.playerId === status.targetPlayerId &&
      event.outcome.targetPlayerId === status.targetPlayerId &&
      event.outcome.statusInstanceId === status.statusInstanceId &&
      isResponseDefinitionValid(definition, "alkaline-absorb"),
  );
}

function isEventSnapshotValidBeforeReaction(
  state: GameState,
  event: SuccessfulReactionEvent,
): boolean {
  if (
    !isKnownReactionDefinitionId(event.definitionId) ||
    !event.participants.every((participant) =>
      isValidParticipantBeforeReaction(state, participant),
    )
  ) {
    return false;
  }

  if (isSingleDamageResponseReactionEvent(event)) {
    return isAcidBaseEventValid(state, event);
  }

  if (isMultiTargetDamageResponseReactionEvent(event)) {
    return isImmediateSo2EventValid(state, event);
  }

  return isStatusHandlingReactionEvent(event) &&
    isStatusHandlingEventValid(state, event);
}

function isEventResolutionValid(
  state: GameState,
  event: SuccessfulReactionEvent,
): boolean {
  const cardsResolved = event.participants
    .filter(
      (participant): participant is Extract<ReactionParticipant, { kind: "card" }> =>
        participant.kind === "card",
    )
    .every((participant) => isCardDiscardedExactlyOnce(state, participant));

  if (!cardsResolved) {
    return false;
  }

  if (!isStatusHandlingReactionEvent(event)) {
    return true;
  }

  return state.players.every(
    (player) =>
      !player.statuses.some(
        (status) => status.id === event.outcome.statusInstanceId,
      ),
  );
}

function appendReactionLog(
  state: GameState,
  reaction: SuccessfulReactionEvent,
): GameState {
  return appendEvent(state, {
    eventKey: "reaction",
    params: {},
    reaction,
  });
}

function markSulfateByproductUsed(state: GameState, playerId: PlayerId): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? {
            ...player,
            characterUsage: {
              ...player.characterUsage,
              perRound: {
                ...player.characterUsage.perRound,
                sulfuric_acid_factory_director_sulfate_byproduct: 1,
              },
            },
          }
        : player,
    ),
  };
}

function getSulfateByproductPlayerIds(
  stateBeforeReaction: GameState,
  event: SuccessfulReactionEvent,
): PlayerId[] {
  const eligiblePlayerIds = event.participants.flatMap((participant) => {
    if (
      participant.kind !== "card" ||
      (participant.role !== "attacker" && participant.role !== "responder")
    ) {
      return [];
    }

    const player = stateBeforeReaction.players.find(
      (candidate) => candidate.id === participant.playerId,
    );
    const definition = cardDefinitionsById.get(participant.cardDefinitionId);

    return player &&
      !player.eliminated &&
      player.characterId === "sulfuric_acid_factory_director" &&
      !player.characterUsage.perRound
        .sulfuric_acid_factory_director_sulfate_byproduct &&
      definition?.type === "substance" &&
      definition.ionsProvided?.includes(sulfateIon)
      ? [player.id]
      : [];
  });

  return [...new Set(eligiblePlayerIds)];
}

function consumeSuccessfulReactionEvent(
  state: GameState,
  stateBeforeReaction: GameState,
  event: SuccessfulReactionEvent,
  shuffle: ShuffleFunction,
): GameState {
  let nextState = state;
  let availableDrawsRemaining = getAvailableDrawCardCount(stateBeforeReaction);

  for (const playerId of getSulfateByproductPlayerIds(stateBeforeReaction, event)) {
    const player = nextState.players.find((candidate) => candidate.id === playerId);

    if (
      !player ||
      player.eliminated ||
      player.characterUsage.perRound
        .sulfuric_acid_factory_director_sulfate_byproduct ||
      availableDrawsRemaining <= 0 ||
      getAllowedDrawCount(player, 1) !== 1
    ) {
      continue;
    }

    const handSizeBeforeDraw = player.hand.length;
    const drawnState = drawCardsForPlayer(nextState, playerId, 1, shuffle);
    const playerAfterDraw = drawnState.players.find(
      (candidate) => candidate.id === playerId,
    );

    if (playerAfterDraw?.hand.length !== handSizeBeforeDraw + 1) {
      nextState = drawnState;
      continue;
    }

    availableDrawsRemaining -= 1;
    nextState = appendEvent(
      markSulfateByproductUsed(drawnState, playerId),
      {
        eventKey: "sulfate_byproduct_draw",
        params: { playerId },
      },
    );
  }

  return nextState;
}

export function recordSuccessfulReaction(input: {
  stateBeforeReaction: GameState;
  resolvedState: GameState;
  event: SuccessfulReactionEvent;
  shuffle: ShuffleFunction;
}): GameState {
  if (
    !isEventSnapshotValidBeforeReaction(input.stateBeforeReaction, input.event) ||
    !isEventResolutionValid(input.resolvedState, input.event)
  ) {
    return input.stateBeforeReaction;
  }

  const withReactionLog = appendReactionLog(
    input.resolvedState,
    input.event,
  );

  return consumeSuccessfulReactionEvent(
    withReactionLog,
    input.stateBeforeReaction,
    input.event,
    input.shuffle,
  );
}
