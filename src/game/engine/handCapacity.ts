import type { Player } from "./types";

export const CEO_HAND_LIMIT = 14;

export function getAllowedDrawCount(player: Player, requestedCount: number): number {
  const normalizedCount = Math.max(0, requestedCount);

  if (player.characterId !== "chemical_factory_ceo") {
    return normalizedCount;
  }

  return Math.min(normalizedCount, Math.max(0, CEO_HAND_LIMIT - player.hand.length));
}
