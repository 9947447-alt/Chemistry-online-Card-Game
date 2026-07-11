import type { CharacterUsageState, Player } from "./types";

export function createEmptyCharacterUsage(): CharacterUsageState {
  return {
    perCycle: {},
    perRound: {},
  };
}

export function resetCharacterUsageForNewCycle(player: Player): Player {
  return {
    ...player,
    characterUsage: createEmptyCharacterUsage(),
  };
}

export function resetCharacterUsageForNewRound(player: Player): Player {
  return {
    ...player,
    characterUsage: {
      ...player.characterUsage,
      perRound: {},
    },
  };
}
