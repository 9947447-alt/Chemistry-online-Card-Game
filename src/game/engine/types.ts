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

export type DamageKind = "acid" | "base";

export type DIYBlockerCode =
  | "NOT_ACTIVE_PLAYER"
  | "INVALID_PHASE"
  | "DIY_ALREADY_USED_THIS_CYCLE"
  | "OWN_FIRE_REQUIRED"
  | "TARGET_PLAYER_REQUIRED"
  | "TARGET_PLAYER_INVALID"
  | "UNEXPECTED_TARGET";

export type DIYExecutableOutcome =
  | { kind: "CO2_REMOVE_OWN_FIRE" }
  | { kind: "H2O_REMOVE_OWN_FIRE" }
  | { kind: "SO2_APPLY_LEAK"; targetPlayerId: PlayerId }
  | {
      kind: "VIRTUAL_ATTACK";
      targetPlayerId: PlayerId;
      damageKind: "acid" | "base";
      damageAmount: number;
    };

export type DIYSelectionAnalysis =
  | {
      status: "INVALID_SELECTION";
      invalidCardInstanceIds: readonly CardInstanceId[];
    }
  | {
      status: "NO_RECIPE_MATCH";
    }
  | {
      status: "MATCHED_NOT_EXECUTABLE";
      recipeId: string;
      blockerCode: DIYBlockerCode;
    }
  | {
      status: "EXECUTABLE";
      recipeId: string;
      outcome: DIYExecutableOutcome;
    };

export type GameLogEventKey =
  | "game_start"
  | "recycle_discard_into_deck"
  | "draw_stopped_empty"
  | "cycle_cleanup_discard_hands"
  | "cycle_start"
  | "round_start"
  | "turn_start"
  | "laboratory_preparation_confirmed"
  | "status_window_start"
  | "status_gained"
  | "status_refreshed"
  | "status_handled_fire"
  | "status_passed_damage"
  | "card_play_so2"
  | "card_play_o2"
  | "card_play_reference"
  | "card_play_attack"
  | "response_pass_damage"
  | "response_pass_so2"
  | "lose_hp"
  | "eliminated"
  | "winner"
  | "draw_game"
  | "sulfate_byproduct_draw"
  | "skill_draw"
  | "skill_alkali_recovery"
  | "skill_exhaust_discharge"
  | "skill_exhaust_leak"
  | "skill_lab_fire"
  | "skill_exothermic_accident"
  | "counterattack_window_open"
  | "counterattack_recover"
  | "counterattack_pursuit"
  | "diy_co2_remove_fire"
  | "diy_h2o_remove_fire"
  | "diy_virtual_attack"
  | "diy_so2_apply_leak"
  | "reaction";

export type GameLogParamsMap = {
  game_start: Readonly<{ cycleNumber: number }>;
  recycle_discard_into_deck: Record<string, never>;
  draw_stopped_empty: Record<string, never>;
  cycle_cleanup_discard_hands: Record<string, never>;
  cycle_start: Readonly<{ cycleNumber: number }>;
  round_start: Readonly<{ roundInCycle: number }>;
  turn_start: Readonly<{ playerId: PlayerId }>;
  laboratory_preparation_confirmed: Readonly<{ playerId: PlayerId; keepCount: number }>;
  status_window_start: Readonly<{ playerId: PlayerId; statusId: StatusId }>;
  status_gained: Readonly<{ playerId: PlayerId; statusId: StatusId }>;
  status_refreshed: Readonly<{ playerId: PlayerId; statusId: StatusId }>;
  status_handled_fire: Readonly<{ playerId: PlayerId; cardDefinitionId: CardDefinitionId }>;
  status_passed_damage: Readonly<{ playerId: PlayerId; statusId: StatusId; amount: number }>;
  card_play_so2: Readonly<{ actorId: PlayerId; targetId: PlayerId }>;
  card_play_o2: Readonly<{ actorId: PlayerId; amount: number }>;
  card_play_reference: Readonly<{ actorId: PlayerId; cardDefinitionId: CardDefinitionId }>;
  card_play_attack: Readonly<{
    actorId: PlayerId;
    cardDefinitionId: CardDefinitionId;
    targetId: PlayerId;
    damageKind: DamageKind;
    baseAmount: number;
  }>;
  response_pass_damage: Readonly<{ targetId: PlayerId; damageKind: DamageKind; amount: number }>;
  response_pass_so2: Readonly<{ targetId: PlayerId; amount: number }>;
  lose_hp: Readonly<{ playerId: PlayerId; amount: number }>;
  eliminated: Readonly<{ playerId: PlayerId }>;
  winner: Readonly<{ playerId: PlayerId }>;
  draw_game: Record<string, never>;
  sulfate_byproduct_draw: Readonly<{ playerId: PlayerId }>;
  skill_draw: Readonly<{ playerId: PlayerId; skillId: CharacterSkillId; amount: number }>;
  skill_alkali_recovery: Readonly<{ playerId: PlayerId; cardDefinitionId: CardDefinitionId; amount: number }>;
  skill_exhaust_discharge: Readonly<{ actorId: PlayerId; targetId: PlayerId }>;
  skill_exhaust_leak: Readonly<{ playerId: PlayerId; targetCount: number }>;
  skill_lab_fire: Readonly<{ playerId: PlayerId }>;
  skill_exothermic_accident: Readonly<{ playerId: PlayerId; amount: number }>;
  counterattack_window_open: Readonly<{ responderId: PlayerId; attackerId: PlayerId }>;
  counterattack_recover: Readonly<{ playerId: PlayerId; amount: number }>;
  counterattack_pursuit: Readonly<{
    playerId: PlayerId;
    cardDefinitionId: CardDefinitionId;
    targetId: PlayerId;
    amount: number;
  }>;
  diy_co2_remove_fire: Readonly<{ playerId: PlayerId }>;
  diy_h2o_remove_fire: Readonly<{ playerId: PlayerId }>;
  diy_virtual_attack: Readonly<{
    playerId: PlayerId;
    recipeId: string;
    targetId: PlayerId;
    damageKind: DamageKind;
    amount: number;
  }>;
  diy_so2_apply_leak: Readonly<{ actorId: PlayerId; targetId: PlayerId }>;
  reaction: Record<string, never>;
};

export type LogPlayerIdentitySnapshot = Readonly<{
  playerId: PlayerId;
  customName?: string;
}>;

export type LogPresentationContext = Readonly<{
  players: Readonly<Record<PlayerId, LogPlayerIdentitySnapshot>>;
}>;

export type GameLogEntry = {
  [E in GameLogEventKey]: Readonly<{
    id: string;
    eventKey: E;
    params: Readonly<GameLogParamsMap[E]>;
  }> &
    (E extends "reaction"
      ? Readonly<{ reaction: Readonly<SuccessfulReactionEvent> }>
      : Readonly<{ reaction?: never }>);
}[GameLogEventKey];

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
  logPresentationContext: LogPresentationContext;
  winnerPlayerId?: PlayerId;
  isDraw?: boolean;
  settings: GameSettings;
};
