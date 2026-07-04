import type { EngineState } from "./reducer";

export function createInitialGame(): EngineState {
  return {
    status: "skeleton-ready",
  };
}
