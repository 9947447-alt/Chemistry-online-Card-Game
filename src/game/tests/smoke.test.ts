import { describe, expect, it } from "vitest";
import { createInitialGame } from "../engine/createInitialGame";

describe("MVP 0 skeleton", () => {
  it("creates the placeholder engine state", () => {
    expect(createInitialGame()).toEqual({ status: "skeleton-ready" });
  });
});
