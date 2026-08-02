// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createFatalLocalGameSession } from "../localGameSession";
import { FatalSessionPage } from "./FatalSessionPage";

describe("Phase 11 fatal session page redaction", () => {
  it("never renders or copies lineup IDs, raw errors, or game contents", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const writeText = vi.fn(async (_text: string) => undefined);
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const session = createFatalLocalGameSession(
      ["laboratory_teacher", "chemical_factory_ceo"],
      4,
      "GAME_ACTION_FAILED",
    );

    try {
      await act(async () => {
        root.render(createElement(FatalSessionPage, {
          dispatch: vi.fn(),
          session,
        }));
      });

      const pageText = container.textContent ?? "";
      expect(pageText).not.toContain("laboratory_teacher");
      expect(pageText).not.toContain("chemical_factory_ceo");
      expect(pageText).not.toContain("PRIVATE_ERROR_MESSAGE");
      expect(pageText).not.toContain("secret_card_instance");
      expect(pageText).not.toContain("secret_log_entry");

      const copyButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "复制安全诊断",
      );
      if (!copyButton) {
        throw new Error("Expected the safe diagnostic copy button.");
      }

      await act(async () => copyButton.click());
      expect(writeText).toHaveBeenCalledOnce();
      const copiedText = writeText.mock.calls[0]?.[0] ?? "";
      expect(copiedText).toContain("名称：反应域");
      expect(copiedText).toContain("错误码：GAME_ACTION_FAILED");
      expect(copiedText).not.toContain("laboratory_teacher");
      expect(copiedText).not.toContain("chemical_factory_ceo");
      expect(copiedText).not.toContain("PRIVATE_ERROR_MESSAGE");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      if (clipboardDescriptor) {
        Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    }
  });
});
