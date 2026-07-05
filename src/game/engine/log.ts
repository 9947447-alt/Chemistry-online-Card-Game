import type { GameLogEntry } from "./types";

export function createLogEntry(id: string, message: string): GameLogEntry {
  return { id, message };
}
