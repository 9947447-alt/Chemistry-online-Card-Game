import {
  createInitialGame,
  type CreateInitialGameOptions,
} from "../engine/createInitialGame";

const ordinaryTestCharacters: NonNullable<CreateInitialGameOptions["characterIds"]> = [
  "clumsy_party_secretary",
  "clumsy_party_secretary",
];

export function createMvp0TestGame(options: CreateInitialGameOptions = {}) {
  return createInitialGame({
    characterIds: ordinaryTestCharacters,
    ...options,
  });
}
