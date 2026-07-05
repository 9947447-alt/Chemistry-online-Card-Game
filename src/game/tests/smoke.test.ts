import { describe, expect, it } from "vitest";
import { createInitialGame } from "../engine/createInitialGame";
import { identityShuffle } from "../../shared/random";

describe("MVP 0 engine smoke", () => {
  it("creates an initialized game", () => {
    const state = createInitialGame({ shuffle: identityShuffle });

    expect(state.phase).toBe("mainAction");
    expect(state.players).toHaveLength(2);
  });
});
