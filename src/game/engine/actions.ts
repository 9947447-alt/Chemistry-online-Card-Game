import type { CardInstanceId, CharacterSkillId, PlayerId } from "./types";

export type GameAction =
  | {
      type: "ACTIVATE_CHARACTER_SKILL";
      playerId: PlayerId;
      skillId: CharacterSkillId;
    }
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
  | {
      type: "START_ACTIVE_DIY";
      playerId: PlayerId;
      recipeId: string;
      componentCardInstanceIds: CardInstanceId[];
      targetPlayerId?: PlayerId;
    };
