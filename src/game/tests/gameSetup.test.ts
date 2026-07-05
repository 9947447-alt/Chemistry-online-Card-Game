import { describe, expect, it } from "vitest";
import { starterDeckSize } from "../data/starterDeck";
import { createInitialGame } from "../engine/createInitialGame";
import { identityShuffle } from "../../shared/random";
import { expectCardZonesToBeConsistent } from "./assertCardZones";

describe("createInitialGame", () => {
  it("deals 10 cards to each player", () => {
    const state = createInitialGame({ shuffle: identityShuffle });

    expect(state.players[0].hand).toHaveLength(10);
    expect(state.players[1].hand).toHaveLength(10);
  });

  it("leaves the correct number of cards in the deck", () => {
    const state = createInitialGame({ shuffle: identityShuffle });

    expect(starterDeckSize).toBe(70);
    expect(state.deck).toHaveLength(50);
    expect(state.discardPile).toHaveLength(0);
    expect(Object.keys(state.cardInstances)).toHaveLength(70);
    expectCardZonesToBeConsistent(state);
  });
});
