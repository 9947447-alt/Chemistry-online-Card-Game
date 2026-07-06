export type CardType = "element" | "ion" | "substance" | "event";

export type PlayTiming =
  | "main-action"
  | "response"
  | "status-window"
  | "diy-component";

export type Tag =
  | "acid"
  | "base"
  | "carbonate"
  | "harmful-gas"
  | "aqueous"
  | "fire-extinguish"
  | "alkaline-absorb"
  | "neutralizer"
  | "fire-source";

export type CardDefinitionId = string;
export type CardInstanceId = string;
export type PlayerId = string;

export type CardZone =
  | { type: "deck" }
  | { type: "hand"; playerId: PlayerId }
  | { type: "discard" };

export type CardDefinition = {
  id: CardDefinitionId;
  name: string;
  type: CardType;
  formula?: string;
  elements?: string[];
  ionsProvided?: string[];
  tags: Tag[];
  baseDamage?: number;
  allowedTimings: PlayTiming[];
  rulesText: string;
};

export type CardInstance = {
  id: CardInstanceId;
  definitionId: CardDefinitionId;
  ownerId?: PlayerId;
  zone: CardZone;
};

export type StatusId = "SO2_LEAK" | "FIRE";

export type PlayerStatus = {
  id: string;
  statusId: StatusId;
  sourcePlayerId?: PlayerId;
  createdAt: number;
};

export type Player = {
  id: PlayerId;
  name: string;
  hp: number;
  maxHp: number;
  hand: CardInstanceId[];
  statuses: PlayerStatus[];
  eliminated: boolean;
  usedDIYThisCycle: boolean;
};

export type AttackSource =
  | {
      kind: "card";
      cardInstanceId: CardInstanceId;
    }
  | {
      kind: "virtual-diy";
      recipeId: string;
      displayName: string;
    };

export type DamageSource =
  | AttackSource
  | {
      kind: "status";
      statusInstanceId: string;
      displayName: string;
    };

export type Effect =
  | {
      type: "DAMAGE";
      source: DamageSource;
      targetPlayerId: PlayerId;
      amount: number;
      damageKind: "acid" | "base" | "status";
      canRespond: boolean;
    }
  | { type: "HEAL"; sourceId: string; targetPlayerId: PlayerId; amount: number }
  | { type: "DRAW"; playerId: PlayerId; count: number }
  | { type: "DISCARD"; playerId: PlayerId; cardInstanceIds: CardInstanceId[] }
  | { type: "ADD_STATUS"; sourceId: string; targetPlayerId: PlayerId; statusId: StatusId }
  | { type: "REMOVE_STATUS"; targetPlayerId: PlayerId; statusInstanceId: string }
  | { type: "MOVE_CARD"; cardInstanceId: CardInstanceId; from: CardZone; to: CardZone }
  | { type: "ADVANCE_TURN" };

export type DamageEffect = Extract<Effect, { type: "DAMAGE" }>;

export type PendingResponse = {
  responderId: PlayerId;
  sourceEffect: DamageEffect;
  chainDepth: number;
  effectsAfterPass: Effect[];
};

export type PendingStatusHandling = {
  playerId: PlayerId;
  statusInstanceId: string;
};

export type GamePhase =
  | "setup"
  | "cycleStart"
  | "actionStart"
  | "statusWindow"
  | "mainAction"
  | "responseWindow"
  | "cleanup"
  | "gameOver";

export type GameLogEntry = {
  id: string;
  message: string;
};

export type GameSettings = {
  playersPerGame: 2;
  handSize: number;
  roundsPerCycle: 3;
};

export type GameState = {
  id: string;
  phase: GamePhase;
  players: Player[];
  activePlayerId: PlayerId;
  startingPlayerId: PlayerId;
  cycleNumber: number;
  roundInCycle: 1 | 2 | 3;
  cardInstances: Record<CardInstanceId, CardInstance>;
  deck: CardInstanceId[];
  discardPile: CardInstanceId[];
  baselineCardId?: CardInstanceId;
  pendingResponse?: PendingResponse;
  pendingStatusHandling?: PendingStatusHandling;
  effectQueue: Effect[];
  log: GameLogEntry[];
  winnerPlayerId?: PlayerId;
  isDraw?: boolean;
  settings: GameSettings;
};
