import type { SuccessfulReactionEvent } from "./reactions";

export type CardType = "element" | "ion" | "substance" | "event";

export type PlayTiming =
  | "main-action"
  | "response"
  | "status-window"
  | "diy-component";

export type Tag =
  | "acid"
  | "base"
  | "strong-acid"
  | "strong-alkali"
  | "carbonate"
  | "harmful-gas"
  | "aqueous"
  | "fire-extinguish"
  | "alkaline-absorb"
  | "neutralizer"
  | "fire-source";

export type ElementCategory =
  | "nonmetal"
  | "metal"
  | "halogen";

export type CardDefinitionId = string;
export type CardInstanceId = string;
export type PlayerId = string;

export type CharacterId =
  | "laboratory_teacher"
  | "chemical_factory_ceo"
  | "clumsy_party_secretary"
  | "caustic_soda_captain"
  | "acid_king"
  | "chemistry_enthusiast"
  | "sulfuric_acid_factory_director";

export type CharacterSkillId =
  | "lesson_preparation"
  | "extra_lesson"
  | "capital_reserve"
  | "emergency_supply"
  | "exhaust_leak"
  | "lab_fire"
  | "exothermic_accident"
  | "strong_alkali_protection"
  | "alkali_recovery"
  | "strong_alkali_mastery"
  | "acid_corrosion"
  | "acid_resistant_layer"
  | "diy_experiment"
  | "experiment_counterattack"
  | "exhaust_discharge"
  | "sulfuric_acid_process"
  | "sulfate_byproduct";

export type CharacterSkillType = "active" | "passive" | "response";

export type CharacterSkillImplementationStatus =
  | "display-only-8a"
  | "implemented-8b-1"
  | "implemented-8b-2"
  | "implemented-8c-2"
  | "implemented-8c-3"
  | "implemented-8c-4-partial"
  | "implemented-phase10"
  | "planned-8b"
  | "planned-8c"
  | "deferred";

export type CharacterSkillDefinition = {
  id: CharacterSkillId;
  name: string;
  type: CharacterSkillType;
  rulesText: string;
  implementationStatus: CharacterSkillImplementationStatus;
  implementationNote?: string;
};

export type CharacterDefinition = {
  id: CharacterId;
  name: string;
  maxHp: number;
  skills: readonly CharacterSkillDefinition[];
};

export type CharacterUsageKey =
  | "laboratory_teacher_extra_lesson"
  | "chemical_factory_ceo_emergency_supply"
  | "clumsy_party_secretary_shared_active"
  | "caustic_soda_captain_alkali_recovery"
  | "chemistry_enthusiast_counterattack"
  | "sulfuric_acid_factory_director_exhaust_discharge"
  | "sulfuric_acid_factory_director_sulfate_byproduct";

export type CharacterUsageState = {
  perCycle: Partial<Record<CharacterUsageKey, number>>;
  perRound: Partial<Record<CharacterUsageKey, number>>;
};

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
  elementCategory?: ElementCategory;
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
  characterId: CharacterId;
  hp: number;
  maxHp: number;
  hand: CardInstanceId[];
  statuses: PlayerStatus[];
  eliminated: boolean;
  usedDIYThisCycle: boolean;
  characterUsage: CharacterUsageState;
};

type CardDamageSourceBase = {
      kind: "card";
      sourcePlayerId: PlayerId;
      cardInstanceId: CardInstanceId;
      cardDefinitionId: CardDefinitionId;
    };

export type DamageSource =
  | (CardDamageSourceBase & { sourceSkillId?: never })
  | (CardDamageSourceBase & {
      sourceSkillId: Extract<CharacterSkillId, "experiment_counterattack">;
    })
  | {
      kind: "diy";
      sourcePlayerId: PlayerId;
      recipeId: string;
    }
  | {
      kind: "status";
      sourcePlayerId: null;
      statusInstanceId: string;
      statusId: StatusId;
    }
  | {
      kind: "character-skill";
      sourcePlayerId: PlayerId;
      skillId: CharacterSkillId;
    };

export type DamageTag =
  | "acid"
  | "base"
  | "strong-acid"
  | "strong-alkali"
  | "so2"
  | "fire"
  | "status";

export type ResponsePolicy = "acid-base" | "alkali-absorption" | "none";

export type DamageContext = {
  targetPlayerId: PlayerId;
  baseAmount: number;
  source: DamageSource;
  tags: readonly DamageTag[];
  responsePolicy: ResponsePolicy;
};

export type Effect =
  | {
      type: "DAMAGE";
      context: DamageContext;
    }
  | { type: "HEAL"; sourceId: string; targetPlayerId: PlayerId; amount: number }
  | { type: "DRAW"; playerId: PlayerId; count: number }
  | { type: "DISCARD"; playerId: PlayerId; cardInstanceIds: CardInstanceId[] }
  | { type: "ADD_STATUS"; sourceId: string; targetPlayerId: PlayerId; statusId: StatusId }
  | { type: "REMOVE_STATUS"; targetPlayerId: PlayerId; statusInstanceId: string }
  | { type: "MOVE_CARD"; cardInstanceId: CardInstanceId; from: CardZone; to: CardZone }
  | { type: "ADVANCE_TURN" };

export type DamageEffect = Extract<Effect, { type: "DAMAGE" }>;

export type MultiTargetResponseResult = Readonly<{
  targetPlayerId: PlayerId;
  outcome: "absorbed" | "damaged";
  finalDamage: number;
}>;

export type MultiTargetResponseSequence = Readonly<{
  sourcePlayerId: PlayerId;
  sourceSkillId: "exhaust_leak";
  targetPlayerIds: readonly PlayerId[];
  remainingTargetPlayerIds: readonly PlayerId[];
  completedResults: readonly MultiTargetResponseResult[];
  finishBehavior: "exhaust-leak";
}>;

export type ResponseContinuation =
  | Readonly<{
      kind: "single-response";
    }>
  | Readonly<{
      kind: "multi-target-response";
      sequence: MultiTargetResponseSequence;
      completedResult: MultiTargetResponseResult;
    }>;

export type ExperimentCounterattackOption =
  | "recover"
  | "metal-counterattack"
  | "acid-base-pursuit";

export type PendingExperimentCounterattack = Readonly<{
  responderPlayerId: PlayerId;
  attackerPlayerId: PlayerId;
  originalDamageContext: DamageContext;
  responseType: Extract<ResponsePolicy, "acid-base" | "alkali-absorption">;
  legalOptions: readonly ExperimentCounterattackOption[];
  legalMetalCardInstanceIds: readonly CardInstanceId[];
  legalPursuitCardInstanceIds: readonly CardInstanceId[];
  continuation: ResponseContinuation;
}>;

type SinglePendingResponse = {
  responderId: PlayerId;
  sourceEffect: DamageEffect;
  chainDepth: number;
  effectsAfterPass: Effect[];
  multiTargetSequence?: never;
};

export type MultiTargetPendingResponse = {
  responderId: PlayerId;
  sourceEffect: DamageEffect;
  chainDepth: number;
  effectsAfterPass: Effect[];
  multiTargetSequence: MultiTargetResponseSequence;
};

export type PendingResponse = SinglePendingResponse | MultiTargetPendingResponse;

export type PendingStatusHandling = {
  playerId: PlayerId;
  statusInstanceId: string;
};

export type LaboratoryPreparationSelection = {
  playerId: PlayerId;
  candidateCardInstanceIds: CardInstanceId[];
};

export type PendingLaboratoryPreparation = LaboratoryPreparationSelection & {
  keepCount: 10;
  remainingSelections: LaboratoryPreparationSelection[];
};

export type GamePhase =
  | "setup"
  | "cycleStart"
  | "preparationSelection"
  | "actionStart"
  | "statusWindow"
  | "mainAction"
  | "responseWindow"
  | "experimentCounterattackWindow"
  | "cleanup"
  | "gameOver";

export type GameLogEntry =
  | Readonly<{
      id: string;
      message: string;
      reaction?: never;
    }>
  | Readonly<{
      id: string;
      message: string;
      reaction: SuccessfulReactionEvent;
    }>;

export type TableReference = {
  cardInstanceId: CardInstanceId;
  definitionId: CardDefinitionId;
  displayName: string;
  playedBy: PlayerId;
  cycle: number;
  round: 1 | 2 | 3;
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
  tableReference?: TableReference;
  pendingResponse?: PendingResponse;
  pendingExperimentCounterattack?: PendingExperimentCounterattack;
  pendingStatusHandling?: PendingStatusHandling;
  pendingLaboratoryPreparation?: PendingLaboratoryPreparation;
  effectQueue: Effect[];
  log: GameLogEntry[];
  winnerPlayerId?: PlayerId;
  isDraw?: boolean;
  settings: GameSettings;
};
