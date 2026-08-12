// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, LocaleSwitch } from "../../../app/locale";
import { createInitialGame } from "../../../game/engine/createInitialGame";
import type { GameState } from "../../../game/engine/types";
import type { SuccessfulReactionEvent } from "../../../game/engine/reactions";
import { identityShuffle } from "../../../shared/random";
import { SuccessfulReactionNotice } from "./SuccessfulReactionNotice";

function createGame(): GameState {
  return createInitialGame({
    characterIds: ["chemical_factory_ceo", "acid_king"],
    shuffle: identityShuffle,
  });
}

function withReaction(
  game: GameState,
  id: string,
  reaction: SuccessfulReactionEvent,
): GameState {
  return {
    ...game,
    log: [...game.log, { id, message: "该中文日志不得成为提示数据源。", reaction }],
  };
}

const acidBaseEvent: SuccessfulReactionEvent = {
  definitionId: "acid_base_neutralization",
  trigger: { kind: "single-damage-response", responsePolicy: "acid-base" },
  participants: [
    {
      kind: "card",
      playerId: "player_1",
      cardInstanceId: "substance_hcl_dilute_01",
      cardDefinitionId: "substance_hcl_dilute",
      role: "attacker",
    },
    {
      kind: "card",
      playerId: "player_2",
      cardInstanceId: "substance_naoh_dilute_01",
      cardDefinitionId: "substance_naoh_dilute",
      role: "responder",
    },
  ],
  outcome: { kind: "virtual-product", product: "H2O", damageCancelled: true },
};

const acidCarbonateEvent: SuccessfulReactionEvent = {
  definitionId: "acid_carbonate_co2",
  trigger: { kind: "single-damage-response", responsePolicy: "acid-base" },
  participants: [
    {
      kind: "card",
      playerId: "player_1",
      cardInstanceId: "substance_hcl_dilute_01",
      cardDefinitionId: "substance_hcl_dilute",
      role: "attacker",
    },
    {
      kind: "card",
      playerId: "player_2",
      cardInstanceId: "ion_co3_01",
      cardDefinitionId: "ion_co3",
      role: "responder",
    },
  ],
  outcome: { kind: "virtual-product", product: "CO2", damageCancelled: true },
};

const immediateSo2Event: SuccessfulReactionEvent = {
  definitionId: "so2_alkaline_absorption",
  trigger: { kind: "multi-target-damage-response", sourceSkillId: "exhaust_leak" },
  participants: [
    {
      kind: "character-skill",
      sourcePlayerId: "player_1",
      skillId: "exhaust_leak",
      role: "attacker",
    },
    {
      kind: "card",
      playerId: "player_2",
      cardInstanceId: "ion_oh_01",
      cardDefinitionId: "ion_oh",
      role: "responder",
    },
  ],
  outcome: { kind: "damage-cancelled", finalDamage: 0 },
};

const statusSo2Event: SuccessfulReactionEvent = {
  definitionId: "so2_alkaline_absorption",
  trigger: { kind: "status-handling", statusId: "SO2_LEAK" },
  participants: [
    {
      kind: "status",
      targetPlayerId: "player_1",
      statusInstanceId: "status_phase15_so2",
      statusId: "SO2_LEAK",
      role: "affected-status",
    },
    {
      kind: "card",
      playerId: "player_1",
      cardInstanceId: "substance_naoh_dilute_01",
      cardDefinitionId: "substance_naoh_dilute",
      role: "status-handler",
    },
  ],
  outcome: {
    kind: "status-removed",
    targetPlayerId: "player_1",
    statusInstanceId: "status_phase15_so2",
    statusId: "SO2_LEAK",
  },
};

beforeEach(() => {
  Object.defineProperty(globalThis.navigator, "language", {
    configurable: true,
    value: "zh-CN",
  });
  Object.defineProperty(globalThis.navigator, "languages", {
    configurable: true,
    value: ["zh-CN"],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Phase 15 successful reaction notice", () => {
  it.each([
    ["no reaction", createGame()],
    ["one historical reaction", withReaction(createGame(), "log_historical_1", acidBaseEvent)],
    [
      "multiple historical reactions",
      withReaction(
        withReaction(createGame(), "log_historical_1", acidBaseEvent),
        "log_historical_2",
        acidCarbonateEvent,
      ),
    ],
  ])("establishes its first observation baseline for %s without showing or timing", async (
    _label,
    game,
  ) => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game }),
      )));
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it.each([
    [acidBaseEvent, "酸碱中和", "伤害已完全抵消；生成虚拟结果 H2O"],
    [acidCarbonateEvent, "酸与碳酸盐", "伤害已完全抵消；生成虚拟结果 CO2"],
    [immediateSo2Event, "SO2 碱性吸收", "伤害已完全抵消"],
    [statusSo2Event, "SO2 碱性吸收", "待处理状态已移除"],
  ])("renders newly appended structured event %# without parsing its Chinese message", async (
    event,
    name,
    outcome,
  ) => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const baseline = createGame();
    const game = withReaction(baseline, "log_phase15_reaction", event);

    try {
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: baseline }),
      )));
      expect(container.querySelector('[role="status"]')).toBeNull();
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game }),
      )));
      const notice = container.querySelector('[role="status"]');
      expect(notice?.getAttribute("aria-live")).toBe("polite");
      expect(notice?.textContent).toContain(`成功反应 · ${name}`);
      expect(notice?.textContent).toContain(outcome);
      expect(notice?.textContent).not.toContain("该中文日志不得成为提示数据源");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("updates an active notice in place on language change without restarting or replaying it", async () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const baseline = createGame();
    const game = withReaction(baseline, "log_phase15_english", acidBaseEvent);

    try {
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(LocaleSwitch),
        createElement(SuccessfulReactionNotice, { game: baseline }),
      )));
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(LocaleSwitch),
        createElement(SuccessfulReactionNotice, { game }),
      )));
      await act(async () => vi.advanceTimersByTime(1500));
      const englishButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "English",
      );
      if (!englishButton) throw new Error("Expected English locale control.");
      await act(async () => englishButton.click());
      expect(container.querySelector('[role="status"]')?.textContent).toContain(
        "Successful reaction · Acid-base neutralization",
      );
      expect(container.querySelector('[role="status"]')?.textContent).toContain(
        "Damage was fully cancelled; virtual result H2O was produced",
      );
      expect(vi.getTimerCount()).toBe(1);
      await act(async () => vi.advanceTimersByTime(499));
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      await act(async () => vi.advanceTimersByTime(1));
      expect(container.querySelector('[role="status"]')).toBeNull();

      const chineseButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "中文",
      );
      if (!chineseButton) throw new Error("Expected Chinese locale control.");
      await act(async () => chineseButton.click());
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("shows only appended reactions, keeps focus, and resets the timer for consecutive events", async () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    const focusTarget = document.createElement("button");
    focusTarget.textContent = "keep focus";
    document.body.append(focusTarget, container);
    focusTarget.focus();
    const root = createRoot(container);
    const baseline = createGame();

    try {
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: baseline }),
      )));
      expect(container.querySelector('[role="status"]')).toBeNull();

      const first = withReaction(baseline, "log_first", acidBaseEvent);
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: first }),
      )));
      expect(container.querySelector('[role="status"]')?.textContent).toContain("酸碱中和");
      expect(document.activeElement).toBe(focusTarget);

      await act(async () => vi.advanceTimersByTime(1900));
      expect(container.querySelector('[role="status"]')).not.toBeNull();

      const second = withReaction(first, "log_second", acidCarbonateEvent);
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: second }),
      )));
      await act(async () => vi.advanceTimersByTime(1900));
      expect(container.querySelector('[role="status"]')?.textContent).toContain("酸与碳酸盐");
      await act(async () => vi.advanceTimersByTime(100));
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(document.activeElement).toBe(focusTarget);

      const logSnapshot = JSON.stringify(second.log);
      expect(JSON.stringify(second.log)).toBe(logSnapshot);
      await act(async () => root.unmount());
      expect(vi.getTimerCount()).toBe(0);
      container.remove();
    } finally {
      if (container.isConnected) await act(async () => root.unmount());
      focusTarget.remove();
      container.remove();
    }
  });

  it("treats a replaced log identity as a new session even when reaction IDs repeat", async () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const firstBaseline = createGame();
    const firstReaction = withReaction(firstBaseline, "log_repeated", acidBaseEvent);
    const secondSessionHistory = withReaction(createGame(), "log_repeated", acidCarbonateEvent);

    try {
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: firstBaseline }),
      )));
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: firstReaction }),
      )));
      expect(container.querySelector('[role="status"]')?.textContent).toContain("酸碱中和");

      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: secondSessionHistory }),
      )));
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(vi.getTimerCount()).toBe(0);

      const freshReaction = withReaction(secondSessionHistory, "log_fresh", statusSo2Event);
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: freshReaction }),
      )));
      expect(container.querySelector('[role="status"]')?.textContent).toContain("SO2 碱性吸收");
      expect(vi.getTimerCount()).toBe(1);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("ignores appended ordinary Chinese and FIRE logs and clears its timer on unmount", async () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const baseline = createGame();
    const ordinaryGame: GameState = {
      ...baseline,
      log: [
        ...baseline.log,
        { id: "log_plain", message: "成功反应：这只是普通中文日志。" },
        { id: "log_fire", message: "玩家使用 H2O 处理 FIRE。" },
      ],
    };

    try {
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: baseline }),
      )));
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: ordinaryGame }),
      )));
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(vi.getTimerCount()).toBe(0);

      const reactionGame = withReaction(ordinaryGame, "log_reaction", immediateSo2Event);
      await act(async () => root.render(createElement(
        LocaleProvider,
        null,
        createElement(SuccessfulReactionNotice, { game: reactionGame }),
      )));
      expect(vi.getTimerCount()).toBe(1);
      await act(async () => root.unmount());
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      if (container.isConnected) await act(async () => root.unmount());
      container.remove();
    }
  });
});
