import type {
  CharacterSkillId,
  DamageContext,
  DamageEffect,
  GameState,
  PlayerId,
} from "./types";
import { collectDamageModifiers } from "./damageModifiers";
import { appendEvent } from "./logEvents";

export const normalDamageCap = 3;

export type DamageModifierSource = Readonly<{
  kind: "character-skill";
  sourcePlayerId: PlayerId;
  skillId: CharacterSkillId;
}>;

export type DamageAmountModifier = Readonly<{
  source: DamageModifierSource;
  amount: number;
}>;

export type DamageImmunityModifier = Readonly<{
  source: DamageModifierSource;
}>;

export type DamageModifierSet = Readonly<{
  setValue?: DamageAmountModifier;
  increase?: DamageAmountModifier;
  immunity?: DamageImmunityModifier;
  reduction?: DamageAmountModifier;
  minimum?: DamageAmountModifier;
}>;

type DamageAmountStage<
  Stage extends "set-value" | "increase" | "reduction" | "minimum",
> = Readonly<{
  stage: Stage;
  inputAmount: number;
  outputAmount: number;
  modifier?: DamageAmountModifier;
}>;

export type DamageResolutionTrace = readonly [
  Readonly<{
    stage: "base";
    inputAmount: number;
    outputAmount: number;
  }>,
  DamageAmountStage<"set-value">,
  DamageAmountStage<"increase">,
  Readonly<{
    stage: "immunity";
    inputAmount: number;
    outputAmount: number;
    modifier?: DamageImmunityModifier;
  }>,
  DamageAmountStage<"reduction">,
  DamageAmountStage<"minimum"> & Readonly<{ skippedByImmunity: boolean }>,
  Readonly<{
    stage: "cap";
    inputAmount: number;
    outputAmount: number;
    cap: typeof normalDamageCap;
  }>,
  Readonly<{
    stage: "final";
    inputAmount: number;
    outputAmount: number;
  }>,
];

export type DamageResolution = Readonly<{
  finalAmount: number;
  trace: DamageResolutionTrace;
}>;

export type AppliedDamage = Readonly<{
  state: GameState;
  resolution: DamageResolution;
}>;

const noDamageModifiers: DamageModifierSet = {};

function assertFiniteNonNegative(label: string, amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} must be a finite non-negative number.`);
}

function validateModifiers(m: DamageModifierSet): void {
  if (m.setValue) assertFiniteNonNegative("Damage set value", m.setValue.amount);
  if (m.increase) assertFiniteNonNegative("Damage increase", m.increase.amount);
  if (m.reduction) assertFiniteNonNegative("Damage reduction", m.reduction.amount);
  if (m.minimum) assertFiniteNonNegative("Damage minimum", m.minimum.amount);
}

export function resolveNormalDamage(
  context: DamageContext,
  modifiers: DamageModifierSet = noDamageModifiers,
): DamageResolution {
  assertFiniteNonNegative("Damage baseAmount", context.baseAmount);
  validateModifiers(modifiers);

  const baseAmount = context.baseAmount;
  const setValueAmount = modifiers.setValue?.amount ?? baseAmount;
  const increasedAmount = setValueAmount + (modifiers.increase?.amount ?? 0);
  assertFiniteNonNegative("Damage after increase", increasedAmount);

  const isImmune = modifiers.immunity !== undefined;
  const afterImmunityAmount = isImmune ? 0 : increasedAmount;
  const reducedAmount = isImmune ? 0 : Math.max(0, afterImmunityAmount - (modifiers.reduction?.amount ?? 0));
  const minimumAmount = isImmune ? 0 : modifiers.minimum ? Math.max(reducedAmount, modifiers.minimum.amount) : reducedAmount;
  const cappedAmount = Math.min(minimumAmount, normalDamageCap);
  const finalAmount = cappedAmount;
  assertFiniteNonNegative("Final DAMAGE", finalAmount);

  return {
    finalAmount,
    trace: [
      { stage: "base", inputAmount: baseAmount, outputAmount: baseAmount },
      { stage: "set-value", inputAmount: baseAmount, outputAmount: setValueAmount, modifier: modifiers.setValue },
      { stage: "increase", inputAmount: setValueAmount, outputAmount: increasedAmount, modifier: modifiers.increase },
      { stage: "immunity", inputAmount: increasedAmount, outputAmount: afterImmunityAmount, modifier: modifiers.immunity },
      { stage: "reduction", inputAmount: afterImmunityAmount, outputAmount: reducedAmount, modifier: modifiers.reduction },
      { stage: "minimum", inputAmount: reducedAmount, outputAmount: minimumAmount, modifier: modifiers.minimum, skippedByImmunity: isImmune },
      { stage: "cap", inputAmount: minimumAmount, outputAmount: cappedAmount, cap: normalDamageCap },
      { stage: "final", inputAmount: cappedAmount, outputAmount: finalAmount },
    ],
  };
}

export function applyDamage(
  state: GameState,
  effect: DamageEffect,
): AppliedDamage {
  const modifiers = collectDamageModifiers(state, effect.context);
  const resolution = resolveNormalDamage(effect.context, modifiers);
  const target = state.players.find((player) => player.id === effect.context.targetPlayerId);

  if (!target || target.eliminated || resolution.finalAmount === 0) {
    return { state, resolution };
  }

  const nextHp = Math.max(0, target.hp - resolution.finalAmount);
  const isEliminated = nextHp === 0;
  const nextState: GameState = {
    ...state,
    players: state.players.map((player) =>
      player.id === target.id
        ? {
            ...player,
            hp: nextHp,
            eliminated: isEliminated,
          }
        : player,
    ),
  };

  return {
    state:
      isEliminated && !target.eliminated
        ? appendEvent(nextState, {
            eventKey: "eliminated",
            params: { playerId: target.id },
          })
        : nextState,
    resolution,
  };
}
