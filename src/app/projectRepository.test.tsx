// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { ProjectRepositoryLink, projectRepositoryUrl } from "./projectRepository";

describe("Phase 15 project repository link", () => {
  it("uses only the approved static GitHub URL and safe new-tab attributes", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(createElement(ProjectRepositoryLink)));
      const link = container.querySelector("a");

      expect(projectRepositoryUrl).toBe(
        "https://github.com/9947447-alt/reaction-field",
      );
      expect(link?.getAttribute("href")).toBe(projectRepositoryUrl);
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link?.getAttribute("aria-label")).toContain("GitHub");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
