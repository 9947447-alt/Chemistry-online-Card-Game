import { expect } from "vitest";
import type { CardInstanceId, GameState } from "../engine/types";

export function expectCardZonesToBeConsistent(state: GameState): void {
  const locations = new Map<CardInstanceId, string>();
  const addLocation = (cardId: CardInstanceId, location: string) => {
    expect(locations.has(cardId), `${cardId} appears in multiple zones`).toBe(false);
    locations.set(cardId, location);
  };

  for (const cardId of state.deck) {
    addLocation(cardId, "deck");
    expect(state.cardInstances[cardId]?.zone).toEqual({ type: "deck" });
  }

  for (const player of state.players) {
    for (const cardId of player.hand) {
      addLocation(cardId, `hand:${player.id}`);
      expect(state.cardInstances[cardId]?.zone).toEqual({ type: "hand", playerId: player.id });
      expect(state.cardInstances[cardId]?.ownerId).toBe(player.id);
    }
  }

  for (const cardId of state.discardPile) {
    addLocation(cardId, "discard");
    expect(state.cardInstances[cardId]?.zone).toEqual({ type: "discard" });
    expect(state.cardInstances[cardId]?.ownerId).toBeUndefined();
  }

  const allInstanceIds = Object.keys(state.cardInstances);
  expect(allInstanceIds).toHaveLength(70);
  expect(locations.size).toBe(allInstanceIds.length);
  expect([...locations.keys()].sort()).toEqual(allInstanceIds.sort());
}
