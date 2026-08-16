import type {
  CharacterId,
  CharacterSkillId,
  CharacterSkillImplementationStatus,
  CharacterSkillType,
  DIYBlockerCode,
  DIYExecutableOutcome,
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
  key: string,
  locale: DisplayLocale,
  name?: string,
  fallback = key,
  table: Record<string, LocalizedLabel> = localeLabels,
): string {
  const entry = table[key];
  if (entry) return entry[locale === "en" ? 1 : 0];
  if (name) throw new Error(`Unknown ${name} for log presentation: ${key}`);
  return fallback;
}

function toTitleCase(id: string): string {
  return id
    .split("_")
    .map((word) => {
      if (word === "ceo" || word === "diy") return word.toUpperCase();
      if (word === "lab") return "Laboratory Bench";
      if (word === "resistant") return "resistant";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace("Acid resistant", "Acid-resistant");
}

function getCanonicalSkillName(skillId: string): string | undefined {
  for (const character of characterDefinitions) {
    const skill = character.skills.find((candidate) => candidate.id === skillId);
    if (skill !== undefined) {
      return skill.name;
    }
  }
  return undefined;
}

function getKnownDiyRecipeDisplayName(recipeId: string, locale: DisplayLocale): string | undefined {
  const canonical = diyRecipes.find((recipe) => recipe.id === recipeId)?.name;
  if (canonical === undefined) return undefined;
  if (locale !== "en") return canonical;
  return canonical.replace("稀 ", "dilute ").replace("石灰水", "limewater");
}

function getKnownCardDisplayName(definitionId: string, locale: DisplayLocale): string | undefined {
  const canonical = cardDefinitions.find((definition) => definition.id === definitionId)?.name;
  if (canonical === undefined) return undefined;
  if (locale !== "en") return canonical;
  if (definitionId === "event_lab_fire") return toTitleCase("lab_fire");
  return canonical.replace(/^稀 /, "Dilute ").replace(/^石灰水/, "Limewater");
}

const localeLabels: Readonly<Record<string, LocalizedLabel>> = {
  diy_hcl_from_h_cl: ["稀 HCl", "dilute HCl"],
  diy_h2so4_from_2h_so4: ["稀 H2SO4", "dilute H2SO4"],
  diy_naoh_from_na_oh: ["稀 NaOH", "dilute NaOH"],
  diy_koh_from_k_oh: ["稀 KOH", "dilute KOH"],
  diy_limewater_from_ca_2oh: ["石灰水 Ca(OH)2", "limewater Ca(OH)2"],
  SO2_LEAK: ["SO2 泄漏", "SO2 leak"],
  FIRE: ["火情", "Fire"],
  acid: ["酸性", "acid"],
  base: ["碱性", "alkaline"],
  acid_base_neutralization: ["酸碱中和", "Acid-base neutralization"],
  acid_carbonate_co2: ["酸与碳酸盐", "Acid and carbonate"],
  so2_alkaline_absorption: ["SO2 碱性吸收", "SO2 alkaline absorption"],
  active: ["主动", "Active"],
  passive: ["被动", "Passive"],
  response: ["响应", "Response"],
  NOT_ACTIVE_PLAYER: ["非当前行动玩家", "Not active player"],
  INVALID_PHASE: ["当前不是主行动阶段", "Not in main action phase"],
  DIY_ALREADY_USED_THIS_CYCLE: ["本周期已使用过主动 DIY", "Active DIY already used this cycle"],
  OWN_FIRE_REQUIRED: ["需要自身处于火情状态", "Requires player to be on Fire"],
  TARGET_PLAYER_REQUIRED: ["需要选择目标玩家", "Target player required"],
  TARGET_PLAYER_INVALID: ["所选目标玩家无效", "Selected target player is invalid"],
  UNEXPECTED_TARGET: ["此配方不需要选择目标", "This recipe does not accept a target"],
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

export function getCharacterDisplayName(characterId: CharacterId, locale: DisplayLocale): string {
  return locale === "en"
    ? toTitleCase(characterId)
    : getCharacterDefinition(characterId).name;
}

export function getSkillDisplayName(skillId: string, locale: DisplayLocale): string {
  const canonical = getCanonicalSkillName(skillId);
  if (canonical === undefined) {
    return skillId;
  }
  return locale === "en" ? toTitleCase(skillId) : canonical;
}

function strictVal(val: string | undefined, entity: string, id: string): string {
  if (val === undefined) {
    throw new Error(`Unknown ${entity} for log presentation: ${id}`);
  }
  return val;
}

export function getStrictSkillDisplayName(skillId: string, locale: DisplayLocale): string {
  const canonical = getCanonicalSkillName(skillId);
  strictVal(canonical, "skillId", skillId);
  return locale === "en" ? toTitleCase(skillId) : canonical!;
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
  return strictVal(getKnownCardDisplayName(definitionId, locale), "card definitionId", definitionId);
}

export function getDiyRecipeDisplayName(recipeId: string, fallback: string, locale: DisplayLocale): string {
  return getKnownDiyRecipeDisplayName(recipeId, locale) ?? fallback;
}

export function getStrictDiyRecipeDisplayName(recipeId: string, locale: DisplayLocale): string {
  return strictVal(getKnownDiyRecipeDisplayName(recipeId, locale), "recipeId", recipeId);
}

export function getStatusDisplayName(statusId: string, locale: DisplayLocale): string {
  return lookup(statusId, locale);
}

export function getStrictStatusDisplayName(statusId: string, locale: DisplayLocale): string {
  return lookup(statusId, locale, "statusId");
}

export function getReactionDisplayName(reactionId: string, locale: DisplayLocale): string {
  return lookup(reactionId, locale);
}

export function getStrictReactionDisplayName(reactionId: string, locale: DisplayLocale): string {
  return lookup(reactionId, locale, "reactionId");
}

export function getDamageKindDisplayName(damageKind: string, locale: DisplayLocale): string {
  return lookup(damageKind, locale);
}

export function getStrictDamageKindDisplayName(damageKind: string, locale: DisplayLocale): string {
  return lookup(damageKind, locale, "damageKind");
}

export function getSkillTypeDisplayName(type: CharacterSkillType, locale: DisplayLocale): string {
  return lookup(type, locale);
}

export function getImplementationStatusDisplayName(
  status: CharacterSkillImplementationStatus,
  locale: DisplayLocale,
): string {
  if (status === "display-only-8a") return locale === "en" ? "8A display only" : "8A 仅展示";
  if (status === "implemented-8c-4-partial") return locale === "en" ? "8C-4 partially implemented" : "8C-4 部分实现";
  if (status === "deferred") return locale === "en" ? "Deferred" : "延期";
  if (status.startsWith("implemented-")) {
    const code = status.slice(12).replace(/^phase/, "Phase ");
    const formatted = code.startsWith("Phase") ? code : code.toUpperCase();
    return locale === "en" ? `${formatted} implemented` : `${formatted} 已实现`;
  }
  if (status.startsWith("planned-")) {
    const code = status.slice(8).toUpperCase();
    return locale === "en" ? `${code} planned` : `${code} 计划实现`;
  }
  return status;
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

function defaultPlayerName(id: PlayerId, locale: DisplayLocale): string | undefined {
  return id === "player_1"
    ? (locale === "en" ? "Player A" : "玩家 A")
    : id === "player_2"
      ? (locale === "en" ? "Player B" : "玩家 B")
      : undefined;
}

export function getPlayerDisplayName(player: Player | undefined, locale: DisplayLocale): string {
  if (!player) return locale === "en" ? "Current player" : "当前玩家";
  return defaultPlayerName(player.id, locale) ?? player.name;
}

export function getDiyVirtualProductDisplayName(recipeId: string, locale: DisplayLocale): string {
  return lookup(recipeId, locale);
}

export function getStrictDiyVirtualProductDisplayName(recipeId: string, locale: DisplayLocale): string {
  return lookup(recipeId, locale, "virtual product recipeId");
}

export function getDiyBlockerDisplayName(blockerCode: DIYBlockerCode, locale: DisplayLocale): string {
  return lookup(blockerCode, locale);
}

export function getDiyOutcomeDescription(
  recipeId: string,
  outcome: DIYExecutableOutcome,
  locale: DisplayLocale,
  context?: LogPresentationContext,
): string {
  const en = locale === "en";
  let desc = "";
  if (outcome.kind === "CO2_REMOVE_OWN_FIRE" || outcome.kind === "H2O_REMOVE_OWN_FIRE") {
    const prod = outcome.kind.startsWith("CO2") ? "CO2" : "H2O";
    desc = en ? `Produces ${prod} and removes own Fire` : `生成 ${prod} 并移除自身火情`;
  } else if (outcome.kind === "SO2_APPLY_LEAK") {
    const target = getPlayerDisplayNameById(outcome.targetPlayerId, locale, context);
    desc = en ? `Produces SO2, giving ${target} SO2 leak` : `生成 SO2，使 ${target} 获得 SO2 泄漏`;
  } else if (outcome.kind === "VIRTUAL_ATTACK") {
    const product = getDiyVirtualProductDisplayName(recipeId, locale);
    const target = getPlayerDisplayNameById(outcome.targetPlayerId, locale, context);
    const kind = getDamageKindDisplayName(outcome.damageKind, locale);
    desc = en
      ? `Produces the virtual product ${product}; the base ${kind} damage value to ${target} is ${outcome.damageAmount} (awaiting response)`
      : `生成虚拟产品 ${product}；对 ${target} 造成 ${kind}伤害基础值 ${outcome.damageAmount} 点（等待响应）`;
  }
  return desc ? desc + (en ? "; no entity card is created." : "；不创建实体卡牌。") : "";
}

export function getPlayerDisplayNameById(
  playerId: PlayerId,
  locale: DisplayLocale,
  context?: LogPresentationContext,
): string {
  const customName = context?.players[playerId]?.customName;
  if (customName !== undefined) return customName;
  const name = defaultPlayerName(playerId, locale);
  if (name !== undefined) return name;
  throw new Error(`Unknown playerId for log presentation: ${playerId}`);
}

export function getFatalMessageDisplayName(
  code: string,
  fallback: string,
  locale: DisplayLocale,
): string {
  return lookup(code, locale, undefined, fallback);
}
