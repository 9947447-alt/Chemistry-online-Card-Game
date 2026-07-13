import {
  createInitialGame,
  type CreateInitialGameOptions,
} from "../engine/createInitialGame";

const ordinaryTestCharacters: NonNullable<CreateInitialGameOptions["characterIds"]> = [
  "acid_king",
  "sulfuric_acid_factory_director",
];

export function createMvp0TestGame(options: CreateInitialGameOptions = {}) {
  return createInitialGame({
    characterIds: ordinaryTestCharacters,
    ...options,
  });
}
