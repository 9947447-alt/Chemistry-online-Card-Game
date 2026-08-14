import { describe, expect, it } from "vitest";
import { renderGameLogEntry } from "../../features/local-game/gameLogRenderer";
import type { CardInstanceId, GameLogEntry, GameState, LogPresentationContext, PlayerId, StatusId } from "../engine/types";
import type { GameAction } from "../engine/actions";
import { getPublicReactionLogView } from "../../features/local-game/localGameView";
import { createInitialGame } from "../engine/createInitialGame";
import { identityShuffle } from "../../shared/random";
import {
  getStrictCardDisplayName,
  getStrictDamageKindDisplayName,
  getStrictDiyRecipeDisplayName,
  getStrictDiyVirtualProductDisplayName,
  getStrictReactionDisplayName,
  getStrictSkillDisplayName,
  getStrictStatusDisplayName,
  getPlayerDisplayNameById,
} from "../../features/local-game/presentationLocale";
import { engineReducer } from "../engine/reducer";
import { applyDamage } from "../engine/damage";
import { applyLoseHpBatch } from "../engine/loseHp";
import { drawCardsForPlayer } from "../engine/turnFlow";

function putCardInHand(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): GameState {
  const card = state.cardInstances[cardInstanceId];
  if (!card) {
    throw new Error(`Missing card ${cardInstanceId}`);
  }

  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand: player.id === playerId
        ? [...player.hand.filter((id) => id !== cardInstanceId), cardInstanceId]
        : player.hand.filter((id) => id !== cardInstanceId),
    })),
    deck: state.deck.filter((id) => id !== cardInstanceId),
    discardPile: state.discardPile.filter((id) => id !== cardInstanceId),
    cardInstances: {
      ...state.cardInstances,
      [cardInstanceId]: {
        ...card,
        ownerId: playerId,
        zone: { type: "hand", playerId },
      },
    },
  };
}

function addStatus(
  state: GameState,
  playerId: PlayerId,
  statusId: StatusId,
): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            statuses: [
              ...p.statuses,
              { id: `status_${statusId}_${Date.now()}`, statusId, createdAt: Date.now() },
            ],
          }
        : p,
    ),
  };
}

describe("Phase 16 GameLog Independent Oracle Tests", () => {
  const context: LogPresentationContext = {
    players: {
      player_1: { playerId: "player_1", customName: "玩家 1" },
      player_2: { playerId: "player_2", customName: "玩家 2" },
    },
  };

  const dummyState: GameState = createInitialGame({
    characterIds: ["laboratory_teacher", "chemical_factory_ceo"],
    shuffle: identityShuffle,
  });

  const oracleCases: Array<{
    name: string;
    entry: GameLogEntry;
    expectedZh: string;
    expectedEn: string;
  }> = [
    {
      name: "game_start",
      entry: { id: "1", eventKey: "game_start", params: { cycleNumber: 1 } },
      expectedZh: "游戏开始，进入第 1 实验周期。",
      expectedEn: "Game started; entering experiment cycle 1.",
    },
    {
      name: "recycle_discard_into_deck",
      entry: { id: "2", eventKey: "recycle_discard_into_deck", params: {} },
      expectedZh: "主牌堆不足，弃牌堆洗回主牌堆。",
      expectedEn: "The main deck was insufficient; the discard pile was shuffled back into the deck.",
    },
    {
      name: "draw_stopped_empty",
      entry: { id: "3", eventKey: "draw_stopped_empty", params: {} },
      expectedZh: "主牌堆与弃牌堆均为空，摸牌停止。",
      expectedEn: "Both the main deck and discard pile were empty; drawing stopped.",
    },
    {
      name: "cycle_cleanup_discard_hands",
      entry: { id: "4", eventKey: "cycle_cleanup_discard_hands", params: {} },
      expectedZh: "实验周期结束，所有剩余手牌进入弃牌堆。",
      expectedEn: "The experiment cycle ended; all remaining hands were discarded.",
    },
    {
      name: "cycle_start",
      entry: { id: "5", eventKey: "cycle_start", params: { cycleNumber: 2 } },
      expectedZh: "进入第 2 实验周期。",
      expectedEn: "Entering experiment cycle 2.",
    },
    {
      name: "round_start",
      entry: { id: "6", eventKey: "round_start", params: { roundInCycle: 1 } },
      expectedZh: "进入第 1 实验轮次。",
      expectedEn: "Entering experiment round 1.",
    },
    {
      name: "turn_start",
      entry: { id: "7", eventKey: "turn_start", params: { playerId: "player_1" } },
      expectedZh: "轮到 玩家 1 行动。",
      expectedEn: "It is 玩家 1's turn.",
    },
    {
      name: "laboratory_preparation_confirmed",
      entry: { id: "8", eventKey: "laboratory_preparation_confirmed", params: { playerId: "player_1", keepCount: 3 } },
      expectedZh: "玩家 1 完成备课，保留 3 张牌。",
      expectedEn: "玩家 1 completed lesson preparation, keeping 3 cards.",
    },
    {
      name: "status_window_start",
      entry: { id: "9", eventKey: "status_window_start", params: { playerId: "player_1", statusId: "FIRE" } },
      expectedZh: "玩家 1 开始处理 火情。",
      expectedEn: "玩家 1 begins handling Fire.",
    },
    {
      name: "status_gained",
      entry: { id: "10", eventKey: "status_gained", params: { playerId: "player_1", statusId: "FIRE" } },
      expectedZh: "玩家 1 获得 火情。",
      expectedEn: "玩家 1 gained Fire.",
    },
    {
      name: "status_refreshed",
      entry: { id: "11", eventKey: "status_refreshed", params: { playerId: "player_1", statusId: "SO2_LEAK" } },
      expectedZh: "玩家 1 的 SO2 泄漏 已刷新/重复施加。",
      expectedEn: "玩家 1's SO2 leak was refreshed / re-applied.",
    },
    {
      name: "status_handled_fire",
      entry: { id: "12", eventKey: "status_handled_fire", params: { playerId: "player_1", cardDefinitionId: "substance_h2o" } },
      expectedZh: "玩家 1 使用 H2O 处理火情。",
      expectedEn: "玩家 1 used H2O to handle Fire.",
    },
    {
      name: "status_passed_damage",
      entry: { id: "13", eventKey: "status_passed_damage", params: { playerId: "player_1", statusId: "FIRE", amount: 2 } },
      expectedZh: "玩家 1 未处理 火情，受到 2 点状态伤害；火情 保留。",
      expectedEn: "玩家 1 did not handle Fire, taking 2 status damage; Fire persists.",
    },
    {
      name: "card_play_so2",
      entry: { id: "14", eventKey: "card_play_so2", params: { actorId: "player_1", targetId: "player_2" } },
      expectedZh: "玩家 1 打出 SO2，使 玩家 2 获得 SO2 泄漏；不造成即时伤害。",
      expectedEn: "玩家 1 played SO2, giving 玩家 2 SO2 leak; no immediate damage.",
    },
    {
      name: "card_play_o2",
      entry: { id: "15", eventKey: "card_play_o2", params: { actorId: "player_1", amount: 2 } },
      expectedZh: "玩家 1 使用 O2，回复 2 HP。",
      expectedEn: "玩家 1 used O2 and recovered 2 HP.",
    },
    {
      name: "card_play_reference",
      entry: { id: "16", eventKey: "card_play_reference", params: { actorId: "player_1", cardDefinitionId: "substance_hcl_dilute" } },
      expectedZh: "玩家 1 普通出牌 稀 HCl，作为场面基准；不触发原有效果。",
      expectedEn: "玩家 1 played Dilute HCl as the table reference; its original effect does not trigger.",
    },
    {
      name: "card_play_attack",
      entry: { id: "17", eventKey: "card_play_attack", params: { actorId: "player_1", cardDefinitionId: "substance_hcl_dilute", targetId: "player_2", damageKind: "acid", baseAmount: 2 } },
      expectedZh: "玩家 1 打出 稀 HCl，对 玩家 2 的酸性伤害基础值为 2 点，等待响应。",
      expectedEn: "玩家 1 played Dilute HCl; the base acid damage value to 玩家 2 is 2, awaiting response.",
    },
    {
      name: "response_pass_damage",
      entry: { id: "18", eventKey: "response_pass_damage", params: { targetId: "player_2", damageKind: "base", amount: 1 } },
      expectedZh: "玩家 2 放弃响应，受到 1 点碱性伤害。",
      expectedEn: "玩家 2 declined to respond and took 1 alkaline damage.",
    },
    {
      name: "response_pass_so2",
      entry: { id: "19", eventKey: "response_pass_so2", params: { targetId: "player_2", amount: 2 } },
      expectedZh: "玩家 2 放弃碱性吸收，受到 2 点 SO2 伤害。",
      expectedEn: "玩家 2 declined alkaline absorption and took 2 SO2 damage.",
    },
    {
      name: "lose_hp",
      entry: { id: "20", eventKey: "lose_hp", params: { playerId: "player_1", amount: 1 } },
      expectedZh: "玩家 1 失去 1 点体力。",
      expectedEn: "玩家 1 lost 1 HP.",
    },
    {
      name: "eliminated",
      entry: { id: "21", eventKey: "eliminated", params: { playerId: "player_2" } },
      expectedZh: "玩家 2 HP 降至 0，被淘汰。",
      expectedEn: "玩家 2's HP dropped to 0 and was eliminated.",
    },
    {
      name: "winner",
      entry: { id: "22", eventKey: "winner", params: { playerId: "player_1" } },
      expectedZh: "玩家 1 获胜。",
      expectedEn: "玩家 1 wins.",
    },
    {
      name: "draw_game",
      entry: { id: "23", eventKey: "draw_game", params: {} },
      expectedZh: "所有玩家均被淘汰，本局平局。",
      expectedEn: "All players were eliminated; the game is a draw.",
    },
    {
      name: "sulfate_byproduct_draw",
      entry: { id: "24", eventKey: "sulfate_byproduct_draw", params: { playerId: "player_1" } },
      expectedZh: "玩家 1 的硫酸盐副产成功结算，摸 1 张牌。",
      expectedEn: "玩家 1's sulfate byproduct settled successfully and drew 1 card.",
    },
    {
      name: "skill_draw",
      entry: { id: "25", eventKey: "skill_draw", params: { playerId: "player_1", skillId: "extra_lesson", amount: 2 } },
      expectedZh: "玩家 1 发动补课，实际摸 2 张牌，本行动结束。",
      expectedEn: "玩家 1 activated Extra Lesson and drew 2 cards; this action ends.",
    },
    {
      name: "skill_alkali_recovery",
      entry: { id: "26", eventKey: "skill_alkali_recovery", params: { playerId: "player_1", cardDefinitionId: "substance_naoh_dilute", amount: 1 } },
      expectedZh: "玩家 1 发动碱液回收，弃置 稀 NaOH，回复 1 HP，本行动结束。",
      expectedEn: "玩家 1 activated Alkali Recovery, discarded Dilute NaOH, and recovered 1 HP; this action ends.",
    },
    {
      name: "skill_exhaust_discharge",
      entry: { id: "27", eventKey: "skill_exhaust_discharge", params: { actorId: "player_1", targetId: "player_2" } },
      expectedZh: "玩家 1 发动排放尾气，使 玩家 2 获得 SO2 泄漏；不造成即时伤害，本行动结束。",
      expectedEn: "玩家 1 activated Exhaust Discharge, giving 玩家 2 SO2 leak; no immediate damage; this action ends.",
    },
    {
      name: "skill_exhaust_leak",
      entry: { id: "28", eventKey: "skill_exhaust_leak", params: { playerId: "player_1", targetCount: 1 } },
      expectedZh: "玩家 1 发动尾气泄漏，按稳定顺序等待 1 名目标分别进行碱性吸收响应。",
      expectedEn: "玩家 1 activated Exhaust Leak; awaiting alkaline absorption responses from 1 targets in stable order.",
    },
    {
      name: "skill_lab_fire",
      entry: { id: "29", eventKey: "skill_lab_fire", params: { playerId: "player_1" } },
      expectedZh: "玩家 1 发动实验台起火，以虚拟角色技能效果向所有其他存活玩家施加火情；本行动结束。",
      expectedEn: "玩家 1 activated Laboratory Bench Fire, applying Fire to all other surviving players via a virtual character-skill effect; this action ends.",
    },
    {
      name: "skill_exothermic_accident",
      entry: { id: "30", eventKey: "skill_exothermic_accident", params: { playerId: "player_1", amount: 1 } },
      expectedZh: "玩家 1 发动强放热事故，所有其他存活玩家失去 1 点体力。",
      expectedEn: "玩家 1 activated Exothermic Accident; all other surviving players lose 1 HP.",
    },
    {
      name: "counterattack_window_open",
      entry: { id: "31", eventKey: "counterattack_window_open", params: { responderId: "player_2", attackerId: "player_1" } },
      expectedZh: "玩家 2 成功完全抵消来自 玩家 1 的攻击，进入实验反击选择窗口。",
      expectedEn: "玩家 2 fully cancelled 玩家 1's attack and entered the experiment counterattack selection window.",
    },
    {
      name: "counterattack_recover",
      entry: { id: "32", eventKey: "counterattack_recover", params: { playerId: "player_2", amount: 1 } },
      expectedZh: "玩家 2 发动实验反击，回复 1 HP。",
      expectedEn: "玩家 2 activated the experiment counterattack and recovered 1 HP.",
    },
    {
      name: "counterattack_pursuit",
      entry: { id: "33", eventKey: "counterattack_pursuit", params: { playerId: "player_2", cardDefinitionId: "substance_hcl_dilute", targetId: "player_1", amount: 2 } },
      expectedZh: "玩家 2 发动实验反击，使用 稀 HCl 追击 玩家 1，造成 2 点伤害。",
      expectedEn: "玩家 2 activated the experiment counterattack, used Dilute HCl to pursue 玩家 1, and dealt 2 damage.",
    },
    {
      name: "diy_co2_remove_fire",
      entry: { id: "34", eventKey: "diy_co2_remove_fire", params: { playerId: "player_1" } },
      expectedZh: "玩家 1 主动 DIY 生成 CO2 并移除火情；不创建 CO2 卡牌。",
      expectedEn: "玩家 1 used active DIY to produce CO2 and remove Fire; no CO2 card is created.",
    },
    {
      name: "diy_h2o_remove_fire",
      entry: { id: "35", eventKey: "diy_h2o_remove_fire", params: { playerId: "player_1" } },
      expectedZh: "玩家 1 主动 DIY 生成 H2O 并移除火情；不创建 H2O 卡牌。",
      expectedEn: "玩家 1 used active DIY to produce H2O and remove Fire; no H2O card is created.",
    },
    {
      name: "diy_virtual_attack",
      entry: { id: "36", eventKey: "diy_virtual_attack", params: { playerId: "player_1", recipeId: "diy_naoh_from_na_oh", targetId: "player_2", damageKind: "base", amount: 1 } },
      expectedZh: "玩家 1 主动 DIY 使用 Na+ + OH- -> 稀 NaOH，生成虚拟产品 稀 NaOH；对 玩家 2 的碱性伤害基础值为 1 点，等待响应；不创建实体卡牌。",
      expectedEn: "玩家 1 used active DIY recipe Na+ + OH- -> dilute NaOH to produce the virtual product dilute NaOH; the base alkaline damage value to 玩家 2 is 1, awaiting response; no entity card is created.",
    },
    {
      name: "diy_so2_apply_leak",
      entry: { id: "37", eventKey: "diy_so2_apply_leak", params: { actorId: "player_1", targetId: "player_2" } },
      expectedZh: "玩家 1 主动 DIY 生成 SO2，使 玩家 2 获得 SO2 泄漏；不创建 SO2 卡牌。",
      expectedEn: "玩家 1 used active DIY to produce SO2, giving 玩家 2 SO2 leak; no SO2 card is created.",
    },
  ];

  it.each(oracleCases)("renders $name accurately in zh-CN and en", ({ entry, expectedZh, expectedEn }) => {
    const renderedZh = renderGameLogEntry(entry, "zh-CN", context);
    const renderedEn = renderGameLogEntry(entry, "en", context);

    expect(renderedZh).toBe(expectedZh);
    expect(renderedEn).toBe(expectedEn);
  });

  describe("5 DIY Virtual Attack Products Oracle", () => {
    const virtualAttackCases = [
      {
        recipeId: "diy_hcl_from_h_cl",
        damageKind: "acid" as const,
        recipeZh: "H+ + Cl- -> 稀 HCl",
        recipeEn: "H+ + Cl- -> dilute HCl",
        productZh: "稀 HCl",
        productEn: "dilute HCl",
      },
      {
        recipeId: "diy_h2so4_from_2h_so4",
        damageKind: "acid" as const,
        recipeZh: "2H+ + SO4^2- -> 稀 H2SO4",
        recipeEn: "2H+ + SO4^2- -> dilute H2SO4",
        productZh: "稀 H2SO4",
        productEn: "dilute H2SO4",
      },
      {
        recipeId: "diy_naoh_from_na_oh",
        damageKind: "base" as const,
        recipeZh: "Na+ + OH- -> 稀 NaOH",
        recipeEn: "Na+ + OH- -> dilute NaOH",
        productZh: "稀 NaOH",
        productEn: "dilute NaOH",
      },
      {
        recipeId: "diy_koh_from_k_oh",
        damageKind: "base" as const,
        recipeZh: "K+ + OH- -> 稀 KOH",
        recipeEn: "K+ + OH- -> dilute KOH",
        productZh: "稀 KOH",
        productEn: "dilute KOH",
      },
      {
        recipeId: "diy_limewater_from_ca_2oh",
        damageKind: "base" as const,
        recipeZh: "Ca2+ + 2OH- -> 石灰水 Ca(OH)2",
        recipeEn: "Ca2+ + 2OH- -> limewater Ca(OH)2",
        productZh: "石灰水 Ca(OH)2",
        productEn: "limewater Ca(OH)2",
      },
    ];

    it.each(virtualAttackCases)("accurately presents recipe and product for $recipeId", (item) => {
      const entry: GameLogEntry = {
        id: "va1",
        eventKey: "diy_virtual_attack",
        params: {
          playerId: "player_1",
          recipeId: item.recipeId,
          targetId: "player_2",
          damageKind: item.damageKind,
          amount: 1,
        },
      };

      const zh = renderGameLogEntry(entry, "zh-CN", context);
      const en = renderGameLogEntry(entry, "en", context);

      const kindZh = item.damageKind === "acid" ? "酸性" : "碱性";
      const kindEn = item.damageKind === "acid" ? "acid" : "alkaline";
      const expectedZh = `玩家 1 主动 DIY 使用 ${item.recipeZh}，生成虚拟产品 ${item.productZh}；对 玩家 2 的${kindZh}伤害基础值为 1 点，等待响应；不创建实体卡牌。`;
      const expectedEn = `玩家 1 used active DIY recipe ${item.recipeEn} to produce the virtual product ${item.productEn}; the base ${kindEn} damage value to 玩家 2 is 1, awaiting response; no entity card is created.`;

      expect(zh).toBe(expectedZh);
      expect(en).toBe(expectedEn);
    });
  });

  describe("Player Identity Context 3-State Tests", () => {
    it("State 1: playerNames omitted -> dynamic zh 玩家 A/B, en Player A/B", () => {
      const state = createInitialGame({ shuffle: identityShuffle });
      expect(state.logPresentationContext.players.player_1.customName).toBeUndefined();
      expect(state.logPresentationContext.players.player_2.customName).toBeUndefined();

      expect(getPlayerDisplayNameById("player_1", "zh-CN", state.logPresentationContext)).toBe("玩家 A");
      expect(getPlayerDisplayNameById("player_1", "en", state.logPresentationContext)).toBe("Player A");
      expect(getPlayerDisplayNameById("player_2", "zh-CN", state.logPresentationContext)).toBe("玩家 B");
      expect(getPlayerDisplayNameById("player_2", "en", state.logPresentationContext)).toBe("Player B");

      const entry: GameLogEntry = { id: "t1", eventKey: "turn_start", params: { playerId: "player_1" } };
      expect(renderGameLogEntry(entry, "zh-CN", state.logPresentationContext)).toBe("轮到 玩家 A 行动。");
      expect(renderGameLogEntry(entry, "en", state.logPresentationContext)).toBe("It is Player A's turn.");
    });

    it("State 2: playerNames explicitly set to '玩家 A' -> customName saved, en stays '玩家 A'", () => {
      const state = createInitialGame({ playerNames: ["玩家 A", "玩家 B"], shuffle: identityShuffle });
      expect(state.logPresentationContext.players.player_1.customName).toBe("玩家 A");
      expect(state.logPresentationContext.players.player_2.customName).toBe("玩家 B");

      expect(getPlayerDisplayNameById("player_1", "zh-CN", state.logPresentationContext)).toBe("玩家 A");
      expect(getPlayerDisplayNameById("player_1", "en", state.logPresentationContext)).toBe("玩家 A");
      expect(getPlayerDisplayNameById("player_2", "zh-CN", state.logPresentationContext)).toBe("玩家 B");
      expect(getPlayerDisplayNameById("player_2", "en", state.logPresentationContext)).toBe("玩家 B");

      const entry: GameLogEntry = { id: "t2", eventKey: "turn_start", params: { playerId: "player_1" } };
      expect(renderGameLogEntry(entry, "zh-CN", state.logPresentationContext)).toBe("轮到 玩家 A 行动。");
      expect(renderGameLogEntry(entry, "en", state.logPresentationContext)).toBe("It is 玩家 A's turn.");
    });

    it("State 3: playerNames explicitly set to empty strings -> customName is empty string, not omitted", () => {
      const state = createInitialGame({ playerNames: ["", ""], shuffle: identityShuffle });
      expect(state.logPresentationContext.players.player_1.customName).toBe("");
      expect(state.logPresentationContext.players.player_2.customName).toBe("");

      expect(getPlayerDisplayNameById("player_1", "zh-CN", state.logPresentationContext)).toBe("");
      expect(getPlayerDisplayNameById("player_1", "en", state.logPresentationContext)).toBe("");

      const entry: GameLogEntry = { id: "t3", eventKey: "turn_start", params: { playerId: "player_1" } };
      expect(renderGameLogEntry(entry, "zh-CN", state.logPresentationContext)).toBe("轮到  行动。");
      expect(renderGameLogEntry(entry, "en", state.logPresentationContext)).toBe("It is 's turn.");
    });
  });

  describe("Strict Presentation Fail-Fast Tests (No Technical ID Leak)", () => {
    it("throws on unknown card definitionId", () => {
      expect(() => getStrictCardDisplayName("unknown_card_id", "zh-CN")).toThrowError(/unknown_card_id/i);
    });

    it("throws on unknown skillId", () => {
      expect(() => getStrictSkillDisplayName("unknown_skill_id", "zh-CN")).toThrowError(/unknown_skill_id/i);
    });

    it("throws on unknown statusId", () => {
      expect(() => getStrictStatusDisplayName("UNKNOWN_STATUS", "zh-CN")).toThrowError(/UNKNOWN_STATUS/i);
    });

    it("throws on unknown diy recipeId", () => {
      expect(() => getStrictDiyRecipeDisplayName("unknown_recipe_id", "zh-CN")).toThrowError(/unknown_recipe_id/i);
    });

    it("throws on unknown virtual product recipeId", () => {
      expect(() => getStrictDiyVirtualProductDisplayName("unknown_recipe_id", "zh-CN")).toThrowError(/unknown_recipe_id/i);
    });

    it("throws on unknown reaction definitionId", () => {
      expect(() => getStrictReactionDisplayName("unknown_reaction_id", "zh-CN")).toThrowError(/unknown_reaction_id/i);
    });

    it("throws on unknown damageKind", () => {
      expect(() => getStrictDamageKindDisplayName("unknown_damage_kind", "zh-CN")).toThrowError(/unknown_damage_kind/i);
    });

    it("throws on unknown playerId without customName", () => {
      expect(() => getPlayerDisplayNameById("player_99", "zh-CN", { players: {} as any })).toThrowError(/player_99/i);
    });
  });

  describe("Reaction Event 4 Variants Oracle", () => {
    it("renders acid_base_neutralization reaction event", () => {
      const entry: GameLogEntry = {
        id: "r1",
        eventKey: "reaction",
        params: {},
        reaction: {
          definitionId: "acid_base_neutralization",
          trigger: { kind: "single-damage-response", responsePolicy: "acid-base" },
          participants: [
            {
              kind: "card",
              playerId: "player_1",
              cardInstanceId: "c1",
              cardDefinitionId: "substance_hcl_dilute",
              role: "attacker",
            },
            {
              kind: "card",
              playerId: "player_2",
              cardInstanceId: "c2",
              cardDefinitionId: "substance_naoh_dilute",
              role: "responder",
            },
          ],
          outcome: { kind: "virtual-product", product: "H2O", damageCancelled: true },
        },
      };

      const zhNotice = getPublicReactionLogView(dummyState, entry, "zh-CN", context);
      const enNotice = getPublicReactionLogView(dummyState, entry, "en", context);

      expect(zhNotice).toBeDefined();
      expect(enNotice).toBeDefined();
      expect(zhNotice?.name).toBe("酸碱中和");
      expect(enNotice?.name).toBe("Acid-base neutralization");
      expect(zhNotice?.trigger).toBe("单目标伤害响应");
      expect(enNotice?.trigger).toBe("Single-target damage response");
      expect(zhNotice?.participants).toEqual(["攻击来源：玩家 1 · 稀 HCl", "响应牌：玩家 2 · 稀 NaOH"]);
      expect(enNotice?.participants).toEqual(["Attack source: 玩家 1 · Dilute HCl", "Response card: 玩家 2 · Dilute NaOH"]);
      expect(zhNotice?.outcome).toBe("伤害已完全抵消；生成虚拟结果 H2O");
      expect(enNotice?.outcome).toBe("Damage was fully cancelled; virtual result H2O was produced");
    });

    it("renders acid_carbonate_co2 reaction event", () => {
      const entry: GameLogEntry = {
        id: "r2",
        eventKey: "reaction",
        params: {},
        reaction: {
          definitionId: "acid_carbonate_co2",
          trigger: { kind: "single-damage-response", responsePolicy: "acid-base" },
          participants: [
            {
              kind: "card",
              playerId: "player_1",
              cardInstanceId: "c1",
              cardDefinitionId: "substance_hcl_dilute",
              role: "attacker",
            },
            {
              kind: "card",
              playerId: "player_2",
              cardInstanceId: "c2",
              cardDefinitionId: "substance_na2co3",
              role: "responder",
            },
          ],
          outcome: { kind: "virtual-product", product: "CO2", damageCancelled: true },
        },
      };

      const zhNotice = getPublicReactionLogView(dummyState, entry, "zh-CN", context);
      const enNotice = getPublicReactionLogView(dummyState, entry, "en", context);

      expect(zhNotice).toBeDefined();
      expect(enNotice).toBeDefined();
      expect(zhNotice?.name).toBe("酸与碳酸盐");
      expect(enNotice?.name).toBe("Acid and carbonate");
      expect(zhNotice?.outcome).toBe("伤害已完全抵消；生成虚拟结果 CO2");
      expect(enNotice?.outcome).toBe("Damage was fully cancelled; virtual result CO2 was produced");
    });

    it("renders so2_alkaline_absorption (multi-target) reaction event", () => {
      const entry: GameLogEntry = {
        id: "r3",
        eventKey: "reaction",
        params: {},
        reaction: {
          definitionId: "so2_alkaline_absorption",
          trigger: { kind: "multi-target-damage-response", sourceSkillId: "exhaust_leak" },
          participants: [
            {
              kind: "character-skill",
              sourcePlayerId: "player_1",
              skillId: "exhaust_leak",
              role: "attacker",
            },
            {
              kind: "card",
              playerId: "player_2",
              cardInstanceId: "c2",
              cardDefinitionId: "substance_naoh_dilute",
              role: "responder",
            },
          ],
          outcome: { kind: "damage-cancelled", finalDamage: 0 },
        },
      };

      const zhNotice = getPublicReactionLogView(dummyState, entry, "zh-CN", context);
      const enNotice = getPublicReactionLogView(dummyState, entry, "en", context);

      expect(zhNotice).toBeDefined();
      expect(enNotice).toBeDefined();
      expect(zhNotice?.name).toBe("SO2 碱性吸收");
      expect(enNotice?.name).toBe("SO2 alkaline absorption");
      expect(zhNotice?.participants).toEqual(["攻击来源：玩家 1 · 尾气泄漏", "响应牌：玩家 2 · 稀 NaOH"]);
      expect(enNotice?.participants).toEqual(["Attack source: 玩家 1 · Exhaust Leak", "Response card: 玩家 2 · Dilute NaOH"]);
      expect(zhNotice?.outcome).toBe("伤害已完全抵消");
      expect(enNotice?.outcome).toBe("Damage was fully cancelled");
    });

    it("renders so2_alkaline_absorption (status-handling) reaction event", () => {
      const entry: GameLogEntry = {
        id: "r4",
        eventKey: "reaction",
        params: {},
        reaction: {
          definitionId: "so2_alkaline_absorption",
          trigger: { kind: "status-handling", statusId: "SO2_LEAK" },
          participants: [
            {
              kind: "status",
              targetPlayerId: "player_2",
              statusInstanceId: "s1",
              statusId: "SO2_LEAK",
              role: "affected-status",
            },
            {
              kind: "card",
              playerId: "player_2",
              cardInstanceId: "c2",
              cardDefinitionId: "substance_naoh_dilute",
              role: "status-handler",
            },
          ],
          outcome: {
            kind: "status-removed",
            targetPlayerId: "player_2",
            statusInstanceId: "s1",
            statusId: "SO2_LEAK",
          },
        },
      };

      const zhNotice = getPublicReactionLogView(dummyState, entry, "zh-CN", context);
      const enNotice = getPublicReactionLogView(dummyState, entry, "en", context);

      expect(zhNotice).toBeDefined();
      expect(enNotice).toBeDefined();
      expect(zhNotice?.name).toBe("SO2 碱性吸收");
      expect(enNotice?.name).toBe("SO2 alkaline absorption");
      expect(zhNotice?.participants).toEqual(["被处理状态：玩家 2 · 待处理状态", "状态处理牌：玩家 2 · 稀 NaOH"]);
      expect(enNotice?.participants).toEqual(["Status being handled: 玩家 2 · Status being handled", "Status handler card: 玩家 2 · Dilute NaOH"]);
      expect(zhNotice?.outcome).toBe("待处理状态已移除");
      expect(enNotice?.outcome).toBe("The pending status was removed");
    });
  });

  describe("Formal Producer Write-Path Contract Tests (10 Producers, 38 Keys, 44 Paths)", () => {
    it("File 1: createInitialGame -> game_start", () => {
      const state = createInitialGame({ shuffle: identityShuffle });
      expect(state.log[0]).toEqual({
        id: "log_001",
        eventKey: "game_start",
        params: { cycleNumber: 1 },
      });
    });

    it("File 2: turnFlow -> turn_start, cycle_cleanup, cycle_start, round_start, preparation, status_window_start (path 1), draw empty/recycle, winner, draw_game", () => {
      // 1. turn_start
      const state = createInitialGame({
        characterIds: ["chemical_factory_ceo", "acid_king"],
        shuffle: identityShuffle,
      });
      const afterPass1 = engineReducer(state, { type: "PASS_ACTION", playerId: "player_1" });
      const turnStart = afterPass1.log.find((e) => e.eventKey === "turn_start");
      expect(turnStart).toBeDefined();
      expect(turnStart?.params).toEqual({ playerId: "player_2" });

      // 2. preparation
      const teacherState = createInitialGame({
        characterIds: ["laboratory_teacher", "chemical_factory_ceo"],
        shuffle: identityShuffle,
      });
      const candidateIds = teacherState.pendingLaboratoryPreparation?.candidateCardInstanceIds.slice(0, 10) ?? [];
      const afterPrep = engineReducer(teacherState, {
        type: "CONFIRM_LABORATORY_PREPARATION",
        playerId: "player_1",
        keptCardInstanceIds: candidateIds,
      });
      const prepLog = afterPrep.log.find((e) => e.eventKey === "laboratory_preparation_confirmed");
      expect(prepLog).toBeDefined();
      expect(prepLog?.params).toEqual({ playerId: "player_1", keepCount: 10 });

      // 3. status_window_start (path 1: beginActionForPlayer)
      let withStatusState = state;
      withStatusState = addStatus(withStatusState, "player_2", "FIRE");
      const afterTurn1 = engineReducer(withStatusState, { type: "PASS_ACTION", playerId: "player_1" });
      const statusWindowLog = afterTurn1.log.find((e) => e.eventKey === "status_window_start");
      expect(statusWindowLog).toBeDefined();
      expect(statusWindowLog?.params).toEqual({ playerId: "player_2", statusId: "FIRE" });

      // 4. recycle_discard_into_deck & draw_stopped_empty
      let emptyDeckState: GameState = {
        ...state,
        deck: [],
        discardPile: ["substance_o2_01"],
        players: state.players.map((p, i) => (i === 0 ? { ...p, hand: [] } : p)),
      };
      emptyDeckState = drawCardsForPlayer(emptyDeckState, "player_1", 2, identityShuffle);
      expect(emptyDeckState.log.some((e) => e.eventKey === "recycle_discard_into_deck")).toBe(true);
      expect(emptyDeckState.log.some((e) => e.eventKey === "draw_stopped_empty")).toBe(true);

      // 5. cycle_cleanup_discard_hands, round_start, cycle_start
      let advanceState = state;
      for (let i = 0; i < 6; i++) {
        advanceState = engineReducer(advanceState, {
          type: "PASS_ACTION",
          playerId: advanceState.activePlayerId,
        });
      }
      expect(advanceState.log.some((e) => e.eventKey === "round_start" && e.params.roundInCycle === 2)).toBe(true);
      expect(advanceState.log.some((e) => e.eventKey === "cycle_cleanup_discard_hands")).toBe(true);
      expect(advanceState.log.some((e) => e.eventKey === "cycle_start" && e.params.cycleNumber === 2)).toBe(true);

      // 6. winner & draw_game
      const oneDeadState: GameState = {
        ...state,
        players: state.players.map((p, idx) => (idx === 1 ? { ...p, hp: 0, eliminated: true } : p)),
      };
      const winState = engineReducer(oneDeadState, { type: "PASS_ACTION", playerId: "player_1" });
      const winnerLog = winState.log.find((e) => e.eventKey === "winner");
      expect(winnerLog).toBeDefined();
      expect(winnerLog?.params).toEqual({ playerId: "player_1" });

      const drawState = applyLoseHpBatch(state, [
        { targetPlayerId: "player_1", amount: 10 },
        { targetPlayerId: "player_2", amount: 10 },
      ]);
      expect(drawState.log.some((e) => e.eventKey === "draw_game")).toBe(true);
    });

    it("File 3: resolution -> attack, pass response, o2, so2, reference, handle fire, pass status, status_window_start (path 2), status_gained (path 1), status_refreshed (path 1), 3 reactions", () => {
      let state = createInitialGame({
        characterIds: ["chemical_factory_ceo", "caustic_soda_captain"],
        shuffle: identityShuffle,
      });

      // 1. card_play_attack & response_pass_damage
      const hclCard = "substance_hcl_dilute_01";
      state = putCardInHand(state, "player_1", hclCard);
      state = engineReducer(state, { type: "PLAY_CARD", playerId: "player_1", cardInstanceId: hclCard, targetPlayerId: "player_2" });
      const attackLog = state.log.find((e) => e.eventKey === "card_play_attack");
      expect(attackLog).toBeDefined();
      expect(attackLog?.params).toEqual({
        actorId: "player_1",
        cardDefinitionId: "substance_hcl_dilute",
        targetId: "player_2",
        damageKind: "acid",
        baseAmount: 1,
      });

      // Pass response
      state = engineReducer(state, { type: "PASS_RESPONSE", playerId: "player_2" });
      const passLog = state.log.find((e) => e.eventKey === "response_pass_damage");
      expect(passLog).toBeDefined();
      expect(passLog?.params).toEqual({ targetId: "player_2", damageKind: "acid", amount: 1 });

      // 2. card_play_o2
      const o2Card = "substance_o2_01";
      state = {
        ...state,
        activePlayerId: "player_2",
        tableReference: undefined,
        players: state.players.map((p, i) => (i === 1 ? { ...p, hp: 1 } : p)),
      };
      state = putCardInHand(state, "player_2", o2Card);
      state = engineReducer(state, {
        type: "PLAY_CARD",
        playerId: "player_2",
        cardInstanceId: o2Card,
        targetPlayerId: "player_2",
      });
      const o2Log = state.log.find((e) => e.eventKey === "card_play_o2");
      expect(o2Log).toBeDefined();
      expect(o2Log?.params).toEqual({ actorId: "player_2", amount: 2 });

      // 3. card_play_so2, status_gained (path 1), status_refreshed (path 1)
      const so2Card1 = "substance_so2_01";
      const so2Card2 = "substance_so2_02";
      state = { ...state, activePlayerId: "player_1", tableReference: undefined };
      state = putCardInHand(state, "player_1", so2Card1);
      state = putCardInHand(state, "player_1", so2Card2);
      state = engineReducer(state, { type: "PLAY_CARD", playerId: "player_1", cardInstanceId: so2Card1, targetPlayerId: "player_2" });
      const so2Log = state.log.find((e) => e.eventKey === "card_play_so2");
      expect(so2Log).toBeDefined();
      const statusGained1 = state.log.find((e) => e.eventKey === "status_gained" && e.params.statusId === "SO2_LEAK");
      expect(statusGained1).toBeDefined();

      // Play second SO2 on same target -> status_refreshed (path 1)
      state = {
        ...state,
        phase: "mainAction",
        pendingStatusHandling: undefined,
        activePlayerId: "player_1",
        tableReference: undefined,
      };
      state = engineReducer(state, { type: "PLAY_CARD", playerId: "player_1", cardInstanceId: so2Card2, targetPlayerId: "player_2" });
      const statusRefreshed1 = state.log.find((e) => e.eventKey === "status_refreshed" && e.params.statusId === "SO2_LEAK");
      expect(statusRefreshed1).toBeDefined();

      // 4. card_play_reference
      const co2Card = "substance_co2_01";
      state = {
        ...state,
        phase: "mainAction",
        pendingStatusHandling: undefined,
        activePlayerId: "player_1",
        tableReference: undefined,
      };
      state = putCardInHand(state, "player_1", co2Card);
      state = engineReducer(state, { type: "PLAY_REFERENCE_CARD", playerId: "player_1", cardInstanceId: co2Card });
      const refLog = state.log.find((e) => e.eventKey === "card_play_reference");
      expect(refLog).toBeDefined();

      // 5. handle fire & pass status damage & status_window_start (path 2)
      const h2oCard = "substance_h2o_01";
      state = {
        ...state,
        phase: "statusWindow",
        activePlayerId: "player_1",
        pendingStatusHandling: { playerId: "player_1", statusInstanceId: "fire_01" },
        players: state.players.map((p, i) =>
          i === 0
            ? {
                ...p,
                statuses: [
                  { id: "fire_01", statusId: "FIRE", createdAt: 1 },
                  { id: "so2_02", statusId: "SO2_LEAK", createdAt: 2 },
                ],
              }
            : p,
        ),
      };
      state = putCardInHand(state, "player_1", h2oCard);
      state = engineReducer(state, {
        type: "HANDLE_STATUS_WITH_CARD",
        playerId: "player_1",
        statusInstanceId: "fire_01",
        cardInstanceId: h2oCard,
      });
      expect(state.log.some((e) => e.eventKey === "status_handled_fire")).toBe(true);
      expect(state.log.some((e) => e.eventKey === "status_window_start" && e.params.statusId === "SO2_LEAK")).toBe(true);

      // Now pass the SO2 status
      state = engineReducer(state, {
        type: "PASS_STATUS_HANDLING",
        playerId: "player_1",
        statusInstanceId: "so2_02",
      });
      expect(state.log.some((e) => e.eventKey === "status_passed_damage")).toBe(true);

      // 6. Reaction variants in resolution:
      // Neutralization:
      const naohCard = "substance_naoh_dilute_01";
      state = {
        ...state,
        phase: "mainAction",
        activePlayerId: "player_1",
        pendingResponse: undefined,
        tableReference: undefined,
      };
      state = putCardInHand(state, "player_1", hclCard);
      state = putCardInHand(state, "player_2", naohCard);
      state = engineReducer(state, { type: "PLAY_CARD", playerId: "player_1", cardInstanceId: hclCard, targetPlayerId: "player_2" });
      state = engineReducer(state, { type: "RESPOND_WITH_CARD", playerId: "player_2", cardInstanceId: naohCard });
      const reactionNeutralization = state.log.find((e) => e.eventKey === "reaction" && e.reaction.definitionId === "acid_base_neutralization");
      expect(reactionNeutralization).toBeDefined();

      // Carbonate:
      const na2co3Card = "substance_na2co3_01";
      state = {
        ...state,
        phase: "mainAction",
        activePlayerId: "player_1",
        pendingResponse: undefined,
        tableReference: undefined,
      };
      state = putCardInHand(state, "player_1", hclCard);
      state = putCardInHand(state, "player_2", na2co3Card);
      state = engineReducer(state, { type: "PLAY_CARD", playerId: "player_1", cardInstanceId: hclCard, targetPlayerId: "player_2" });
      state = engineReducer(state, { type: "RESPOND_WITH_CARD", playerId: "player_2", cardInstanceId: na2co3Card });
      const reactionCarbonate = state.log.find((e) => e.eventKey === "reaction" && e.reaction.definitionId === "acid_carbonate_co2");
      expect(reactionCarbonate).toBeDefined();

      // SO2 status handling reaction:
      state = {
        ...state,
        phase: "statusWindow",
        pendingStatusHandling: { playerId: "player_2", statusInstanceId: "so2_handle" },
        players: state.players.map((p, i) =>
          i === 1 ? { ...p, statuses: [{ id: "so2_handle", statusId: "SO2_LEAK", createdAt: 1 }] } : p,
        ),
      };
      state = putCardInHand(state, "player_2", naohCard);
      state = engineReducer(state, { type: "HANDLE_STATUS_WITH_CARD", playerId: "player_2", statusInstanceId: "so2_handle", cardInstanceId: naohCard });
      const reactionSo2Status = state.log.find((e) => e.eventKey === "reaction" && e.reaction.definitionId === "so2_alkaline_absorption" && e.reaction.trigger.kind === "status-handling");
      expect(reactionSo2Status).toBeDefined();
    });

    it("File 4 & 5: damage & loseHp -> eliminated (paths 1 & 2), lose_hp", () => {
      const state = createInitialGame({ shuffle: identityShuffle });
      // lose_hp
      const afterLose = applyLoseHpBatch(state, [{ targetPlayerId: "player_2", amount: 1 }]);
      expect(afterLose.log.some((e) => e.eventKey === "lose_hp" && e.params.amount === 1)).toBe(true);

      // eliminated (path 2 in applyLoseHpBatch)
      const afterElim = applyLoseHpBatch(state, [{ targetPlayerId: "player_2", amount: 10 }]);
      expect(afterElim.log.some((e) => e.eventKey === "eliminated" && e.params.playerId === "player_2")).toBe(true);

      // eliminated (path 1 in applyDamage via attack with 1 HP defender)
      let stateLowHp = createInitialGame({ shuffle: identityShuffle });
      stateLowHp = {
        ...stateLowHp,
        phase: "mainAction",
        activePlayerId: "player_1",
        tableReference: undefined,
        players: stateLowHp.players.map((p, i) => (i === 1 ? { ...p, hp: 1 } : p)),
      };
      const hcl = "substance_hcl_dilute_01";
      stateLowHp = putCardInHand(stateLowHp, "player_1", hcl);
      const afterPlay = engineReducer(stateLowHp, { type: "PLAY_CARD", playerId: "player_1", cardInstanceId: hcl, targetPlayerId: "player_2" });
      const afterPass = engineReducer(afterPlay, { type: "PASS_RESPONSE", playerId: "player_2" });
      expect(afterPass.log.some((e) => e.eventKey === "eliminated" && e.params.playerId === "player_2")).toBe(true);
    });

    it("File 6: reactions -> sulfate_byproduct_draw", () => {
      let state = createInitialGame({
        characterIds: ["sulfuric_acid_factory_director", "chemical_factory_ceo"],
        shuffle: identityShuffle,
      });
      const h2so4 = "substance_h2so4_dilute_01";
      const naoh = "substance_naoh_dilute_01";
      state = putCardInHand(state, "player_1", h2so4);
      state = putCardInHand(state, "player_2", naoh);
      state = engineReducer(state, { type: "PLAY_CARD", playerId: "player_1", cardInstanceId: h2so4, targetPlayerId: "player_2" });
      state = engineReducer(state, { type: "RESPOND_WITH_CARD", playerId: "player_2", cardInstanceId: naoh });
      expect(state.log.some((e) => e.eventKey === "sulfate_byproduct_draw" && e.params.playerId === "player_1")).toBe(true);
    });

    it("File 7: multiTargetResponse -> response_pass_so2 & reaction (path 4)", () => {
      let state = createInitialGame({
        characterIds: ["clumsy_party_secretary", "caustic_soda_captain"],
        shuffle: identityShuffle,
      });
      // Clumsy party secretary activates exhaust_leak
      const afterLeak = engineReducer(state, { type: "ACTIVATE_CHARACTER_SKILL", playerId: "player_1", skillId: "exhaust_leak" });
      expect(afterLeak.log.some((e) => e.eventKey === "skill_exhaust_leak")).toBe(true);

      // P2 passes SO2 response
      const afterPassSo2 = engineReducer(afterLeak, { type: "PASS_RESPONSE", playerId: "player_2" });
      expect(afterPassSo2.log.some((e) => e.eventKey === "response_pass_so2")).toBe(true);

      // Or responds to SO2
      const naoh = "substance_naoh_dilute_01";
      let withNaoh = afterLeak;
      withNaoh = putCardInHand(withNaoh, "player_2", naoh);
      const afterRespondSo2 = engineReducer(withNaoh, {
        type: "RESPOND_WITH_CARD",
        playerId: "player_2",
        cardInstanceId: naoh,
      });
      const reactionSo2Multi = afterRespondSo2.log.find((e) => e.eventKey === "reaction" && e.reaction.definitionId === "so2_alkaline_absorption" && e.reaction.trigger.kind === "multi-target-damage-response");
      expect(reactionSo2Multi).toBeDefined();
    });

    it("File 8: characterSkills -> draw, alkali_recovery, exhaust_discharge, lab_fire, exothermic_accident, status_gained (path 2), status_refreshed (path 2)", () => {
      // 1. skill_draw (requires hand <= 4)
      const ceoState = createInitialGame({ characterIds: ["chemical_factory_ceo", "acid_king"], shuffle: identityShuffle });
      const ceoWithLowHand: GameState = {
        ...ceoState,
        players: ceoState.players.map((p, i) => i === 0 ? { ...p, hand: p.hand.slice(0, 2) } : p),
      };
      const afterEmergencySupply = engineReducer(ceoWithLowHand, { type: "ACTIVATE_CHARACTER_SKILL", playerId: "player_1", skillId: "emergency_supply" });
      expect(afterEmergencySupply.log.some((e) => e.eventKey === "skill_draw" && e.params.skillId === "emergency_supply")).toBe(true);

      // 2. skill_alkali_recovery
      const causticState = createInitialGame({ characterIds: ["caustic_soda_captain", "chemical_factory_ceo"], shuffle: identityShuffle });
      const naoh = "substance_naoh_dilute_01";
      let causticWithHand = {
        ...causticState,
        players: causticState.players.map((p, i) => i === 0 ? { ...p, hp: 1 } : p),
      };
      causticWithHand = putCardInHand(causticWithHand, "player_1", naoh);
      const afterRecovery = engineReducer(causticWithHand, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "alkali_recovery",
        cardInstanceId: naoh,
      });
      expect(afterRecovery.log.some((e) => e.eventKey === "skill_alkali_recovery")).toBe(true);

      // 3. skill_exhaust_discharge
      const dirState = createInitialGame({ characterIds: ["sulfuric_acid_factory_director", "chemical_factory_ceo"], shuffle: identityShuffle });
      const afterExhaust = engineReducer(dirState, {
        type: "ACTIVATE_CHARACTER_SKILL",
        playerId: "player_1",
        skillId: "exhaust_discharge",
        targetPlayerId: "player_2",
      });
      expect(afterExhaust.log.some((e) => e.eventKey === "skill_exhaust_discharge")).toBe(true);

      // 4. skill_lab_fire, status_gained (path 2), status_refreshed (path 2)
      const secState = createInitialGame({ characterIds: ["clumsy_party_secretary", "chemical_factory_ceo"], shuffle: identityShuffle });
      const afterFire1 = engineReducer(secState, { type: "ACTIVATE_CHARACTER_SKILL", playerId: "player_1", skillId: "lab_fire" });
      expect(afterFire1.log.some((e) => e.eventKey === "skill_lab_fire")).toBe(true);
      expect(afterFire1.log.some((e) => e.eventKey === "status_gained" && e.params.statusId === "FIRE")).toBe(true);

      // Repeat lab fire on player who has fire -> status_refreshed (path 2)
      const secState2 = createInitialGame({ characterIds: ["clumsy_party_secretary", "chemical_factory_ceo"], shuffle: identityShuffle });
      const withFire = addStatus(secState2, "player_2", "FIRE");
      const afterFire2 = engineReducer(withFire, { type: "ACTIVATE_CHARACTER_SKILL", playerId: "player_1", skillId: "lab_fire" });
      expect(afterFire2.log.some((e) => e.eventKey === "status_refreshed" && e.params.statusId === "FIRE")).toBe(true);

      // 5. skill_exothermic_accident
      const afterExothermic = engineReducer(secState, { type: "ACTIVATE_CHARACTER_SKILL", playerId: "player_1", skillId: "exothermic_accident" });
      expect(afterExothermic.log.some((e) => e.eventKey === "skill_exothermic_accident")).toBe(true);
    });

    it("File 9: experimentCounterattack -> window_open, recover, pursuit", () => {
      let state = createInitialGame({
        characterIds: ["clumsy_party_secretary", "chemistry_enthusiast"],
        shuffle: identityShuffle,
      });
      const hcl = "substance_hcl_dilute_01";
      const naoh = "substance_naoh_dilute_01";
      const hcl2 = "substance_hcl_dilute_02";
      state = {
        ...state,
        players: state.players.map((p, i) => i === 1 ? { ...p, hp: 1 } : p),
      };
      state = putCardInHand(state, "player_1", hcl);
      state = putCardInHand(state, "player_2", naoh);
      state = putCardInHand(state, "player_2", hcl2);

      const afterAttack = engineReducer(state, { type: "PLAY_CARD", playerId: "player_1", cardInstanceId: hcl, targetPlayerId: "player_2" });
      const afterRespond = engineReducer(afterAttack, { type: "RESPOND_WITH_CARD", playerId: "player_2", cardInstanceId: naoh });
      expect(afterRespond.log.some((e) => e.eventKey === "counterattack_window_open")).toBe(true);

      // Recover option
      const afterRecover = engineReducer(afterRespond, {
        type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
        playerId: "player_2",
        option: "recover",
      });
      expect(afterRecover.log.some((e) => e.eventKey === "counterattack_recover")).toBe(true);

      // Pursuit option
      const afterPursuit = engineReducer(afterRespond, {
        type: "RESOLVE_EXPERIMENT_COUNTERATTACK",
        playerId: "player_2",
        option: "acid-base-pursuit",
        cardInstanceId: hcl2,
      });
      expect(afterPursuit.log.some((e) => e.eventKey === "counterattack_pursuit")).toBe(true);
    });

    it("File 10: diy -> co2_remove_fire, h2o_remove_fire, virtual_attack, so2_apply_leak, status_gained (path 3), status_refreshed (path 3)", () => {
      let state = createInitialGame({
        characterIds: ["chemical_factory_ceo", "acid_king"],
        shuffle: identityShuffle,
      });

      // 1. diy_co2_remove_fire
      const c = "element_c_01";
      const o1 = "element_o_01";
      const o2 = "element_o_02";
      state = addStatus(state, "player_1", "FIRE");
      state = putCardInHand(state, "player_1", c);
      state = putCardInHand(state, "player_1", o1);
      state = putCardInHand(state, "player_1", o2);

      const afterCo2 = engineReducer(state, {
        type: "START_ACTIVE_DIY",
        playerId: "player_1",
        recipeId: "diy_co2_from_c_o_o",
        componentCardInstanceIds: [c, o1, o2],
      });
      expect(afterCo2.log.some((e) => e.eventKey === "diy_co2_remove_fire")).toBe(true);

      // 2. diy_h2o_remove_fire
      let stateH2o = createInitialGame({ characterIds: ["chemical_factory_ceo", "acid_king"], shuffle: identityShuffle });
      const h = "ion_h_01";
      const oh = "ion_oh_01";
      stateH2o = addStatus(stateH2o, "player_1", "FIRE");
      stateH2o = putCardInHand(stateH2o, "player_1", h);
      stateH2o = putCardInHand(stateH2o, "player_1", oh);

      const afterH2o = engineReducer(stateH2o, {
        type: "START_ACTIVE_DIY",
        playerId: "player_1",
        recipeId: "diy_h2o_from_h_oh",
        componentCardInstanceIds: [h, oh],
      });
      expect(afterH2o.log.some((e) => e.eventKey === "diy_h2o_remove_fire")).toBe(true);

      // 3. diy_virtual_attack
      let stateVa = createInitialGame({ characterIds: ["chemical_factory_ceo", "acid_king"], shuffle: identityShuffle });
      const cl = "ion_cl_01";
      stateVa = putCardInHand(stateVa, "player_1", h);
      stateVa = putCardInHand(stateVa, "player_1", cl);

      const afterVa = engineReducer(stateVa, {
        type: "START_ACTIVE_DIY",
        playerId: "player_1",
        recipeId: "diy_hcl_from_h_cl",
        componentCardInstanceIds: [h, cl],
        targetPlayerId: "player_2",
      });
      expect(afterVa.log.some((e) => e.eventKey === "diy_virtual_attack")).toBe(true);

      // 4. diy_so2_apply_leak, status_gained (path 3), status_refreshed (path 3)
      let stateSo2 = createInitialGame({ characterIds: ["chemical_factory_ceo", "acid_king"], shuffle: identityShuffle });
      const s = "element_s_01";
      stateSo2 = putCardInHand(stateSo2, "player_1", s);
      stateSo2 = putCardInHand(stateSo2, "player_1", o1);
      stateSo2 = putCardInHand(stateSo2, "player_1", o2);

      const afterSo2Diy1 = engineReducer(stateSo2, {
        type: "START_ACTIVE_DIY",
        playerId: "player_1",
        recipeId: "diy_so2_from_s_o_o",
        componentCardInstanceIds: [s, o1, o2],
        targetPlayerId: "player_2",
      });
      expect(afterSo2Diy1.log.some((e) => e.eventKey === "diy_so2_apply_leak")).toBe(true);
      expect(afterSo2Diy1.log.some((e) => e.eventKey === "status_gained" && e.params.statusId === "SO2_LEAK")).toBe(true);

      // Repeat DIY SO2 on target with SO2 -> status_refreshed (path 3)
      let stateSo2Ref = createInitialGame({ characterIds: ["chemical_factory_ceo", "acid_king"], shuffle: identityShuffle });
      stateSo2Ref = addStatus(stateSo2Ref, "player_2", "SO2_LEAK");
      stateSo2Ref = putCardInHand(stateSo2Ref, "player_1", s);
      stateSo2Ref = putCardInHand(stateSo2Ref, "player_1", o1);
      stateSo2Ref = putCardInHand(stateSo2Ref, "player_1", o2);

      const afterSo2Diy2 = engineReducer(stateSo2Ref, {
        type: "START_ACTIVE_DIY",
        playerId: "player_1",
        recipeId: "diy_so2_from_s_o_o",
        componentCardInstanceIds: [s, o1, o2],
        targetPlayerId: "player_2",
      });
      expect(afterSo2Diy2.log.some((e) => e.eventKey === "status_refreshed" && e.params.statusId === "SO2_LEAK")).toBe(true);
    });
  });

  it("verifies no raw internal IDs or unexpected Chinese characters in EN mode", () => {
    for (const testCase of oracleCases) {
      const renderedEn = renderGameLogEntry(testCase.entry, "en", context);
      // In context, player customName is "玩家 1" / "玩家 2" (Scheme A snapshot name is not translated)
      const strippedEn = renderedEn.replace(/玩家 1/g, "").replace(/玩家 2/g, "");
      expect(strippedEn, `Untranslated Chinese in EN log for ${testCase.name}`).not.toMatch(/[\u4e00-\u9fa5]/);
    }
  });
});
