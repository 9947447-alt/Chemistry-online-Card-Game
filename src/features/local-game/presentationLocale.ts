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
import type { FatalErrorCode } from "./localGameSession";

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

const characterEnglishNames: Readonly<Record<CharacterId, string>> = {
  laboratory_teacher: "Laboratory Teacher",
  chemical_factory_ceo: "Chemical Factory CEO",
  clumsy_party_secretary: "Clumsy Party Secretary",
  caustic_soda_captain: "Caustic Soda Captain",
  acid_king: "Acid King",
  chemistry_enthusiast: "Chemistry Enthusiast",
  sulfuric_acid_factory_director: "Sulfuric Acid Factory Director",
};

const skillEnglishNames: Readonly<
  Record<string, string> & Record<CharacterSkillId, string>
> = {
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
  for (const character of characterDefinitions) {
    const skill = character.skills.find((candidate) => candidate.id === skillId);
    if (skill !== undefined) {
      return skill.name;
    }
  }
  return undefined;
}

function getKnownCardDisplayName(definitionId: string, locale: DisplayLocale): string | undefined {
  const canonical = cardDefinitions.find((definition) => definition.id === definitionId)?.name;
  if (canonical !== undefined) {
    return locale === "en" ? (cardEnglishNames[definitionId] ?? canonical) : canonical;
  }
}

function getKnownDiyRecipeDisplayName(recipeId: string, locale: DisplayLocale): string | undefined {
  const canonical = diyRecipes.find((recipe) => recipe.id === recipeId)?.name;
  if (canonical !== undefined) {
    return locale === "en" ? (diyRecipeEnglishNames[recipeId] ?? canonical) : canonical;
  }
}

const zh_hcl = "稀 HCl";
const zh_h2so4 = "稀 H2SO4";
const zh_naoh = "稀 NaOH";
const zh_koh = "稀 KOH";
const zh_lime = "石灰水 Ca(OH)2";

const diyVirtualProductNames: Readonly<Record<string, readonly [string, string]>> = {
  diy_hcl_from_h_cl: [zh_hcl, "dilute HCl"],
  diy_h2so4_from_2h_so4: [zh_h2so4, "dilute H2SO4"],
  diy_naoh_from_na_oh: [zh_naoh, "dilute NaOH"],
  diy_koh_from_k_oh: [zh_koh, "dilute KOH"],
  diy_limewater_from_ca_2oh: [zh_lime, "limewater Ca(OH)2"],
};

const cardEnglishNames: Readonly<Record<string, string>> = {
  substance_hcl_dilute: "Dilute HCl",
  substance_h2so4_dilute: "Dilute H2SO4",
  substance_naoh_dilute: "Dilute NaOH",
  substance_koh_dilute: "Dilute KOH",
  substance_caoh2_limewater: "Limewater Ca(OH)2",
  event_lab_fire: "Laboratory Bench Fire",
};

const diyRecipeEnglishNames: Readonly<Record<string, string>> = {
  diy_hcl_from_h_cl: "H+ + Cl- -> dilute HCl",
  diy_h2so4_from_2h_so4: "2H+ + SO4^2- -> dilute H2SO4",
  diy_naoh_from_na_oh: "Na+ + OH- -> dilute NaOH",
  diy_koh_from_k_oh: "K+ + OH- -> dilute KOH",
  diy_limewater_from_ca_2oh: "Ca2+ + 2OH- -> limewater Ca(OH)2",
};

const statusNames: Readonly<Record<string, LocalizedLabel>> = {
  SO2_LEAK: ["SO2 泄漏", "SO2 leak"],
  FIRE: ["火情", "Fire"],
};

const damageKindNames: Readonly<Record<string, LocalizedLabel>> = {
  acid: ["酸性", "acid"],
  base: ["碱性", "alkaline"],
};

const reactionNames: Readonly<Record<string, LocalizedLabel>> = {
  acid_base_neutralization: ["酸碱中和", "Acid-base neutralization"],
  acid_carbonate_co2: ["酸与碳酸盐", "Acid and carbonate"],
  so2_alkaline_absorption: ["SO2 碱性吸收", "SO2 alkaline absorption"],
};

const skillTypeNames: Readonly<Record<CharacterSkillType, LocalizedLabel>> = {
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

export function getCharacterDisplayName(characterId: CharacterId, locale: DisplayLocale): string {
  return locale === "en"
    ? characterEnglishNames[characterId]
    : getCharacterDefinition(characterId).name;
}

export function getSkillDisplayName(skillId: string, locale: DisplayLocale): string {
  const canonical = getCanonicalSkillName(skillId);
  if (canonical === undefined) {
    return skillId;
  }
  return locale === "en" ? skillEnglishNames[skillId] : canonical;
}

export function getStrictSkillDisplayName(skillId: string, locale: DisplayLocale): string {
  const canonical = getCanonicalSkillName(skillId);
  if (canonical === undefined) {
    throw new Error(`Unknown skillId for log presentation: ${skillId}`);
  }
  return locale === "en" ? skillEnglishNames[skillId] : canonical;
}

export function getCardDisplayName(definitionId: string, fallback: string, locale: DisplayLocale): string {
  return getKnownCardDisplayName(definitionId, locale) ?? fallback;
}

export function getOptionalCardDisplayName(
  definition: { id: string; name: string } | undefined,
  locale: DisplayLocale,
): string {
  return definition
    ? getCardDisplayName(definition.id, definition.name, locale)
    : (locale === "en" ? "Unknown card" : "未知卡牌");
}

export function getStrictCardDisplayName(definitionId: string, locale: DisplayLocale): string {
  const name = getKnownCardDisplayName(definitionId, locale);
  if (name === undefined) {
    throw new Error(`Unknown card definitionId for log presentation: ${definitionId}`);
  }
  return name;
}

export function getDiyRecipeDisplayName(recipeId: string, fallback: string, locale: DisplayLocale): string {
  return getKnownDiyRecipeDisplayName(recipeId, locale) ?? fallback;
}

export function getStrictDiyRecipeDisplayName(recipeId: string, locale: DisplayLocale): string {
  const name = getKnownDiyRecipeDisplayName(recipeId, locale);
  if (name === undefined) {
    throw new Error(`Unknown recipeId for log presentation: ${recipeId}`);
  }
  return name;
}

export function getStatusDisplayName(statusId: string, locale: DisplayLocale): string {
  return lookup(statusNames, statusId, locale);
}

export function getStrictStatusDisplayName(statusId: string, locale: DisplayLocale): string {
  return lookup(statusNames, statusId, locale, "statusId");
}

export function getReactionDisplayName(reactionId: string, locale: DisplayLocale): string {
  return lookup(reactionNames, reactionId, locale);
}

export function getStrictReactionDisplayName(reactionId: string, locale: DisplayLocale): string {
  return lookup(reactionNames, reactionId, locale, "reactionId");
}

export function getDamageKindDisplayName(damageKind: string, locale: DisplayLocale): string {
  return lookup(damageKindNames, damageKind, locale);
}

export function getStrictDamageKindDisplayName(damageKind: string, locale: DisplayLocale): string {
  return lookup(damageKindNames, damageKind, locale, "damageKind");
}

export function getSkillTypeDisplayName(type: CharacterSkillType, locale: DisplayLocale): string {
  return skillTypeNames[type][locale === "en" ? 1 : 0];
}

export function getImplementationStatusDisplayName(
  status: CharacterSkillImplementationStatus,
  locale: DisplayLocale,
): string {
  return implementationStatusNames[status][locale === "en" ? 1 : 0];
}

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


export function getDiyVirtualProductDisplayName(recipeId: string, locale: DisplayLocale): string {
  return lookup(diyVirtualProductNames, recipeId, locale);
}

export function getStrictDiyVirtualProductDisplayName(recipeId: string, locale: DisplayLocale): string {
  return lookup(diyVirtualProductNames, recipeId, locale, "virtual product recipeId");
}

export function getPlayerDisplayNameById(
  playerId: PlayerId,
  locale: DisplayLocale,
  context?: LogPresentationContext,
): string {
  const customName = context?.players[playerId]?.customName;
  if (customName !== undefined) {
    return customName;
  }
  if (playerId === "player_1") {
    return locale === "en" ? "Player A" : "玩家 A";
  }
  if (playerId === "player_2") {
    return locale === "en" ? "Player B" : "玩家 B";
  }
  throw new Error(`Unknown playerId for log presentation: ${playerId}`);
}

const fatalMessages: Readonly<
  Record<string, LocalizedLabel> & Record<FatalErrorCode, LocalizedLabel>
> = {
  SESSION_INITIALIZATION_FAILED: [
    "本地会话初始化失败。旧状态已被隔离，请重新开始。",
    "Local session initialization failed. The old state was isolated; please start again.",
  ],
  GAME_START_FAILED: [
    "无法创建本地对局。未保留不完整的游戏状态。",
    "A local game could not be created. No incomplete game state was kept.",
  ],
  GAME_RESTART_FAILED: [
    "无法重建本地对局。旧对局已被隔离。",
    "The local game could not be rebuilt. The old game was isolated.",
  ],
  GAME_ACTION_FAILED: [
    "处理本次操作时发生致命错误。旧对局已停止运行。",
    "A fatal error occurred while handling this action. The old game stopped running.",
  ],
  GAME_RECOVERY_FAILED: [
    "恢复操作未能创建全新对局。你可以重试或返回角色选择。",
    "Recovery could not create a new game. You may retry or return to character selection.",
  ],
  GAME_STATE_VALIDATION_FAILED: [
    "新建状态未通过会话边界校验，已阻止继续运行。",
    "The new state did not pass session-boundary validation, so continued operation was blocked.",
  ],
};

export function getFatalMessageDisplayName(
  code: string,
  fallback: string,
  locale: DisplayLocale,
): string {
  return lookup(fatalMessages, code, locale, undefined, fallback);
}
