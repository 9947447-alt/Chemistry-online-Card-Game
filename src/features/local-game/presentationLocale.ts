import type {
  CharacterId,
  CharacterSkillImplementationStatus,
  CharacterSkillType,
  Player,
} from "../../game/engine/types";
import type { DisplayLocale } from "../../app/locale";

type LocalizedLabel = Readonly<Record<DisplayLocale, string>>;

function label(value: LocalizedLabel, locale: DisplayLocale): string {
  return value[locale];
}

const characterNames: Readonly<Record<CharacterId, LocalizedLabel>> = {
  laboratory_teacher: { "zh-CN": "实验室老师", en: "Laboratory Teacher" },
  chemical_factory_ceo: { "zh-CN": "化工厂 CEO", en: "Chemical Factory CEO" },
  clumsy_party_secretary: { "zh-CN": "手残党党委书记", en: "Clumsy Party Secretary" },
  caustic_soda_captain: { "zh-CN": "烧碱大队队长", en: "Caustic Soda Captain" },
  acid_king: { "zh-CN": "酸王", en: "Acid King" },
  chemistry_enthusiast: { "zh-CN": "化学爱好者", en: "Chemistry Enthusiast" },
  sulfuric_acid_factory_director: { "zh-CN": "硫酸厂厂长", en: "Sulfuric Acid Factory Director" },
};

const skillNames: Readonly<Record<string, LocalizedLabel>> = {
  lesson_preparation: { "zh-CN": "备课", en: "Lesson Preparation" },
  extra_lesson: { "zh-CN": "补课", en: "Extra Lesson" },
  capital_reserve: { "zh-CN": "资金储备", en: "Capital Reserve" },
  emergency_supply: { "zh-CN": "紧急调货", en: "Emergency Supply" },
  exhaust_leak: { "zh-CN": "尾气泄漏", en: "Exhaust Leak" },
  lab_fire: { "zh-CN": "实验台起火", en: "Laboratory Bench Fire" },
  exothermic_accident: { "zh-CN": "强放热事故", en: "Exothermic Accident" },
  strong_alkali_protection: { "zh-CN": "强碱防护", en: "Strong Alkali Protection" },
  alkali_recovery: { "zh-CN": "碱液回收", en: "Alkali Recovery" },
  strong_alkali_mastery: { "zh-CN": "强碱专精", en: "Strong Alkali Mastery" },
  acid_corrosion: { "zh-CN": "酸性侵蚀", en: "Acid Corrosion" },
  acid_resistant_layer: { "zh-CN": "耐酸层", en: "Acid-resistant Layer" },
  diy_experiment: { "zh-CN": "DIY 实验", en: "DIY Experiment" },
  experiment_counterattack: { "zh-CN": "实验反击", en: "Experiment Counterattack" },
  exhaust_discharge: { "zh-CN": "排放尾气", en: "Exhaust Discharge" },
  sulfuric_acid_process: { "zh-CN": "硫酸工艺", en: "Sulfuric Acid Process" },
  sulfate_byproduct: { "zh-CN": "硫酸盐副产", en: "Sulfate Byproduct" },
};

const cardNames: Readonly<Record<string, LocalizedLabel>> = {
  element_o: { "zh-CN": "O", en: "O" },
  element_c: { "zh-CN": "C", en: "C" },
  element_s: { "zh-CN": "S", en: "S" },
  ion_h: { "zh-CN": "H+", en: "H+" },
  ion_oh: { "zh-CN": "OH-", en: "OH-" },
  ion_co3: { "zh-CN": "CO3^2-", en: "CO3^2-" },
  ion_cl: { "zh-CN": "Cl-", en: "Cl-" },
  ion_so4: { "zh-CN": "SO4^2-", en: "SO4^2-" },
  ion_na: { "zh-CN": "Na+", en: "Na+" },
  ion_k: { "zh-CN": "K+", en: "K+" },
  ion_ca: { "zh-CN": "Ca2+", en: "Ca2+" },
  substance_h2o: { "zh-CN": "H2O", en: "H2O" },
  substance_co2: { "zh-CN": "CO2", en: "CO2" },
  substance_o2: { "zh-CN": "O2", en: "O2" },
  substance_so2: { "zh-CN": "SO2", en: "SO2" },
  substance_hcl_dilute: { "zh-CN": "稀 HCl", en: "Dilute HCl" },
  substance_h2so4_dilute: { "zh-CN": "稀 H2SO4", en: "Dilute H2SO4" },
  substance_naoh_dilute: { "zh-CN": "稀 NaOH", en: "Dilute NaOH" },
  substance_koh_dilute: { "zh-CN": "稀 KOH", en: "Dilute KOH" },
  substance_caoh2_limewater: { "zh-CN": "石灰水 Ca(OH)2", en: "Limewater Ca(OH)2" },
  substance_na2co3: { "zh-CN": "Na2CO3", en: "Na2CO3" },
  event_lab_fire: { "zh-CN": "实验台起火", en: "Laboratory Bench Fire" },
};

const diyRecipeNames: Readonly<Record<string, LocalizedLabel>> = {
  diy_co2_from_c_o_o: { "zh-CN": "C + O + O -> CO2", en: "C + O + O -> CO2" },
  diy_h2o_from_h_oh: { "zh-CN": "H+ + OH- -> H2O", en: "H+ + OH- -> H2O" },
  diy_hcl_from_h_cl: { "zh-CN": "H+ + Cl- -> 稀 HCl", en: "H+ + Cl- -> dilute HCl" },
  diy_h2so4_from_2h_so4: { "zh-CN": "2H+ + SO4^2- -> 稀 H2SO4", en: "2H+ + SO4^2- -> dilute H2SO4" },
  diy_naoh_from_na_oh: { "zh-CN": "Na+ + OH- -> 稀 NaOH", en: "Na+ + OH- -> dilute NaOH" },
  diy_koh_from_k_oh: { "zh-CN": "K+ + OH- -> 稀 KOH", en: "K+ + OH- -> dilute KOH" },
  diy_limewater_from_ca_2oh: { "zh-CN": "Ca2+ + 2OH- -> 石灰水 Ca(OH)2", en: "Ca2+ + 2OH- -> limewater Ca(OH)2" },
  diy_so2_from_s_o_o: { "zh-CN": "S + O + O -> SO2", en: "S + O + O -> SO2" },
};

const statusNames: Readonly<Record<string, LocalizedLabel>> = {
  SO2_LEAK: { "zh-CN": "SO2 泄漏", en: "SO2 leak" },
  FIRE: { "zh-CN": "火情", en: "Fire" },
};

const reactionNames: Readonly<Record<string, LocalizedLabel>> = {
  acid_base_neutralization: { "zh-CN": "酸碱中和", en: "Acid-base neutralization" },
  acid_carbonate_co2: { "zh-CN": "酸与碳酸盐", en: "Acid and carbonate" },
  so2_alkaline_absorption: { "zh-CN": "SO2 碱性吸收", en: "SO2 alkaline absorption" },
};

const skillTypeNames: Readonly<Record<CharacterSkillType, LocalizedLabel>> = {
  active: { "zh-CN": "主动", en: "Active" },
  passive: { "zh-CN": "被动", en: "Passive" },
  response: { "zh-CN": "响应", en: "Response" },
};

const implementationStatusNames: Readonly<Record<CharacterSkillImplementationStatus, LocalizedLabel>> = {
  "display-only-8a": { "zh-CN": "8A 仅展示", en: "8A display only" },
  "implemented-8b-1": { "zh-CN": "8B-1 已实现", en: "8B-1 implemented" },
  "implemented-8b-2": { "zh-CN": "8B-2 已实现", en: "8B-2 implemented" },
  "implemented-8c-2": { "zh-CN": "8C-2 已实现", en: "8C-2 implemented" },
  "implemented-8c-3": { "zh-CN": "8C-3 已实现", en: "8C-3 implemented" },
  "implemented-8c-4-partial": { "zh-CN": "8C-4 部分实现", en: "8C-4 partially implemented" },
  "implemented-phase10": { "zh-CN": "Phase 10 已实现", en: "Phase 10 implemented" },
  "planned-8b": { "zh-CN": "8B 计划实现", en: "8B planned" },
  "planned-8c": { "zh-CN": "8C 计划实现", en: "8C planned" },
  deferred: { "zh-CN": "延期", en: "Deferred" },
};

export function getCharacterDisplayName(characterId: CharacterId, locale: DisplayLocale): string {
  return label(characterNames[characterId], locale);
}

export function getSkillDisplayName(skillId: string, locale: DisplayLocale): string {
  return skillNames[skillId] ? label(skillNames[skillId], locale) : skillId;
}

export function getCardDisplayName(definitionId: string, fallback: string, locale: DisplayLocale): string {
  return cardNames[definitionId] ? label(cardNames[definitionId], locale) : fallback;
}

export function getDiyRecipeDisplayName(recipeId: string, fallback: string, locale: DisplayLocale): string {
  return diyRecipeNames[recipeId] ? label(diyRecipeNames[recipeId], locale) : fallback;
}

export function getStatusDisplayName(statusId: string, locale: DisplayLocale): string {
  return statusNames[statusId] ? label(statusNames[statusId], locale) : statusId;
}

export function getReactionDisplayName(reactionId: string, locale: DisplayLocale): string {
  return reactionNames[reactionId] ? label(reactionNames[reactionId], locale) : reactionId;
}

export function getSkillTypeDisplayName(type: CharacterSkillType, locale: DisplayLocale): string {
  return label(skillTypeNames[type], locale);
}

export function getImplementationStatusDisplayName(
  status: CharacterSkillImplementationStatus,
  locale: DisplayLocale,
): string {
  return label(implementationStatusNames[status], locale);
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

const fatalMessages: Readonly<Record<string, LocalizedLabel>> = {
  SESSION_INITIALIZATION_FAILED: {
    "zh-CN": "本地会话初始化失败。旧状态已被隔离，请重新开始。",
    en: "Local session initialization failed. The old state was isolated; please start again.",
  },
  GAME_START_FAILED: {
    "zh-CN": "无法创建本地对局。未保留不完整的游戏状态。",
    en: "A local game could not be created. No incomplete game state was kept.",
  },
  GAME_RESTART_FAILED: {
    "zh-CN": "无法重建本地对局。旧对局已被隔离。",
    en: "The local game could not be rebuilt. The old game was isolated.",
  },
  GAME_ACTION_FAILED: {
    "zh-CN": "处理本次操作时发生致命错误。旧对局已停止运行。",
    en: "A fatal error occurred while handling this action. The old game stopped running.",
  },
  GAME_RECOVERY_FAILED: {
    "zh-CN": "恢复操作未能创建全新对局。你可以重试或返回角色选择。",
    en: "Recovery could not create a new game. You may retry or return to character selection.",
  },
  GAME_STATE_VALIDATION_FAILED: {
    "zh-CN": "新建状态未通过会话边界校验，已阻止继续运行。",
    en: "The new state did not pass session-boundary validation, so continued operation was blocked.",
  },
};

export function getFatalMessageDisplayName(
  code: string,
  fallback: string,
  locale: DisplayLocale,
): string {
  return fatalMessages[code] ? label(fatalMessages[code], locale) : fallback;
}
