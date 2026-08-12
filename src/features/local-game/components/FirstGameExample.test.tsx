// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";
import { LocaleProvider, LocaleSwitch } from "../../../app/locale";
import { FirstGameExample } from "./FirstGameExample";

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

describe("Phase 15 static first-game example", () => {
  it("is collapsed by default and contains the exact Chinese three-step copy", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(
        createElement(LocaleProvider, null, createElement(FirstGameExample)),
      ));
      const details = container.querySelector("details");
      expect(details?.open).toBe(false);
      expect(container.textContent).toContain("出牌：当前玩家选择一张符合现有操作条件的牌。");
      expect(container.textContent).toContain("响应：另一位玩家可使用现有响应入口。");
      expect(container.textContent).toContain(
        "反应与记录：若形成已实现的成功反应，结果显示并写入公开日志。",
      );
      expect(container.querySelector("button")).toBeNull();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("switches to the exact English copy without adding an action control", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(
        createElement(LocaleProvider, null, createElement("div", null,
          createElement(LocaleSwitch),
          createElement(FirstGameExample),
        )),
      ));
      const englishButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "English",
      );
      if (!englishButton) throw new Error("Expected English locale control.");
      await act(async () => englishButton.click());
      expect(container.textContent).toContain(
        "Play a card: The active player chooses a card through the available action controls.",
      );
      expect(container.textContent).toContain(
        "Respond: The other player may use the available response controls.",
      );
      expect(container.textContent).toContain(
        "Resolve and record: If an implemented successful reaction occurs, its result is shown and recorded in the public log.",
      );
      expect(container.querySelector(".first-game-example button")).toBeNull();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
