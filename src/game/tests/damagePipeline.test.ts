import { describe, expect, it } from "vitest";
import {
  applyDamage,
  normalDamageCap,
  resolveNormalDamage,
  type DamageModifierSet,
  type DamageModifierSource,
} from "../engine/damage";
import { createStatusDamageContext } from "../engine/damageContext";
import type { DamageContext, DamageEffect } from "../engine/types";
import { identityShuffle } from "../../shared/random";
import { createMvp0TestGame as createInitialGame } from "./createTestGame";

const attackerModifierSource = {
  kind: "character-skill",
  sourcePlayerId: "player_1",
  skillId: "acid_corrosion",
} satisfies DamageModifierSource;

const defenderModifierSource = {
  kind: "character-skill",
  sourcePlayerId: "player_2",
  skillId: "acid_resistant_layer",
} satisfies DamageModifierSource;

function createContext(baseAmount: number): DamageContext {
  return createStatusDamageContext({
    statusInstanceId: "status_pipeline_fire",
    statusId: "FIRE",
    targetPlayerId: "player_2",
    baseAmount,
  });
}

function getStageAmounts(context: DamageContext, modifiers?: DamageModifierSet): number[] {
  return resolveNormalDamage(context, modifiers).trace.map((stage) => stage.outputAmount);
}

describe("Phase 8C-1 normal DAMAGE pipeline", () => {
  it.each([0, 1, 2, 3])("keeps unmodified %s DAMAGE behavior-equivalent", (baseAmount) => {
    const result = resolveNormalDamage(createContext(baseAmount));

    expect(result.finalAmount).toBe(baseAmount);
    expect(result.trace).toHaveLength(8);
  });

  it("caps ordinary DAMAGE above 3", () => {
    const result = resolveNormalDamage(createContext(9));

    expect(result.finalAmount).toBe(normalDamageCap);
    expect(result.trace[6]).toMatchObject({
      stage: "cap",
      inputAmount: 9,
      outputAmount: 3,
      cap: 3,
    });
  });

  it("applies the set-value stage before additive increase", () => {
    const modifiers: DamageModifierSet = {
      setValue: { source: attackerModifierSource, amount: 2 },
      increase: { source: attackerModifierSource, amount: 1 },
    };
    const result = resolveNormalDamage(createContext(1), modifiers);

    expect(result.finalAmount).toBe(3);
    expect(result.trace[1]).toMatchObject({
      stage: "set-value",
      inputAmount: 1,
      outputAmount: 2,
      modifier: modifiers.setValue,
    });
    expect(result.trace[2]).toMatchObject({
      stage: "increase",
      inputAmount: 2,
      outputAmount: 3,
      modifier: modifiers.increase,
    });
  });

  it("resolves immunity to 0 and skips an explicit minimum", () => {
    const modifiers: DamageModifierSet = {
      immunity: { source: defenderModifierSource },
      minimum: { source: defenderModifierSource, amount: 1 },
    };
    const result = resolveNormalDamage(createContext(2), modifiers);

    expect(result.finalAmount).toBe(0);
    expect(result.trace[3]).toMatchObject({
      stage: "immunity",
      inputAmount: 2,
      outputAmount: 0,
      modifier: modifiers.immunity,
    });
    expect(result.trace[5]).toMatchObject({
      stage: "minimum",
      inputAmount: 0,
      outputAmount: 0,
      skippedByImmunity: true,
    });
  });

  it("allows reduction to reach 0 when no minimum is specified", () => {
    const result = resolveNormalDamage(createContext(1), {
      reduction: { source: defenderModifierSource, amount: 2 },
    });

    expect(result.finalAmount).toBe(0);
    expect(result.trace[4]).toMatchObject({
      stage: "reduction",
      inputAmount: 1,
      outputAmount: 0,
    });
  });

  it("applies an explicit non-immune minimum after reduction", () => {
    const result = resolveNormalDamage(createContext(1), {
      reduction: { source: defenderModifierSource, amount: 2 },
      minimum: { source: defenderModifierSource, amount: 1 },
    });

    expect(result.finalAmount).toBe(1);
    expect(result.trace[5]).toMatchObject({
      stage: "minimum",
      inputAmount: 0,
      outputAmount: 1,
      skippedByImmunity: false,
    });
  });

  it("preserves the frozen eight-stage order when all numeric stages are present", () => {
    const context = createContext(1);
    const modifiers: DamageModifierSet = {
      setValue: { source: attackerModifierSource, amount: 4 },
      increase: { source: attackerModifierSource, amount: 3 },
      reduction: { source: defenderModifierSource, amount: 2 },
      minimum: { source: defenderModifierSource, amount: 1 },
    };
    const result = resolveNormalDamage(context, modifiers);

    expect(result.trace.map((stage) => stage.stage)).toEqual([
      "base",
      "set-value",
      "increase",
      "immunity",
      "reduction",
      "minimum",
      "cap",
      "final",
    ]);
    expect(getStageAmounts(context, modifiers)).toEqual([1, 4, 7, 7, 5, 5, 3, 3]);
    expect(result.finalAmount).toBe(3);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid baseAmount %s before resolution",
    (baseAmount) => {
      const context = { ...createContext(1), baseAmount };

      expect(() => resolveNormalDamage(context)).toThrow("finite non-negative");
    },
  );

  it.each([
    ["setValue", -1],
    ["increase", Number.NaN],
    ["reduction", Number.POSITIVE_INFINITY],
    ["minimum", -1],
  ] as const)("rejects invalid %s modifier values", (stage, amount) => {
    const modifiers: DamageModifierSet = {
      [stage]: { source: attackerModifierSource, amount },
    };

    expect(() => resolveNormalDamage(createContext(1), modifiers)).toThrow(
      "finite non-negative",
    );
  });

  it("rejects arithmetic overflow before the cap stage", () => {
    expect(() =>
      resolveNormalDamage(createContext(Number.MAX_VALUE), {
        increase: { source: attackerModifierSource, amount: Number.MAX_VALUE },
      }),
    ).toThrow("finite non-negative");
  });

  it("does not mutate DamageContext, readonly tags, modifiers, or trace ordering", () => {
    const context = createContext(2);
    const modifiers: DamageModifierSet = {
      increase: { source: attackerModifierSource, amount: 1 },
      reduction: { source: defenderModifierSource, amount: 1 },
    };
    const contextSnapshot = structuredClone(context);
    const modifierSnapshot = structuredClone(modifiers);

    const first = resolveNormalDamage(context, modifiers);
    const second = resolveNormalDamage(context, modifiers);

    expect(context).toEqual(contextSnapshot);
    expect(modifiers).toEqual(modifierSnapshot);
    expect(first).toEqual(second);
    expect(context.tags).toEqual(["status", "fire"]);
  });

  it("accepts 0 DAMAGE without changing HP, elimination, phase, game result, or logs", () => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const target = state.players[1];
    const effect: DamageEffect = {
      type: "DAMAGE",
      context: createStatusDamageContext({
        statusInstanceId: "status_zero_fire",
        statusId: "FIRE",
        targetPlayerId: target.id,
        baseAmount: 0,
      }),
    };

    const applied = applyDamage(state, effect);

    expect(applied.resolution.finalAmount).toBe(0);
    expect(applied.state).toBe(state);
    expect(applied.state.players[1]).toMatchObject({ hp: target.hp, eliminated: false });
    expect(applied.state.phase).toBe(state.phase);
    expect(applied.state.winnerPlayerId).toBeUndefined();
    expect(applied.state.isDraw).toBeUndefined();
    expect(applied.state.log).toBe(state.log);
  });

  it("applies only the resolved final amount to HP", () => {
    const state = createInitialGame({ shuffle: identityShuffle });
    const target = state.players[1];
    const effect: DamageEffect = {
      type: "DAMAGE",
      context: createContext(2),
    };

    const applied = applyDamage(state, effect, {
      increase: { source: attackerModifierSource, amount: 5 },
    });

    expect(applied.resolution.finalAmount).toBe(3);
    expect(applied.state.players[1].hp).toBe(target.hp - 3);
    expect(applied.state.players[1].eliminated).toBe(false);
  });
});
