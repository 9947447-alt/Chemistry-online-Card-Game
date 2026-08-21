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

type LogRenderer<E extends GameLogEventKey> = (
  params: GameLogParamsMap[E],
  locale: DisplayLocale,
  context: LogPresentationContext,
  entry: Extract<GameLogEntry, { eventKey: E }>,
) => string;

type LogRendererMap = {
  [E in GameLogEventKey]: LogRenderer<E>;
};

function fmt(
  locale: DisplayLocale,
  zh: string,
  en: string,
  ...args: (string | number)[]
): string {
  return (locale === "en" ? en : zh).replace(
    /\$(\d)/g,
    (_, index: string) => String(args[+index]),
  );
}

function staticRenderer<E extends GameLogEventKey>(
  zh: string,
  en: string,
): LogRenderer<E> {
  return (_, locale) => fmt(locale, zh, en);
}

const P = getPlayerDisplayNameById;
const C = getStrictCardDisplayName;
const S = getStrictSkillDisplayName;
const T = getStrictStatusDisplayName;
const D = getStrictDamageKindDisplayName;
const R = getStrictDiyRecipeDisplayName;
const V = getStrictDiyVirtualProductDisplayName;

export const logRenderers: LogRendererMap = {
  game_start: (p, l) => fmt(l, "游戏开始，进入第 $0 实验周期。", "Game started; entering experiment cycle $0.", p.cycleNumber),
  recycle_discard_into_deck: staticRenderer("主牌堆不足，弃牌堆洗回主牌堆。", "The main deck was insufficient; the discard pile was shuffled back into the deck."),
  draw_stopped_empty: staticRenderer("主牌堆与弃牌堆均为空，摸牌停止。", "Both the main deck and discard pile were empty; drawing stopped."),
  cycle_cleanup_discard_hands: staticRenderer("实验周期结束，所有剩余手牌进入弃牌堆。", "The experiment cycle ended; all remaining hands were discarded."),
  cycle_start: (p, l) => fmt(l, "进入第 $0 实验周期。", "Entering experiment cycle $0.", p.cycleNumber),
  round_start: (p, l) => fmt(l, "进入第 $0 实验轮次。", "Entering experiment round $0.", p.roundInCycle),
  turn_start: (p, l, c) => fmt(l, "轮到 $0 行动。", "It is $0's turn.", P(p.playerId, l, c)),
  laboratory_preparation_confirmed: (p, l, c) => fmt(l, "$0 完成备课，保留 $1 张牌。", "$0 completed lesson preparation, keeping $1 cards.", P(p.playerId, l, c), p.keepCount),
  status_window_start: (p, l, c) => fmt(l, "$0 开始处理 $1。", "$0 begins handling $1.", P(p.playerId, l, c), T(p.statusId, l)),
  status_gained: (p, l, c) => fmt(l, "$0 获得 $1。", "$0 gained $1.", P(p.playerId, l, c), T(p.statusId, l)),
  status_refreshed: (p, l, c) => fmt(l, "$0 的 $1 已刷新/重复施加。", "$0's $1 was refreshed / re-applied.", P(p.playerId, l, c), T(p.statusId, l)),
  status_handled_fire: (p, l, c) => fmt(l, "$0 使用 $1 处理火情。", "$0 used $1 to handle Fire.", P(p.playerId, l, c), C(p.cardDefinitionId, l)),
  status_passed_damage: (p, l, c) => fmt(l, "$0 未处理 $1，受到 $2 点状态伤害；$1 保留。", "$0 did not handle $1, taking $2 status damage; $1 persists.", P(p.playerId, l, c), T(p.statusId, l), p.amount),
  card_play_so2: (p, l, c) => fmt(l, "$0 打出 SO2，使 $1 获得 SO2 泄漏；不造成即时伤害。", "$0 played SO2, giving $1 SO2 leak; no immediate damage.", P(p.actorId, l, c), P(p.targetId, l, c)),
  card_play_o2: (p, l, c) => fmt(l, "$0 使用 O2，回复 $1 HP。", "$0 used O2 and recovered $1 HP.", P(p.actorId, l, c), p.amount),
  card_play_reference: (p, l, c) => fmt(l, "$0 普通出牌 $1，作为场面基准；不触发原有效果。", "$0 played $1 as the table reference; its original effect does not trigger.", P(p.actorId, l, c), C(p.cardDefinitionId, l)),
  card_play_attack: (p, l, c) => fmt(l, "$0 打出 $1，对 $2 的$3伤害基础值为 $4 点，等待响应。", "$0 played $1; the base $3 damage value to $2 is $4, awaiting response.", P(p.actorId, l, c), C(p.cardDefinitionId, l), P(p.targetId, l, c), D(p.damageKind, l), p.baseAmount),
  response_pass_damage: (p, l, c) => fmt(l, "$0 放弃响应，受到 $1 点$2伤害。", "$0 declined to respond and took $1 $2 damage.", P(p.targetId, l, c), p.amount, D(p.damageKind, l)),
  response_pass_so2: (p, l, c) => fmt(l, "$0 放弃碱性吸收，受到 $1 点 SO2 伤害。", "$0 declined alkaline absorption and took $1 SO2 damage.", P(p.targetId, l, c), p.amount),
  lose_hp: (p, l, c) => fmt(l, "$0 失去 $1 点体力。", "$0 lost $1 HP.", P(p.playerId, l, c), p.amount),
  eliminated: (p, l, c) => fmt(l, "$0 HP 降至 0，被淘汰。", "$0's HP dropped to 0 and was eliminated.", P(p.playerId, l, c)),
  winner: (p, l, c) => fmt(l, "$0 获胜。", "$0 wins.", P(p.playerId, l, c)),
  draw_game: staticRenderer("所有玩家均被淘汰，本局平局。", "All players were eliminated; the game is a draw."),
  sulfate_byproduct_draw: (p, l, c) => fmt(l, "$0 的硫酸盐副产成功结算，摸 1 张牌。", "$0's sulfate byproduct settled successfully and drew 1 card.", P(p.playerId, l, c)),
  skill_draw: (p, l, c) => fmt(l, "$0 发动$1，实际摸 $2 张牌，本行动结束。", "$0 activated $1 and drew $2 cards; this action ends.", P(p.playerId, l, c), S(p.skillId, l), p.amount),
  skill_alkali_recovery: (p, l, c) => fmt(l, "$0 发动碱液回收，弃置 $1，回复 $2 HP，本行动结束。", "$0 activated Alkali Recovery, discarded $1, and recovered $2 HP; this action ends.", P(p.playerId, l, c), C(p.cardDefinitionId, l), p.amount),
  skill_exhaust_discharge: (p, l, c) => fmt(l, "$0 发动排放尾气，使 $1 获得 SO2 泄漏；不造成即时伤害，本行动结束。", "$0 activated Exhaust Discharge, giving $1 SO2 leak; no immediate damage; this action ends.", P(p.actorId, l, c), P(p.targetId, l, c)),
  skill_exhaust_leak: (p, l, c) => fmt(l, "$0 发动尾气泄漏，按稳定顺序等待 $1 名目标分别进行碱性吸收响应。", "$0 activated Exhaust Leak; awaiting alkaline absorption responses from $1 targets in stable order.", P(p.playerId, l, c), p.targetCount),
  skill_lab_fire: (p, l, c) => fmt(l, "$0 发动实验台起火，以虚拟角色技能效果向所有其他存活玩家施加火情；本行动结束。", "$0 activated Laboratory Bench Fire, applying Fire to all other surviving players via a virtual character-skill effect; this action ends.", P(p.playerId, l, c)),
  skill_exothermic_accident: (p, l, c) => fmt(l, "$0 发动强放热事故，所有其他存活玩家失去 $1 点体力。", "$0 activated Exothermic Accident; all other surviving players lose $1 HP.", P(p.playerId, l, c), p.amount),
  counterattack_window_open: (p, l, c) => fmt(l, "$0 成功完全抵消来自 $1 的攻击，进入实验反击选择窗口。", "$0 fully cancelled $1's attack and entered the experiment counterattack selection window.", P(p.responderId, l, c), P(p.attackerId, l, c)),
  counterattack_recover: (p, l, c) => fmt(l, "$0 发动实验反击，回复 $1 HP。", "$0 activated the experiment counterattack and recovered $1 HP.", P(p.playerId, l, c), p.amount),
  counterattack_pursuit: (p, l, c) => fmt(l, "$0 发动实验反击，使用 $1 追击 $2，造成 $3 点伤害。", "$0 activated the experiment counterattack, used $1 to pursue $2, and dealt $3 damage.", P(p.playerId, l, c), C(p.cardDefinitionId, l), P(p.targetId, l, c), p.amount),
  diy_co2_remove_fire: (p, l, c) => fmt(l, "$0 主动 DIY 生成 CO2 并移除火情；不创建 CO2 卡牌。", "$0 used active DIY to produce CO2 and remove Fire; no CO2 card is created.", P(p.playerId, l, c)),
  diy_h2o_remove_fire: (p, l, c) => fmt(l, "$0 主动 DIY 生成 H2O 并移除火情；不创建 H2O 卡牌。", "$0 used active DIY to produce H2O and remove Fire; no H2O card is created.", P(p.playerId, l, c)),
  diy_virtual_attack: (p, l, c) => fmt(l, "$0 主动 DIY 使用 $1，生成虚拟产品 $2；对 $3 的$4伤害基础值为 $5 点，等待响应；不创建实体卡牌。", "$0 used active DIY recipe $1 to produce the virtual product $2; the base $4 damage value to $3 is $5, awaiting response; no entity card is created.", P(p.playerId, l, c), R(p.recipeId, l), V(p.recipeId, l), P(p.targetId, l, c), D(p.damageKind, l), p.amount),
  diy_so2_apply_leak: (p, l, c) => fmt(l, "$0 主动 DIY 生成 SO2，使 $1 获得 SO2 泄漏；不创建 SO2 卡牌。", "$0 used active DIY to produce SO2, giving $1 SO2 leak; no SO2 card is created.", P(p.actorId, l, c), P(p.targetId, l, c)),
  reaction: staticRenderer("已记录一项成功反应。", "A successful reaction was recorded."),
};

export function renderGameLogEntry(
  entry: GameLogEntry,
  locale: DisplayLocale = "zh-CN",
  context: LogPresentationContext = { players: {} },
): string {
  return (logRenderers[entry.eventKey] as any)(entry.params, locale, context, entry);
}
