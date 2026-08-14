import type { DisplayLocale } from "../../app/locale";
import type {
  GameLogEntry,
  GameLogEventKey,
  GameLogParamsMap,
  LogPresentationContext,
} from "../../game/engine/types";
import {
  getPlayerDisplayNameById,
  getStrictCardDisplayName,
  getStrictDamageKindDisplayName,
  getStrictDiyRecipeDisplayName,
  getStrictDiyVirtualProductDisplayName,
  getStrictSkillDisplayName,
  getStrictStatusDisplayName,
} from "./presentationLocale";

type LogRendererMap = {
  [E in GameLogEventKey]: (
    params: GameLogParamsMap[E],
    locale: DisplayLocale,
    context: LogPresentationContext,
    entry: Extract<GameLogEntry, { eventKey: E }>,
  ) => string;
};

export const logRenderers: LogRendererMap = {
  game_start: (params, locale) =>
    locale === "en"
      ? `Game started; entering experiment cycle ${params.cycleNumber}.`
      : `游戏开始，进入第 ${params.cycleNumber} 实验周期。`,

  recycle_discard_into_deck: (_, locale) =>
    locale === "en"
      ? "The main deck was insufficient; the discard pile was shuffled back into the deck."
      : "主牌堆不足，弃牌堆洗回主牌堆。",

  draw_stopped_empty: (_, locale) =>
    locale === "en"
      ? "Both the main deck and discard pile were empty; drawing stopped."
      : "主牌堆与弃牌堆均为空，摸牌停止。",

  cycle_cleanup_discard_hands: (_, locale) =>
    locale === "en"
      ? "The experiment cycle ended; all remaining hands were discarded."
      : "实验周期结束，所有剩余手牌进入弃牌堆。",

  cycle_start: (params, locale) =>
    locale === "en"
      ? `Entering experiment cycle ${params.cycleNumber}.`
      : `进入第 ${params.cycleNumber} 实验周期。`,

  round_start: (params, locale) =>
    locale === "en"
      ? `Entering experiment round ${params.roundInCycle}.`
      : `进入第 ${params.roundInCycle} 实验轮次。`,

  turn_start: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en" ? `It is ${player}'s turn.` : `轮到 ${player} 行动。`;
  },

  laboratory_preparation_confirmed: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en"
      ? `${player} completed lesson preparation, keeping ${params.keepCount} cards.`
      : `${player} 完成备课，保留 ${params.keepCount} 张牌。`;
  },

  status_window_start: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    const status = getStrictStatusDisplayName(params.statusId, locale);
    return locale === "en"
      ? `${player} begins handling ${status}.`
      : `${player} 开始处理 ${status}。`;
  },

  status_gained: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    const status = getStrictStatusDisplayName(params.statusId, locale);
    return locale === "en"
      ? `${player} gained ${status}.`
      : `${player} 获得 ${status}。`;
  },

  status_refreshed: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    const status = getStrictStatusDisplayName(params.statusId, locale);
    return locale === "en"
      ? `${player}'s ${status} was refreshed / re-applied.`
      : `${player} 的 ${status} 已刷新/重复施加。`;
  },

  status_handled_fire: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    const card = getStrictCardDisplayName(params.cardDefinitionId, locale);
    return locale === "en"
      ? `${player} used ${card} to handle Fire.`
      : `${player} 使用 ${card} 处理火情。`;
  },

  status_passed_damage: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    const status = getStrictStatusDisplayName(params.statusId, locale);
    return locale === "en"
      ? `${player} did not handle ${status}, taking ${params.amount} status damage; ${status} persists.`
      : `${player} 未处理 ${status}，受到 ${params.amount} 点状态伤害；${status} 保留。`;
  },

  card_play_so2: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.actorId, locale, context);
    const target = getPlayerDisplayNameById(params.targetId, locale, context);
    return locale === "en"
      ? `${player} played SO2, giving ${target} SO2 leak; no immediate damage.`
      : `${player} 打出 SO2，使 ${target} 获得 SO2 泄漏；不造成即时伤害。`;
  },

  card_play_o2: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.actorId, locale, context);
    return locale === "en"
      ? `${player} used O2 and recovered ${params.amount} HP.`
      : `${player} 使用 O2，回复 ${params.amount} HP。`;
  },

  card_play_reference: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.actorId, locale, context);
    const card = getStrictCardDisplayName(params.cardDefinitionId, locale);
    return locale === "en"
      ? `${player} played ${card} as the table reference; its original effect does not trigger.`
      : `${player} 普通出牌 ${card}，作为场面基准；不触发原有效果。`;
  },

  card_play_attack: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.actorId, locale, context);
    const card = getStrictCardDisplayName(params.cardDefinitionId, locale);
    const target = getPlayerDisplayNameById(params.targetId, locale, context);
    const kindText = getStrictDamageKindDisplayName(params.damageKind, locale);
    return locale === "en"
      ? `${player} played ${card}; the base ${kindText} damage value to ${target} is ${params.baseAmount}, awaiting response.`
      : `${player} 打出 ${card}，对 ${target} 的${kindText}伤害基础值为 ${params.baseAmount} 点，等待响应。`;
  },

  response_pass_damage: (params, locale, context) => {
    const target = getPlayerDisplayNameById(params.targetId, locale, context);
    const kindText = getStrictDamageKindDisplayName(params.damageKind, locale);
    return locale === "en"
      ? `${target} declined to respond and took ${params.amount} ${kindText} damage.`
      : `${target} 放弃响应，受到 ${params.amount} 点${kindText}伤害。`;
  },

  response_pass_so2: (params, locale, context) => {
    const target = getPlayerDisplayNameById(params.targetId, locale, context);
    return locale === "en"
      ? `${target} declined alkaline absorption and took ${params.amount} SO2 damage.`
      : `${target} 放弃碱性吸收，受到 ${params.amount} 点 SO2 伤害。`;
  },

  lose_hp: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en"
      ? `${player} lost ${params.amount} HP.`
      : `${player} 失去 ${params.amount} 点体力。`;
  },

  eliminated: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en"
      ? `${player}'s HP dropped to 0 and was eliminated.`
      : `${player} HP 降至 0，被淘汰。`;
  },

  winner: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en" ? `${player} wins.` : `${player} 获胜。`;
  },

  draw_game: (_, locale) =>
    locale === "en"
      ? "All players were eliminated; the game is a draw."
      : "所有玩家均被淘汰，本局平局。",

  sulfate_byproduct_draw: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en"
      ? `${player}'s sulfate byproduct settled successfully and drew 1 card.`
      : `${player} 的硫酸盐副产成功结算，摸 1 张牌。`;
  },

  skill_draw: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    const skill = getStrictSkillDisplayName(params.skillId, locale);
    return locale === "en"
      ? `${player} activated ${skill} and drew ${params.amount} cards; this action ends.`
      : `${player} 发动${skill}，实际摸 ${params.amount} 张牌，本行动结束。`;
  },

  skill_alkali_recovery: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    const card = getStrictCardDisplayName(params.cardDefinitionId, locale);
    return locale === "en"
      ? `${player} activated Alkali Recovery, discarded ${card}, and recovered ${params.amount} HP; this action ends.`
      : `${player} 发动碱液回收，弃置 ${card}，回复 ${params.amount} HP，本行动结束。`;
  },

  skill_exhaust_discharge: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.actorId, locale, context);
    const target = getPlayerDisplayNameById(params.targetId, locale, context);
    return locale === "en"
      ? `${player} activated Exhaust Discharge, giving ${target} SO2 leak; no immediate damage; this action ends.`
      : `${player} 发动排放尾气，使 ${target} 获得 SO2 泄漏；不造成即时伤害，本行动结束。`;
  },

  skill_exhaust_leak: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en"
      ? `${player} activated Exhaust Leak; awaiting alkaline absorption responses from ${params.targetCount} targets in stable order.`
      : `${player} 发动尾气泄漏，按稳定顺序等待 ${params.targetCount} 名目标分别进行碱性吸收响应。`;
  },

  skill_lab_fire: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en"
      ? `${player} activated Laboratory Bench Fire, applying Fire to all other surviving players via a virtual character-skill effect; this action ends.`
      : `${player} 发动实验台起火，以虚拟角色技能效果向所有其他存活玩家施加火情；本行动结束。`;
  },

  skill_exothermic_accident: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en"
      ? `${player} activated Exothermic Accident; all other surviving players lose ${params.amount} HP.`
      : `${player} 发动强放热事故，所有其他存活玩家失去 ${params.amount} 点体力。`;
  },

  counterattack_window_open: (params, locale, context) => {
    const responder = getPlayerDisplayNameById(params.responderId, locale, context);
    const attacker = getPlayerDisplayNameById(params.attackerId, locale, context);
    return locale === "en"
      ? `${responder} fully cancelled ${attacker}'s attack and entered the experiment counterattack selection window.`
      : `${responder} 成功完全抵消来自 ${attacker} 的攻击，进入实验反击选择窗口。`;
  },

  counterattack_recover: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en"
      ? `${player} activated the experiment counterattack and recovered ${params.amount} HP.`
      : `${player} 发动实验反击，回复 ${params.amount} HP。`;
  },

  counterattack_pursuit: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    const card = getStrictCardDisplayName(params.cardDefinitionId, locale);
    const target = getPlayerDisplayNameById(params.targetId, locale, context);
    return locale === "en"
      ? `${player} activated the experiment counterattack, used ${card} to pursue ${target}, and dealt ${params.amount} damage.`
      : `${player} 发动实验反击，使用 ${card} 追击 ${target}，造成 ${params.amount} 点伤害。`;
  },

  diy_co2_remove_fire: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en"
      ? `${player} used active DIY to produce CO2 and remove Fire; no CO2 card is created.`
      : `${player} 主动 DIY 生成 CO2 并移除火情；不创建 CO2 卡牌。`;
  },

  diy_h2o_remove_fire: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    return locale === "en"
      ? `${player} used active DIY to produce H2O and remove Fire; no H2O card is created.`
      : `${player} 主动 DIY 生成 H2O 并移除火情；不创建 H2O 卡牌。`;
  },

  diy_virtual_attack: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.playerId, locale, context);
    const recipe = getStrictDiyRecipeDisplayName(params.recipeId, locale);
    const product = getStrictDiyVirtualProductDisplayName(params.recipeId, locale);
    const target = getPlayerDisplayNameById(params.targetId, locale, context);
    const kindText = getStrictDamageKindDisplayName(params.damageKind, locale);
    return locale === "en"
      ? `${player} used active DIY recipe ${recipe} to produce the virtual product ${product}; the base ${kindText} damage value to ${target} is ${params.amount}, awaiting response; no entity card is created.`
      : `${player} 主动 DIY 使用 ${recipe}，生成虚拟产品 ${product}；对 ${target} 的${kindText}伤害基础值为 ${params.amount} 点，等待响应；不创建实体卡牌。`;
  },

  diy_so2_apply_leak: (params, locale, context) => {
    const player = getPlayerDisplayNameById(params.actorId, locale, context);
    const target = getPlayerDisplayNameById(params.targetId, locale, context);
    return locale === "en"
      ? `${player} used active DIY to produce SO2, giving ${target} SO2 leak; no SO2 card is created.`
      : `${player} 主动 DIY 生成 SO2，使 ${target} 获得 SO2 泄漏；不创建 SO2 卡牌。`;
  },

  reaction: (_, locale) =>
    locale === "en" ? "A successful reaction was recorded." : "已记录一项成功反应。",
};

export function renderGameLogEntry(
  entry: GameLogEntry,
  locale: DisplayLocale = "zh-CN",
  context: LogPresentationContext = { players: {} },
): string {
  switch (entry.eventKey) {
    case "game_start":
      return logRenderers.game_start(entry.params, locale, context, entry);
    case "recycle_discard_into_deck":
      return logRenderers.recycle_discard_into_deck(entry.params, locale, context, entry);
    case "draw_stopped_empty":
      return logRenderers.draw_stopped_empty(entry.params, locale, context, entry);
    case "cycle_cleanup_discard_hands":
      return logRenderers.cycle_cleanup_discard_hands(entry.params, locale, context, entry);
    case "cycle_start":
      return logRenderers.cycle_start(entry.params, locale, context, entry);
    case "round_start":
      return logRenderers.round_start(entry.params, locale, context, entry);
    case "turn_start":
      return logRenderers.turn_start(entry.params, locale, context, entry);
    case "laboratory_preparation_confirmed":
      return logRenderers.laboratory_preparation_confirmed(entry.params, locale, context, entry);
    case "status_window_start":
      return logRenderers.status_window_start(entry.params, locale, context, entry);
    case "status_gained":
      return logRenderers.status_gained(entry.params, locale, context, entry);
    case "status_refreshed":
      return logRenderers.status_refreshed(entry.params, locale, context, entry);
    case "status_handled_fire":
      return logRenderers.status_handled_fire(entry.params, locale, context, entry);
    case "status_passed_damage":
      return logRenderers.status_passed_damage(entry.params, locale, context, entry);
    case "card_play_so2":
      return logRenderers.card_play_so2(entry.params, locale, context, entry);
    case "card_play_o2":
      return logRenderers.card_play_o2(entry.params, locale, context, entry);
    case "card_play_reference":
      return logRenderers.card_play_reference(entry.params, locale, context, entry);
    case "card_play_attack":
      return logRenderers.card_play_attack(entry.params, locale, context, entry);
    case "response_pass_damage":
      return logRenderers.response_pass_damage(entry.params, locale, context, entry);
    case "response_pass_so2":
      return logRenderers.response_pass_so2(entry.params, locale, context, entry);
    case "lose_hp":
      return logRenderers.lose_hp(entry.params, locale, context, entry);
    case "eliminated":
      return logRenderers.eliminated(entry.params, locale, context, entry);
    case "winner":
      return logRenderers.winner(entry.params, locale, context, entry);
    case "draw_game":
      return logRenderers.draw_game(entry.params, locale, context, entry);
    case "sulfate_byproduct_draw":
      return logRenderers.sulfate_byproduct_draw(entry.params, locale, context, entry);
    case "skill_draw":
      return logRenderers.skill_draw(entry.params, locale, context, entry);
    case "skill_alkali_recovery":
      return logRenderers.skill_alkali_recovery(entry.params, locale, context, entry);
    case "skill_exhaust_discharge":
      return logRenderers.skill_exhaust_discharge(entry.params, locale, context, entry);
    case "skill_exhaust_leak":
      return logRenderers.skill_exhaust_leak(entry.params, locale, context, entry);
    case "skill_lab_fire":
      return logRenderers.skill_lab_fire(entry.params, locale, context, entry);
    case "skill_exothermic_accident":
      return logRenderers.skill_exothermic_accident(entry.params, locale, context, entry);
    case "counterattack_window_open":
      return logRenderers.counterattack_window_open(entry.params, locale, context, entry);
    case "counterattack_recover":
      return logRenderers.counterattack_recover(entry.params, locale, context, entry);
    case "counterattack_pursuit":
      return logRenderers.counterattack_pursuit(entry.params, locale, context, entry);
    case "diy_co2_remove_fire":
      return logRenderers.diy_co2_remove_fire(entry.params, locale, context, entry);
    case "diy_h2o_remove_fire":
      return logRenderers.diy_h2o_remove_fire(entry.params, locale, context, entry);
    case "diy_virtual_attack":
      return logRenderers.diy_virtual_attack(entry.params, locale, context, entry);
    case "diy_so2_apply_leak":
      return logRenderers.diy_so2_apply_leak(entry.params, locale, context, entry);
    case "reaction":
      return logRenderers.reaction(entry.params, locale, context, entry);
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
}
