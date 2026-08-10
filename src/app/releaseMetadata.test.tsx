import { describe, expect, it } from "vitest";
import packageMetadata from "../../package.json";
import { releaseMetadata } from "./releaseMetadata";

describe("Phase 13 alpha.2 release metadata", () => {
  it("uses package.json as the application version single source of truth", () => {
    expect(releaseMetadata).toEqual({
      displayName: "反应域",
      secondaryName: "REACTION FIELD",
      channel: "Web Playtest Alpha",
      version: packageMetadata.version,
      rulesVersion: "MVP0-P10",
      commit: expect.stringMatching(/^(?:[0-9a-f]{12}|dev\/unknown)$/u),
    });
    expect(packageMetadata.version).toBe("0.13.0-alpha.2");
  });
});
