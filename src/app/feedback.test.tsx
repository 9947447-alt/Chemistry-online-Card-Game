// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { FeedbackLink, feedbackFormUrl } from "./feedback";

describe("Alpha 4 feedback link", () => {
  it("uses only the approved static Forms endpoint and safe new-tab attributes", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(createElement(FeedbackLink)));
      const link = container.querySelector("a");

      expect(feedbackFormUrl).toBe("https://forms.cloud.microsoft/r/QG8PACUnsa");
      expect(link?.getAttribute("href")).toBe(feedbackFormUrl);
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link?.getAttribute("aria-label")).toContain("Microsoft Forms");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
