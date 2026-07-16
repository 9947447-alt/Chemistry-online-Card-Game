import type {
  CardDefinition,
  CardInstanceId,
  CharacterSkillId,
  DamageContext,
  DamageSource,
  DamageTag,
  PlayerId,
  StatusId,
} from "./types";

const damageTagOrder = [
  "acid",
  "base",
  "strong-acid",
  "strong-alkali",
  "status",
  "so2",
  "fire",
] satisfies readonly DamageTag[];

function normalizeDamageTags(tags: readonly DamageTag[]): DamageTag[] {
  const uniqueTags = new Set(tags);
  return damageTagOrder.filter((tag) => uniqueTags.has(tag));
}

function createDamageContext(
  targetPlayerId: PlayerId,
  baseAmount: number,
  source: DamageSource,
  tags: readonly DamageTag[],
  responsePolicy: DamageContext["responsePolicy"],
): DamageContext {
  if (!Number.isFinite(baseAmount) || baseAmount < 0) {
    throw new Error("Damage baseAmount must be a finite non-negative number.");
  }

  return {
    targetPlayerId,
    baseAmount,
    source,
    tags: normalizeDamageTags(tags),
    responsePolicy,
  };
}

function getCardDamageTags(definition: CardDefinition): DamageTag[] {
  return definition.tags.filter(
    (tag): tag is Extract<DamageTag, "acid" | "base" | "strong-acid" | "strong-alkali"> =>
      tag === "acid" ||
      tag === "base" ||
      tag === "strong-acid" ||
      tag === "strong-alkali",
  );
}

export function createCardDamageContext(input: {
  sourcePlayerId: PlayerId;
  cardInstanceId: CardInstanceId;
  definition: CardDefinition;
  targetPlayerId: PlayerId;
  baseAmount: number;
}): DamageContext {
  const tags = getCardDamageTags(input.definition);

  if (!tags.includes("acid") && !tags.includes("base")) {
    throw new Error("Current card DAMAGE must have an explicit acid or base definition tag.");
  }

  return createDamageContext(
    input.targetPlayerId,
    input.baseAmount,
    {
      kind: "card",
      sourcePlayerId: input.sourcePlayerId,
      cardInstanceId: input.cardInstanceId,
      cardDefinitionId: input.definition.id,
    },
    tags,
    "acid-base",
  );
}

export function createExperimentCounterattackPursuitDamageContext(input: {
  sourcePlayerId: PlayerId;
  cardInstanceId: CardInstanceId;
  definition: CardDefinition;
  targetPlayerId: PlayerId;
  baseAmount: number;
}): DamageContext {
  const tags = getCardDamageTags(input.definition);

  if (!tags.includes("acid") && !tags.includes("base")) {
    throw new Error("Experiment counterattack pursuit requires an explicit acid or base tag.");
  }

  return createDamageContext(
    input.targetPlayerId,
    input.baseAmount,
    {
      kind: "card",
      sourcePlayerId: input.sourcePlayerId,
      cardInstanceId: input.cardInstanceId,
      cardDefinitionId: input.definition.id,
      sourceSkillId: "experiment_counterattack",
    },
    tags,
    "none",
  );
}

export function createDIYDamageContext(input: {
  sourcePlayerId: PlayerId;
  recipeId: string;
  targetPlayerId: PlayerId;
  baseAmount: number;
  damageKind: "acid" | "base";
}): DamageContext {
  return createDamageContext(
    input.targetPlayerId,
    input.baseAmount,
    {
      kind: "diy",
      sourcePlayerId: input.sourcePlayerId,
      recipeId: input.recipeId,
    },
    [input.damageKind],
    "acid-base",
  );
}

export function createStatusDamageContext(input: {
  statusInstanceId: string;
  statusId: StatusId;
  targetPlayerId: PlayerId;
  baseAmount: number;
}): DamageContext {
  const statusTag: Extract<DamageTag, "fire" | "so2"> =
    input.statusId === "FIRE" ? "fire" : "so2";

  return createDamageContext(
    input.targetPlayerId,
    input.baseAmount,
    {
      kind: "status",
      sourcePlayerId: null,
      statusInstanceId: input.statusInstanceId,
      statusId: input.statusId,
    },
    ["status", statusTag],
    "none",
  );
}

export function createExhaustLeakDamageContext(input: {
  sourcePlayerId: PlayerId;
  targetPlayerId: PlayerId;
  baseAmount: number;
  skillId: Extract<CharacterSkillId, "exhaust_leak">;
}): DamageContext {
  return createDamageContext(
    input.targetPlayerId,
    input.baseAmount,
    {
      kind: "character-skill",
      sourcePlayerId: input.sourcePlayerId,
      skillId: input.skillId,
    },
    ["so2"],
    "alkali-absorption",
  );
}

export function getAcidBaseDamageTag(
  context: DamageContext,
): Extract<DamageTag, "acid" | "base"> | undefined {
  if (context.tags.includes("acid")) {
    return "acid";
  }

  if (context.tags.includes("base")) {
    return "base";
  }

  return undefined;
}
