import type { CardInstanceId, PlayerId } from "./types";

export type GameAction =
  | { type: "PASS_ACTION"; playerId: PlayerId }
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
  | { type: "PASS_STATUS_HANDLING"; playerId: PlayerId; statusInstanceId: string };
