import type { EngineAction } from "./actions";
import type { EngineStatus } from "./types";

export type EngineState = {
  status: EngineStatus;
};

export function engineReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case "SKELETON_READY":
      return { ...state, status: "skeleton-ready" };
    default:
      return state;
  }
}
