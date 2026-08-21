import type {
  CharacterId,
  CharacterSkillId,
  CharacterSkillImplementationStatus,
  CharacterSkillType,
  LogPresentationContext,
  Player,
  PlayerId,
} from "../../game/engine/types";
import type { DisplayLocale } from "../../app/locale";
import { cardDefinitions } from "../../game/data/cardDefinitions";
import { characterDefinitions, getCharacterDefinition } from "../../game/data/characterDefinitions";
import { diyRecipes } from "../../game/data/diyRecipes";
import type { FatalErrorCode, PlayerController } from "./localGameSession";

type LocalizedLabel = readonly [zh: string, en: string];

function lookup(
  table: Record<string, LocalizedLabel>,
  key: string,
  locale: DisplayLocale,
  name?: string,
  fallback = key,
): string {
  const entry = table[key];
  if (entry) {
    return entry[locale === "en" ? 1 : 0];
  }
  if (name) {
    throw new Error(`Unknown ${name} for log presentation: ${key}`);
  }
  return fallback;
}

const characterEnglishNames: Record<string, string> = {
  laboratory_teacher: "Laboratory Teacher",
  chemical_factory_ceo: "Chemical Factory CEO",
  clumsy_party_secretary: "Clumsy Party Secretary",
  caustic_soda_captain: "Caustic Soda Captain",
  acid_king: "Acid King",
  chemistry_enthusiast: "Chemistry Enthusiast",
  sulfuric_acid_factory_director: "Sulfuric Acid Factory Director",
};

const skillEnglishNames: Record<string, string> = {
  lesson_preparation: "Lesson Preparation",
  extra_lesson: "Extra Lesson",
  capital_reserve: "Capital Reserve",
  emergency_supply: "Emergency Supply",
  exhaust_leak: "Exhaust Leak",
  lab_fire: "Laboratory Bench Fire",
  exothermic_accident: "Exothermic Accident",
  strong_alkali_protection: "Strong Alkali Protection",
  alkali_recovery: "Alkali Recovery",
  strong_alkali_mastery: "Strong Alkali Mastery",
  acid_corrosion: "Acid Corrosion",
  acid_resistant_layer: "Acid-resistant Layer",
  diy_experiment: "DIY Experiment",
  experiment_counterattack: "Experiment Counterattack",
  exhaust_discharge: "Exhaust Discharge",
  sulfuric_acid_process: "Sulfuric Acid Process",
  sulfate_byproduct: "Sulfate Byproduct",
};

function getCanonicalSkillName(skillId: string): string | undefined {
  for (const c of characterDefinitions) {
    const s = c.skills.find((k) => k.id === skillId);
    if (s) return s.name;
  }
}

function getKnownCardDisplayName(id: string, locale: DisplayLocale): string | undefined {
  const c = cardDefinitions.find((d) => d.id === id)?.name;
  if (c) return locale === "en" ? (cardEnglishNames[id] ?? c) : c;
}

function getKnownDiyRecipeDisplayName(id: string, locale: DisplayLocale): string | undefined {
  const c = diyRecipes.find((r) => r.id === id)?.name;
  if (c) return locale === "en" ? (diyRecipeEnglishNames[id] ?? c) : c;
}

const diyVirtualProductNames: Record<string, LocalizedLabel> = {
  diy_hcl_from_h_cl: ["稀 HCl", "dilute HCl"],
  diy_h2so4_from_2h_so4: ["稀 H2SO4", "dilute H2SO4"],
  diy_naoh_from_na_oh: ["稀 NaOH", "dilute NaOH"],
  diy_koh_from_k_oh: ["稀 KOH", "dilute KOH"],
  diy_limewater_from_ca_2oh: ["石灰水 Ca(OH)2", "limewater Ca(OH)2"],
};

const cardEnglishNames: Record<string, string> = {
  substance_hcl_dilute: "Dilute HCl",
  substance_h2so4_dilute: "Dilute H2SO4",
  substance_naoh_dilute: "Dilute NaOH",
  substance_koh_dilute: "Dilute KOH",
  substance_caoh2_limewater: "Limewater Ca(OH)2",
  event_lab_fire: "Laboratory Bench Fire",
};

const diyRecipeEnglishNames: Record<string, string> = {
  diy_hcl_from_h_cl: "H+ + Cl- -> dilute HCl",
  diy_h2so4_from_2h_so4: "2H+ + SO4^2- -> dilute H2SO4",
  diy_naoh_from_na_oh: "Na+ + OH- -> dilute NaOH",
  diy_koh_from_k_oh: "K+ + OH- -> dilute KOH",
  diy_limewater_from_ca_2oh: "Ca2+ + 2OH- -> limewater Ca(OH)2",
};

const statusNames: Record<string, LocalizedLabel> = {
  SO2_LEAK: ["SO2 泄漏", "SO2 leak"],
  FIRE: ["火情", "Fire"],
};

const damageKindNames: Record<string, LocalizedLabel> = {
  acid: ["酸性", "acid"],
  base: ["碱性", "alkaline"],
};

const reactionNames: Record<string, LocalizedLabel> = {
  acid_base_neutralization: ["酸碱中和", "Acid-base neutralization"],
  acid_carbonate_co2: ["酸与碳酸盐", "Acid and carbonate"],
  so2_alkaline_absorption: ["SO2 碱性吸收", "SO2 alkaline absorption"],
};

const skillTypeNames: Record<CharacterSkillType, LocalizedLabel> = {
  active: ["主动", "Active"],
  passive: ["被动", "Passive"],
  response: ["响应", "Response"],
};

const impl = (c: string): [string, string] => [`${c} 已实现`, `${c} implemented`];
const plan = (c: string): [string, string] => [`${c} 计划实现`, `${c} planned`];

const implementationStatusNames: Readonly<Record<CharacterSkillImplementationStatus, LocalizedLabel>> = {
  "display-only-8a": ["8A 仅展示", "8A display only"],
  "implemented-8b-1": impl("8B-1"),
  "implemented-8b-2": impl("8B-2"),
  "implemented-8c-2": impl("8C-2"),
  "implemented-8c-3": impl("8C-3"),
  "implemented-8c-4-partial": ["8C-4 部分实现", "8C-4 partially implemented"],
  "implemented-phase10": impl("Phase 10"),
  "planned-8b": plan("8B"),
  "planned-8c": plan("8C"),
  deferred: ["延期", "Deferred"],
};

export const getCharacterDisplayName = (characterId: CharacterId, locale: DisplayLocale): string =>
  locale === "en" ? characterEnglishNames[characterId] : getCharacterDefinition(characterId).name;

export function getSkillDisplayName(skillId: string, locale: DisplayLocale): string {
  const canonical = getCanonicalSkillName(skillId);
  return canonical === undefined ? skillId : (locale === "en" ? skillEnglishNames[skillId] : canonical);
}

export function getStrictSkillDisplayName(skillId: string, locale: DisplayLocale): string {
  const canonical = getCanonicalSkillName(skillId);
  if (canonical === undefined) throw new Error(`Unknown skillId for log presentation: ${skillId}`);
  return locale === "en" ? skillEnglishNames[skillId] : canonical;
}

export const getCardDisplayName = (definitionId: string, fallback: string, locale: DisplayLocale): string =>
  getKnownCardDisplayName(definitionId, locale) ?? fallback;

export const getOptionalCardDisplayName = (
  definition: { id: string; name: string } | undefined,
  locale: DisplayLocale,
): string =>
  definition ? getCardDisplayName(definition.id, definition.name, locale) : (locale === "en" ? "Unknown card" : "未知卡牌");

export function getStrictCardDisplayName(definitionId: string, locale: DisplayLocale): string {
  const name = getKnownCardDisplayName(definitionId, locale);
  if (name === undefined) throw new Error(`Unknown card definitionId for log presentation: ${definitionId}`);
  return name;
}

export const getDiyRecipeDisplayName = (recipeId: string, fallback: string, locale: DisplayLocale): string =>
  getKnownDiyRecipeDisplayName(recipeId, locale) ?? fallback;

export function getStrictDiyRecipeDisplayName(recipeId: string, locale: DisplayLocale): string {
  const name = getKnownDiyRecipeDisplayName(recipeId, locale);
  if (name === undefined) throw new Error(`Unknown recipeId for log presentation: ${recipeId}`);
  return name;
}

export const getStatusDisplayName = (statusId: string, locale: DisplayLocale): string => lookup(statusNames, statusId, locale);
export const getStrictStatusDisplayName = (statusId: string, locale: DisplayLocale): string => lookup(statusNames, statusId, locale, "statusId");
export const getReactionDisplayName = (reactionId: string, locale: DisplayLocale): string => lookup(reactionNames, reactionId, locale);
export const getStrictReactionDisplayName = (reactionId: string, locale: DisplayLocale): string => lookup(reactionNames, reactionId, locale, "reactionId");
export const getDamageKindDisplayName = (damageKind: string, locale: DisplayLocale): string => lookup(damageKindNames, damageKind, locale);
export const getStrictDamageKindDisplayName = (damageKind: string, locale: DisplayLocale): string => lookup(damageKindNames, damageKind, locale, "damageKind");
export const getSkillTypeDisplayName = (type: CharacterSkillType, locale: DisplayLocale): string => skillTypeNames[type][locale === "en" ? 1 : 0];
export const getImplementationStatusDisplayName = (status: CharacterSkillImplementationStatus, locale: DisplayLocale): string => implementationStatusNames[status][locale === "en" ? 1 : 0];

export function getSkillAvailabilityDisplayName(
  status: CharacterSkillImplementationStatus,
  locale: DisplayLocale,
): string {
  if (status === "implemented-8c-4-partial") {
    return locale === "en" ? "Partially available in this playtest" : "当前试玩部分可用";
  }

  if (status.startsWith("implemented")) {
    return locale === "en" ? "Available in this playtest" : "当前试玩可用";
  }

  return locale === "en" ? "Information only in this playtest" : "当前试玩为说明项";
}

export function getPlayerDisplayName(player: Player | undefined, locale: DisplayLocale): string {
  if (!player) {
    return locale === "en" ? "Current player" : "当前玩家";
  }

  if (player.id === "player_1") {
    return locale === "en" ? "Player A" : "玩家 A";
  }

  if (player.id === "player_2") {
    return locale === "en" ? "Player B" : "玩家 B";
  }

  return player.name;
}


export const getDiyVirtualProductDisplayName = (recipeId: string, locale: DisplayLocale): string =>
  lookup(diyVirtualProductNames, recipeId, locale);

export const getStrictDiyVirtualProductDisplayName = (recipeId: string, locale: DisplayLocale): string =>
  lookup(diyVirtualProductNames, recipeId, locale, "virtual product recipeId");

export function getPlayerDisplayNameById(
  playerId: PlayerId,
  locale: DisplayLocale,
  context?: LogPresentationContext,
): string {
  const customName = context?.players[playerId]?.customName;
  if (customName !== undefined) return customName;
  if (playerId === "player_1") return locale === "en" ? "Player A" : "玩家 A";
  if (playerId === "player_2") return locale === "en" ? "Player B" : "玩家 B";
  throw new Error(`Unknown playerId for log presentation: ${playerId}`);
}

const fatalMessages: Readonly<
  Record<string, LocalizedLabel> & Record<FatalErrorCode, LocalizedLabel>
> = {
  SESSION_INITIALIZATION_FAILED: [
    "本地会话初始化失败，请重新开始。",
    "Session initialization failed; please restart.",
  ],
  GAME_START_FAILED: [
    "无法创建本地对局，请重试。",
    "Could not create game; please retry.",
  ],
  GAME_RESTART_FAILED: [
    "无法重建本地对局，旧对局已隔离。",
    "Could not rebuild game; old game isolated.",
  ],
  GAME_ACTION_FAILED: [
    "操作发生致命错误，对局已停止。",
    "Action failed; game stopped.",
  ],
  GAME_RECOVERY_FAILED: [
    "恢复未能创建新对局，请返回重试。",
    "Recovery failed; please return and retry.",
  ],
  GAME_STATE_VALIDATION_FAILED: [
    "新状态未通过校验，已阻止运行。",
    "State failed validation; operation blocked.",
  ],
};

export const getFatalMessageDisplayName = (code: string, fallback: string, locale: DisplayLocale): string =>
  lookup(fatalMessages, code, locale, undefined, fallback);

export const getPlayerControllerDisplayName = (controller: PlayerController, locale: DisplayLocale): string =>
  controller === "human" ? (locale === "en" ? "Human" : "人类") : "NATBA AI";

