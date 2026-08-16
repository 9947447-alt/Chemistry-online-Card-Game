import type { CardInstanceId, PlayerId } from "./types";

export type ActivateCharacterSkillAction =
  | {
      type: "ACTIVATE_CHARACTER_SKILL";
      playerId: PlayerId;
      skillId:
        | "extra_lesson"
        | "emergency_supply"
        | "exhaust_leak"
        | "lab_fire"
        | "exothermic_accident";
    }
  | {
      type: "ACTIVATE_CHARACTER_SKILL";
      playerId: PlayerId;
      skillId: "alkali_recovery";
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "ACTIVATE_CHARACTER_SKILL";
      playerId: PlayerId;
      skillId: "exhaust_discharge";
      targetPlayerId: PlayerId;
    };

export type ResolveExperimentCounterattackAction =
  | {
      type: "RESOLVE_EXPERIMENT_COUNTERATTACK";
      playerId: PlayerId;
      option: "recover";
    }
  | {
      type: "RESOLVE_EXPERIMENT_COUNTERATTACK";
      playerId: PlayerId;
      option: "metal-counterattack";
      cardInstanceId: CardInstanceId;
    }
  | {
      type: "RESOLVE_EXPERIMENT_COUNTERATTACK";
      playerId: PlayerId;
      option: "acid-base-pursuit";
      cardInstanceId: CardInstanceId;
    };

export type PlayDiySelectionAction = {
  type: "PLAY_DIY_SELECTION";
  playerId: PlayerId;
  componentCardInstanceIds: CardInstanceId[];
  targetPlayerId?: PlayerId;
};

export type GameAction =
  | ActivateCharacterSkillAction
  | ResolveExperimentCounterattackAction
  | {
      type: "CONFIRM_LABORATORY_PREPARATION";
      playerId: PlayerId;
      keptCardInstanceIds: CardInstanceId[];
    }
  | { type: "PASS_ACTION"; playerId: PlayerId }
  | { type: "PLAY_REFERENCE_CARD"; playerId: PlayerId; cardInstanceId: CardInstanceId }
  | {
      type: "PLAY_CARD";
      playerId: PlayerId;
      cardInstanceId: CardInstanceId;
      targetPlayerId?: PlayerId;
    }
  | { type: "RESPOND_WITH_CARD"; playerId: PlayerId; cardInstanceId: CardInstanceId }
  | { type: "PASS_RESPONSE"; playerId: PlayerId }
  | {
      type: "HANDLE_STATUS_WITH_CARD";
      playerId: PlayerId;
      statusInstanceId: string;
      cardInstanceId: CardInstanceId;
    }
  | { type: "PASS_STATUS_HANDLING"; playerId: PlayerId; statusInstanceId: string }
  | PlayDiySelectionAction
  | {
      type: "START_ACTIVE_DIY";
      playerId: PlayerId;
      recipeId: string;
      componentCardInstanceIds: CardInstanceId[];
      targetPlayerId?: PlayerId;
    };
