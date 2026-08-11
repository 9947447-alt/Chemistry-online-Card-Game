import type { GameState } from "../../game/engine/types";

export function requiresSessionExitConfirmation(game: GameState): boolean {
  return game.phase !== "gameOver";
}
