// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { RootErrorBoundary } from "./RootErrorBoundary";

function ThrowingView(): never {
  throw new Error("PRIVATE_STACK_AND_GAME_STATE");
}

describe("Phase 11 React ErrorBoundary", () => {
  it("renders a safe fallback without exposing the original render error", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container, { onCaughtError: () => undefined });

    try {
      await act(async () => {
        root.render(createElement(
          RootErrorBoundary,
          null,
          createElement(ThrowingView),
        ));
      });

      expect(container.textContent).toContain("页面遇到无法继续处理的错误");
      expect(container.textContent).toContain("UI_RENDER_FAILED");
      expect(container.textContent).not.toContain("PRIVATE_STACK_AND_GAME_STATE");
      expect(container.querySelector(".root-failure-card button")?.textContent).toBe("重新加载页面");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
