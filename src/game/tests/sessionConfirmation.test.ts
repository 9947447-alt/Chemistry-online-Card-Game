import { describe, expect, it } from "vitest";
import { requiresSessionExitConfirmation } from "../../features/local-game/sessionConfirmation";
import { createInitialGame } from "../engine/createInitialGame";
import { identityShuffle } from "../../shared/random";

describe("Phase 11 session exit confirmation semantics", () => {
  it("requires confirmation for every active phase and skips it only at gameOver", () => {
    const game = createInitialGame({
      characterIds: ["chemical_factory_ceo", "acid_king"],
      shuffle: identityShuffle,
    });

    expect(requiresSessionExitConfirmation(game)).toBe(true);
    expect(requiresSessionExitConfirmation({ ...game, phase: "gameOver" })).toBe(false);
  });
});
