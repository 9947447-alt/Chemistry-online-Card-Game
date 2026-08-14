# Phase 16 — Bilingual Complete Game Log（完整双语游戏日志）Gate 1 冻结合同

## 0. 当前发布身份

- 仓库根：`/Users/a0000/Documents/Chemistry-online-Card-Game`
- Phase 16 工作区：`/Users/a0000/Documents/Chemistry-online-Card-Game-phase16-bilingual-game-log`
- 分支：`feat/phase16-bilingual-game-log`
- 基线提交：`c889ffa761089684414b3e0cf0456a7b4744e238`（`origin/main`，`Merge pull request #8 … release/phase15-alpha5-web-playtest-alpha1`）
- 发布身份：Reaction Field Alpha 5
- 版本：`0.15.0-alpha.1`（`package.json.version` 为唯一版本真值）
- 规则：MVP0-P10
- 标签：`web-playtest-v0.15.0-alpha.1`（剥离提交 `c889ffa761089684414b3e0cf0456a7b4744e238`）

> 本轮仅记录发布身份；Alpha 5 已发布，但现有 README / MVP_PLAN / Phase15 文档仍有发布前状态，该“发布状态文档债”在独立 docs closeout 中另行收口，不在本 Gate 1 处理。

## 1. Phase 16 目标

把普通正式游戏日志从“引擎内嵌中文 `message` 字符串”升级为“语言无关的结构化日志事件 + 双语言渲染器”：

- 中文模式：正式游戏日志使用简体中文。
- 英文模式：所有面向玩家的普通正式游戏日志使用英文。
- 两种语言必须从同一份结构化日志事件派生。
- 不允许通过解析中文 `message`、`rulesText` 或任意自然语言字符串生成英文日志。

本 Gate 1 是 discovery / design / freeze 阶段，不实现生产代码、不迁移、不运行测试或构建。

## 2. 已批准的旧边界解除

解除 Alpha 4 的旧展示边界：

> “英文模式下普通正式游戏日志仍为简体中文。”

对应现状证据：

- `src/features/local-game/components/GameLog.tsx` 在英文模式仍直接渲染 `entry.message`，并显示提示：“The formal game record currently remains in Simplified Chinese. This display layer does not translate log messages.”
- `docs/ALPHA4_INTERNATIONAL_PLAYTEST_FREEZE.md`：“普通 engine 正式日志、debug `rulesText`、技术 ID、错误码、应用版本和规则版本继续保持原有合同。英文模式必须明确普通正式日志目前仍为简体中文。”

新边界（Phase 16 生效后）：

- 中文模式正式游戏日志为简体中文；
- 英文模式所有面向玩家的普通正式游戏日志为英文；
- 两种语言同源派生；
- 不解析中文 `message` / `rulesText` / 自然语言生成英文。

## 3. 非规则变更声明

Phase 16 属于展示合同升级，不属于游戏规则变更：

- 不改变 MVP0-P10 的任何规则；
- 不新增卡牌、角色、技能、DIY、reaction 或 status；
- 不改变 `src/game/engine/reducer.ts` 的结算语义；
- 不改变卡池 68 张普通实体卡；
- `event_lab_fire` 仍不进入普通卡池，也不被创建为普通 `CardInstance`；
- 不新增金属卡、不补 `experiment_counterattack` 金属选项、不新增 DIY/reaction/status、不做响应 DIY、方程式牌、沉淀或金属反应链；
- 不做 AI、多人、账号、存档、回放；
- 不翻译技术错误码、commit SHA、version、rules version。

## 4. 日志写入点与数量术语冻结

`GameState.log: GameLogEntry[]` 的写入仅发生在以下 10 个生产文件（外加 1 个未被引用的死代码 helper `log.ts`）：

| 文件 | 写入方式 | 覆盖去重语义模板数 | 说明 |
| --- | --- | --- | --- |
| `src/game/engine/createInitialGame.ts` | 内联 `log: [{id,message}]` | 1 | 对应 `game_start` 写入 |
| `src/game/engine/turnFlow.ts` | 本地 `appendLog` | 10 | 含 `status_window_start` 1 处 |
| `src/game/engine/resolution.ts` | 本地 `appendLog` + `recordSuccessfulReaction(message)` | 13 | 含 `status_window_start`/`status_gained`/`status_refreshed` 各 1 处 |
| `src/game/engine/damage.ts` | 本地 `appendLog` | 1 | 含 `eliminated` 1 处 |
| `src/game/engine/loseHp.ts` | 本地 `appendLog` | 2 | 含 `lose_hp` 1 处、`eliminated` 1 处 |
| `src/game/engine/reactions.ts` | `appendReactionLog`（带 `reaction`）+ 本地 `appendLog` | 1 | `sulfate_byproduct_draw` 1 处（`recordSuccessfulReaction` 被 resolution 与 multiTargetResponse 调用） |
| `src/game/engine/multiTargetResponse.ts` | `recordSuccessfulReaction(message)` + 本地 `appendLog` | 2 | 含 `response_pass_so2` 1 处、reaction SO2 多目标 1 处 |
| `src/game/engine/characterSkills.ts` | 本地 `appendSkillLog` | 8 | 含 `status_gained`/`status_refreshed` 各 1 处 |
| `src/game/engine/experimentCounterattack.ts` | 本地 `appendLog` | 3 | 含反击选择/恢复/追击 |
| `src/game/engine/diy.ts` | 本地 `appendLog` | 6 | 含 `status_gained`/`status_refreshed` 各 1 处 |
| `src/game/engine/log.ts` | `createLogEntry(id,message)` | 0 | 未被任何代码引用，死代码 |

### 4.1 数量术语精确区分

全篇统一并严格区分以下数量概念，禁止混用：

- **生产日志写入文件**：10 个；
- **普通 eventKey**：37 个；
- **Reaction eventKey**：1 个（`reaction`）；
- **eventKey 总数**：38 个（37 + 1）；
- **Reaction 展示变体**：4 个（酸碱中和/酸与碳酸盐/SO2 状态处理/SO2 多目标）；
- **去重语义模板变体**：41 个（37 普通 + 4 reaction 变体）；
- **全部 producer 写入点**：分布于 10 个生产文件，包含跨文件重复 producer 调用（如 `status_window_start` 2 处、`status_gained` 3 处、`status_refreshed` 3 处、`eliminated` 2 处）， producer 调用总数多于 41。

以下模块不写日志（已核实）：`reducer.ts`、`actions.ts`、`statuses.ts`（`statusDefinitions` 为空数组）、`damageModifiers.ts`、`recovery.ts`、`handCapacity.ts`、`effects.ts`、`responseContinuation.ts`、`cardAssociation.ts`、`visibility.ts`、`characterUsage.ts`、`damageContext.ts`、`sessionConfirmation.ts`、`localGameSession.ts`、`App.tsx` 及所有 UI 组件（组件只读取 `game.log`）。

## 5. 完整日志分类表

列含义：`params` 为建议结构化参数；`稳定ID` 指参数是否已有稳定标识；`标记` 用 `角色/卡牌/数值/玩家/reaction/status/内部ID` 表示该条当前中文 message 中出现的语义元素（“内部ID”指 `statusId`、`skillId` 等原始技术标识直接泄露进文案）。

| # | eventKey | 当前中文 message（简写） | 文件:位置 | 触发路径 | params | 稳定ID | 标记 | 进入 Phase16 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `game_start` | 游戏开始，进入第 1 实验周期。 | createInitialGame.ts:86 | `createInitialGame` | `cycleNumber` | 部分（数值字面量 1） | 数值 | 是 |
| 2 | `recycle_discard_into_deck` | 主牌堆不足，弃牌堆洗回主牌堆。 | turnFlow.ts:64 | `drawCardsForPlayer→recycleDiscardIntoDeck` | — | — | — | 是 |
| 3 | `draw_stopped_empty` | 主牌堆与弃牌堆均为空，摸牌停止。 | turnFlow.ts:95 | `drawCardsForPlayer` | — | — | — | 是 |
| 4 | `cycle_cleanup_discard_hands` | 实验周期结束，所有剩余手牌进入弃牌堆。 | turnFlow.ts:288 | `advanceTurnFromReducer→discardAllHands` | — | — | — | 是 |
| 5 | `cycle_start` | 进入第 N 实验周期。 | turnFlow.ts:318 | `startNextCycle` | `cycleNumber` | 数值（`state.cycleNumber`） | 数值 | 是 |
| 6 | `round_start` | 进入第 N 实验轮次。 | turnFlow.ts:501 | `advanceTurnFromReducer` | `roundInCycle` | 数值 | 数值 | 是 |
| 7 | `turn_start` | 轮到 X 行动。 | turnFlow.ts:488 | `advanceTurnFromReducer` | `playerId` | 是（PlayerId） | 玩家 | 是 |
| 8 | `laboratory_preparation_confirmed` | X 完成备课，保留 N 张牌。 | turnFlow.ts:358 | `confirmLaboratoryPreparation` | `playerId`,`keepCount` | 是/数值 | 玩家+数值 | 是 |
| 9 | `status_window_start` | X 开始处理 STATUS。 | turnFlow.ts:464 / resolution.ts:225 | `beginActionForPlayer` / `enterNextStatusWindowOrMainAction`（两处重复 producer） | `playerId`,`statusId` | 是（StatusId） | 玩家+status+内部ID | 是 |
| 10 | `status_gained` | X 获得 STATUS。 | resolution.ts:263 / diy.ts:107 / characterSkills.ts:146 | `addStatusIfMissing`（三处重复 producer） | `playerId`,`statusId` | 是 | 玩家+status+内部ID | 是 |
| 11 | `status_refreshed` | X 的 STATUS 已刷新/重复施加。 | resolution.ts:253 / diy.ts:97 / characterSkills.ts:136 | `addStatusIfMissing`（三处重复 producer） | `playerId`,`statusId` | 是 | 玩家+status+内部ID | 是 |
| 12 | `status_handled_fire` | X 使用 C 处理 FIRE。 | resolution.ts:539 | `handleStatusWithCard`（FIRE 分支） | `playerId`,`cardDefinitionId` | 是 | 玩家+卡牌+status | 是 |
| 13 | `status_passed_damage` | X 未处理 STATUS，受到 N 点状态伤害；STATUS 保留。 | resolution.ts:598 | `passStatusHandling` | `playerId`,`statusId`,`amount` | 是/数值 | 玩家+数值+status+内部ID | 是 |
| 14 | `card_play_so2` | X 打出 SO2，使 Y 获得 SO2_LEAK；不造成即时伤害。 | resolution.ts:305 | `playSulfurDioxideCard` | `actorId`,`targetId` | 是 | 玩家+status | 是 |
| 15 | `card_play_o2` | X 使用 O2，回复 N HP。 | resolution.ts:353 | `playOxygenRecoveryCard` | `actorId`,`amount` | 是/数值 | 玩家+数值 | 是 |
| 16 | `card_play_reference` | X 普通出牌 C，作为场面基准；不触发原有效果。 | resolution.ts:397 | `playReferenceCard` | `actorId`,`cardDefinitionId` | 是 | 玩家+卡牌 | 是 |
| 17 | `card_play_attack` | X 打出 C，对 Y 的[酸性/碱性]伤害基础值为 N 点，等待响应。 | resolution.ts:470 | `playMainActionCard` | `actorId`,`cardDefinitionId`,`targetId`,`damageKind`,`baseAmount` | 是/数值 | 玩家+卡牌+数值 | 是 |
| 18 | `response_pass_damage` | Y 放弃响应，受到 N 点[酸性/碱性]伤害。 | resolution.ts:758 | `passResponse` | `targetId`,`damageKind`,`amount` | 是/数值 | 玩家+数值 | 是 |
| 19 | `response_pass_so2` | Y 放弃碱性吸收，受到 N 点 SO2 伤害。 | multiTargetResponse.ts:222 | `passMultiTargetDamageResponse` | `targetId`,`amount` | 是/数值 | 玩家+数值 | 是 |
| 20 | `lose_hp` | X 失去 N 点体力。 | loseHp.ts:100 | `applyLoseHpBatch` | `playerId`,`amount` | 是/数值 | 玩家+数值 | 是 |
| 21 | `eliminated` | X HP 降至 0，被淘汰。 | loseHp.ts:112 / damage.ts:228 | `applyLoseHpBatch` / `applyDamage`（两处重复 producer） | `playerId` | 是 | 玩家 | 是 |
| 22 | `winner` | X 获胜。 | turnFlow.ts:405 | `finishGameIfResolved` | `playerId` | 是 | 玩家 | 是 |
| 23 | `draw_game` | 所有玩家均被淘汰，本局平局。 | turnFlow.ts:421 | `finishGameIfResolved` | — | — | — | 是 |
| 24 | `sulfate_byproduct_draw` | X 的硫酸盐副产成功结算，摸 1 张牌。 | reactions.ts:683 | `recordSuccessfulReaction→consumeSuccessfulReactionEvent` | `playerId` | 是 | 玩家+数值(1) | 是 |
| 25 | `skill_draw` | X 发动[补课/紧急调货]，实际摸 N 张牌，本行动结束。 | characterSkills.ts:177 | `activateDrawSkill` | `playerId`,`skillId`,`amount` | 是/数值 | 玩家+数值+内部ID(名称字面量) | 是 |
| 26 | `skill_alkali_recovery` | X 发动碱液回收，弃置 C，回复 N HP，本行动结束。 | characterSkills.ts:229 | `activateAlkaliRecovery` | `playerId`,`cardDefinitionId`,`amount` | 是/数值 | 玩家+卡牌+数值 | 是 |
| 27 | `skill_exhaust_discharge` | X 发动排放尾气，使 Y 获得 SO2_LEAK；不造成即时伤害，本行动结束。 | characterSkills.ts:253 | `activateExhaustDischarge` | `actorId`,`targetId` | 是 | 玩家+status | 是 |
| 28 | `skill_exhaust_leak` | X 发动尾气泄漏，按稳定顺序等待 N 名目标分别进行碱性吸收响应。 | characterSkills.ts:280 | `activateExhaustLeak` | `playerId`,`targetCount` | 是/数值 | 玩家+数值 | 是 |
| 29 | `skill_lab_fire` | X 发动实验台起火（lab_fire），… 施加 FIRE；本行动结束。 | characterSkills.ts:298 | `activateLabFire` | `playerId` | 是 | 玩家+status+内部ID | 是 |
| 30 | `skill_exothermic_accident` | X 发动强放热事故，所有其他存活玩家失去 1 点体力。 | characterSkills.ts:311 | `activateExothermicAccident` | `playerId`,`amount` | 是/数值 | 玩家+数值 | 是 |
| 31 | `counterattack_window_open` | X 成功完全抵消来自 Y 的攻击，进入实验反击选择窗口。 | experimentCounterattack.ts:177 | `openExperimentCounterattackOrResume` | `responderId`,`attackerId` | 是 | 玩家 | 是 |
| 32 | `counterattack_recover` | X 发动实验反击，回复 1 HP。 | experimentCounterattack.ts:348 | `resolveExperimentCounterattack(recover)` | `playerId`,`amount` | 是/数值 | 玩家+数值 | 是 |
| 33 | `counterattack_pursuit` | X 发动实验反击，使用 C 追击 Y，造成 N 点伤害。 | experimentCounterattack.ts:391 | `resolveExperimentCounterattack(acid-base-pursuit)` | `playerId`,`cardDefinitionId`,`targetId`,`amount` | 是/数值 | 玩家+卡牌+数值 | 是 |
| 34 | `diy_co2_remove_fire` | X 主动 DIY 生成 CO2 并移除 FIRE；不创建 CO2 卡牌。 | diy.ts:238 | `startActiveDIY(CO2_REMOVE_OWN_FIRE)` | `playerId` | 是 | 玩家+status | 是 |
| 35 | `diy_h2o_remove_fire` | X 主动 DIY 生成 H2O 并移除 FIRE；不创建 H2O 卡牌。 | diy.ts:257 | `startActiveDIY(H2O_REMOVE_OWN_FIRE)` | `playerId` | 是 | 玩家+status | 是 |
| 36 | `diy_virtual_attack` | X 主动 DIY 使用 R，生成虚拟 P，对 Y 的[酸性/碱性]伤害基础值为 N 点，等待响应；不创建实体卡牌。 | diy.ts:296 | `startActiveDIY(VIRTUAL_ATTACK)` | `playerId`,`recipeId`,`targetId`,`damageKind`,`amount` | 是/数值 | 玩家+配方+虚拟产品+数值 | 是 |
| 37 | `diy_so2_apply_leak` | X 主动 DIY 生成 SO2，使 Y 获得 SO2_LEAK；不创建 SO2 卡牌。 | diy.ts:324 | `startActiveDIY(SO2_APPLY_LEAK)` | `actorId`,`targetId` | 是 | 玩家+status | 是 |
| 38 | `reaction`（neutralization/H2O） | X 打出 C，中和 A，生成 H2O（虚拟结果），原伤害取消。 | resolution.ts:698 | `respondWithCard→recordSuccessfulReaction` | `reaction`（`acid_base_neutralization`） | 是 | 玩家+卡牌+reaction | 是 |
| 39 | `reaction`（carbonate/CO2） | X 打出 C，响应 A 的酸性伤害，生成 CO2（虚拟结果），原伤害取消。 | resolution.ts:698 | `respondWithCard→recordSuccessfulReaction` | `reaction`（`acid_carbonate_co2`） | 是 | 玩家+卡牌+reaction | 是 |
| 40 | `reaction`（SO2 status） | X 使用 C 碱性吸收，处理 SO2 泄漏。 | resolution.ts:552 | `handleStatusWithCard→recordSuccessfulReaction` | `reaction`（`so2_alkaline_absorption`/status-handling） | 是 | 玩家+卡牌+reaction+status | 是 |
| 41 | `reaction`（SO2 multi-target） | X 使用 C 碱性吸收，完全抵消尾气泄漏伤害。 | multiTargetResponse.ts:183 | `respondToMultiTargetDamage→recordSuccessfulReaction` | `reaction`（`so2_alkaline_absorption`/multi-target） | 是 | 玩家+卡牌+reaction | 是 |

### 5.1 结构化参数来源与稳定 ID 结论

- 已有稳定 ID 的参数：`PlayerId`（`player_1`/`player_2`）、`CardDefinitionId`、`CharacterSkillId`、`StatusId`（`"SO2_LEAK" | "FIRE"`）、`recipeId`（`diyRecipes[].id`）、`ReactionDefinitionId`、`damageKind`（`"acid" | "base"`）、reaction 的 `product`（`"H2O" | "CO2"`）。
- 仅能当前从中文 message 辨认、且未以结构化字段存在的语义：事件的类型本身（发生了什么）由 `eventKey` 决定；`amount`/`keepCount`/`baseAmount`/`cycleNumber`/`roundInCycle`/`targetCount` 等数值在引擎写入时作为强类型数字传入，不再拼入字符串。
- 玩家公开身份：冻结为会话级只读身份快照 `LogPresentationContext`（选择方案 A，详见 7.1 节），避免中文默认名永久固化泄漏到英文模式。
- 卡牌名：渲染层已有 `getCardDisplayName(definitionId, fallback, locale)`，Phase 16 严格复用。
- 技能名：渲染层已有 `getSkillDisplayName(skillId, locale)`，Phase 16 严格复用。
- Status 名：渲染层已有 `getStatusDisplayName(statusId, locale)`（“火情/Fire”“SO2 泄漏/SO2 leak”），Phase 16 严格复用。
- Reaction：已有正式结构化来源 `SuccessfulReactionEvent`，渲染层已有 `getPublicReactionLogView(state, entry, locale)`，Phase 16 严格复用。

### 5.2 当前“内部 ID 泄露到 UI”清单与消除方案

以下当前中文 message 嵌入了技术 ID，属于 Phase 16 必须彻底消除的泄露点：

- `status_window_start` / `status_passed_damage` / `status_gained` / `status_refreshed`：由 renderer 按 `getStatusDisplayName(statusId, locale)` 正式解析。
- `skill_lab_fire`：由 renderer 按 `getSkillDisplayName("lab_fire", locale)` 解析为“实验台起火 / Laboratory Bench Fire”。
- `diy_virtual_attack`：消除单语 `displayName` 与 `recipeId` 泄露。`{recipe}` 走 `getDiyRecipeDisplayName(recipeId, locale)`，`{product}` 走 `getDiyVirtualProductDisplayName(recipeId, locale)`（详见 7.2 节）。
- `response_pass_damage` 的攻击来源：一律以 `actorId` / `cardDefinitionId` / `skillId` / `statusId` 结构化传参，由 renderer 通过正式 presentation 入口解析，不得保留直接拼接内部 ID 字符串的分支。

## 6. 推荐数据模型

### 6.1 候选方案对比

| 维度 | A：discriminated union | B：stable key + typed params（推荐） |
| --- | --- | --- |
| 类型安全 | 最强 | 强（`params` 按键索引 + 深层只读） |
| 漏项风险 | 低 | 低（`ParamsMap` 强制每 key 有类型） |
| renderer exhaustiveness | `switch` + `never` | `Record<Key, Renderer>` 或 `switch` + `never` |
| 测试难度 | 中 | 低（`eventKey` 稳定可直接断言） |
| bundle size | 较 B 大 | 单一 entry 形状 + map，最紧凑 |
| 迁移成本 | 高（多变体新对象） | 低（逐点 `appendEvent`） |
| reaction 兼容 | 兼容 | `reaction` 字段原样保留，兼容 |
| 内部 ID 泄露 | 由 renderer 决定 | params 只存稳定 ID，天然阻断 |

### 6.2 唯一推荐：方案 B

理由：单一 `GameLogEntry` 形状、`eventKey` 稳定可测、`params` 按键强类型只读、renderer 用一个 `Record` 即可 compile-time exhaustive、`reaction` 字段无侵入复用、迁移可逐点进行、bundle size 最低。

### 6.3 类型冻结合同（只读化与结构收窄）

```ts
export type DamageKind = "acid" | "base";

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
  game_start: { cycleNumber: number };
  recycle_discard_into_deck: Record<string, never>;
  draw_stopped_empty: Record<string, never>;
  cycle_cleanup_discard_hands: Record<string, never>;
  cycle_start: { cycleNumber: number };
  round_start: { roundInCycle: number };
  turn_start: { playerId: PlayerId };
  laboratory_preparation_confirmed: { playerId: PlayerId; keepCount: number };
  status_window_start: { playerId: PlayerId; statusId: StatusId };
  status_gained: { playerId: PlayerId; statusId: StatusId };
  status_refreshed: { playerId: PlayerId; statusId: StatusId };
  status_handled_fire: { playerId: PlayerId; cardDefinitionId: CardDefinitionId };
  status_passed_damage: { playerId: PlayerId; statusId: StatusId; amount: number };
  card_play_so2: { actorId: PlayerId; targetId: PlayerId };
  card_play_o2: { actorId: PlayerId; amount: number };
  card_play_reference: { actorId: PlayerId; cardDefinitionId: CardDefinitionId };
  card_play_attack: {
    actorId: PlayerId;
    cardDefinitionId: CardDefinitionId;
    targetId: PlayerId;
    damageKind: DamageKind;
    baseAmount: number;
  };
  response_pass_damage: { targetId: PlayerId; damageKind: DamageKind; amount: number };
  response_pass_so2: { targetId: PlayerId; amount: number };
  lose_hp: { playerId: PlayerId; amount: number };
  eliminated: { playerId: PlayerId };
  winner: { playerId: PlayerId };
  draw_game: Record<string, never>;
  sulfate_byproduct_draw: { playerId: PlayerId };
  skill_draw: { playerId: PlayerId; skillId: CharacterSkillId; amount: number };
  skill_alkali_recovery: { playerId: PlayerId; cardDefinitionId: CardDefinitionId; amount: number };
  skill_exhaust_discharge: { actorId: PlayerId; targetId: PlayerId };
  skill_exhaust_leak: { playerId: PlayerId; targetCount: number };
  skill_lab_fire: { playerId: PlayerId };
  skill_exothermic_accident: { playerId: PlayerId; amount: number };
  counterattack_window_open: { responderId: PlayerId; attackerId: PlayerId };
  counterattack_recover: { playerId: PlayerId; amount: number };
  counterattack_pursuit: {
    playerId: PlayerId;
    cardDefinitionId: CardDefinitionId;
    targetId: PlayerId;
    amount: number;
  };
  diy_co2_remove_fire: { playerId: PlayerId };
  diy_h2o_remove_fire: { playerId: PlayerId };
  diy_virtual_attack: {
    playerId: PlayerId;
    recipeId: string;
    targetId: PlayerId;
    damageKind: DamageKind;
    amount: number;
  };
  diy_so2_apply_leak: { actorId: PlayerId; targetId: PlayerId };
  reaction: Record<string, never>;
};

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
```

类型只读与不可变保障：

- **Mapped Discriminated Union**：TypeScript 能根据 `entry.eventKey` 自动精准收窄 `entry.params` 的字段类型，无需任何 `any` 或 `as`。
- **Params 只读保护**：`params: Readonly<GameLogParamsMap[E]>` 使得 `entry.params.amount = 2` 等修改在编译期报错。
- **Reaction 约束与只读**：`eventKey === "reaction"` 必须带 `reaction: Readonly<SuccessfulReactionEvent>` 字段，其它 37 个普通事件禁止带 `reaction` 属性。`SuccessfulReactionEvent` 内部包含 `readonly participants` 数组及嵌套只读结构。
- **Exhaustiveness Check**：若新增 `eventKey` 但未更新 `ParamsMap` 或 renderer `Record`，`satisfies Record<GameLogEventKey, ...>` 将自动触发 TypeScript 编译报错。

## 7. Renderer 合同与 presentation 入口

普通历史日志 renderer 最小入口为：

```ts
renderGameLogEntry(
  entry: GameLogEntry,
  locale: DisplayLocale,
  context: LogPresentationContext,
): string
```

禁止为普通历史日志 renderer 传入完整可变 `GameState`。

### 7.1 玩家身份只读快照合同（方案 A）

为了避免保存单一中文名导致英文模式泄漏，且不凭空改动 `Player` 类型或对局规则，本冻结合同明确采用**方案 A**：

```ts
export type LogPlayerIdentitySnapshot = Readonly<{
  playerId: PlayerId;
  customName?: string;
}>;

export type LogPresentationContext = Readonly<{
  players: Readonly<Record<PlayerId, LogPlayerIdentitySnapshot>>;
}>;
```

**合同边界**：
1. **创建与存在性规则**：在 `createInitialGame` 阶段，`customName` 的存在性严格由 `options.playerNames` 对应字段是否被显式提供决定：
   - 若用户在 `options.playerNames` 选项中显式提供了玩家名称，即使其文本刚好等于中文默认名（如 `"玩家 A"`）、英文默认名（如 `"Player A"`）或任何默认字符串，仍按 `customName` 原样快照；
   - 只有对应 `options.playerNames` 选项未提供（即 `undefined`）时，才不设置 `customName`（保持 `undefined`）；
   - 严禁通过字符串比较、当前 `locale` 或默认名称列表推断/猜测用户是否提供了 `customName`；
   - 空字符串如何处理必须沿用当前 `createInitialGame` 的既有输入规范，文档不得擅自改变该行为；
2. **只读不可变**：创建后不可被修改、重建或替换；
3. **隔离 GameState**：context 不包含 HP、hand、statuses、activePlayer、cardInstances 或其它任何可变游戏状态；
4. **共享快照**：所有普通日志与 reaction 日志渲染共用同一会话级只读身份快照；
5. **禁止动态猜测**：renderer 禁止在渲染历史日志时重新读取 `game.players`；
6. **Locale 生命周期**：语言切换不改变、不重建该快照；
7. **显示解析逻辑**：
   - 若 `snapshot.customName` 存在（已显式提供），则中英文统一直接显示 `customName` 原样文本（显式提供的玩家名称不翻译）；
   - 若 `customName` 未提供（为 `undefined`），则按 `playerId`（如 `"player_1"` / `"player_2"`）通过 `getPlayerDisplayNameById(playerId, locale)` 动态映射为：中文 `"玩家 A"` / `"玩家 B"`，英文 `"Player A"` / `"Player B"`。以此阻断中文默认名泄漏到英文 UI。

### 7.2 DIY virtual attack 正式双语展示合同

当前 8 个 DIY 配方中，包含 5 个 `VIRTUAL_ATTACK` 配方。`diy_virtual_attack` **必须区分反应式/配方展示 `{recipe}` 与生成的虚拟产品展示 `{product}`**：

- `{recipe}`：走 `getDiyRecipeDisplayName(recipeId: string, locale: DisplayLocale): string`，展示反应方程式；
- `{product}`：走 `getDiyVirtualProductDisplayName(recipeId: string, locale: DisplayLocale): string`，只返回产品身份，不包含“主动 DIY 生成”、“虚拟”或“不创建实体卡牌”等来源与生命周期表述。

**5 个 Virtual Attack 产品的双语公开名称冻结表**：

| recipeId | `{recipe}` (zh-CN / en) | `{product}` (zh-CN) | `{product}` (en) |
| --- | --- | --- | --- |
| `diy_hcl_from_h_cl` | `H+ + Cl- -> 稀 HCl` / `H+ + Cl- -> dilute HCl` | 稀 HCl | dilute HCl |
| `diy_h2so4_from_2h_so4` | `2H+ + SO4^2- -> 稀 H2SO4` / `2H+ + SO4^2- -> dilute H2SO4` | 稀 H2SO4 | dilute H2SO4 |
| `diy_naoh_from_na_oh` | `Na+ + OH- -> 稀 NaOH` / `Na+ + OH- -> dilute NaOH` | 稀 NaOH | dilute NaOH |
| `diy_koh_from_k_oh` | `K+ + OH- -> 稀 KOH` / `K+ + OH- -> dilute KOH` | 稀 KOH | dilute KOH |
| `diy_limewater_from_ca_2oh` | `Ca2+ + 2OH- -> 石灰水 Ca(OH)2` / `Ca2+ + 2OH- -> limewater Ca(OH)2` | 石灰水 Ca(OH)2 | limewater Ca(OH)2 |

**规则约束**：
- 禁止在英文 UI 使用中文 `DIYRecipe.displayName`；
- 禁止把 `recipeId`（如 `diy_hcl_from_h_cl`）、`cardDefinitionId` 或内部 ID 作为公开兜底；
- `getDiyRecipeDisplayName` 专用于反应式/配方展示，不得被混用为产品入口；
- `getDiyVirtualProductDisplayName` 只表达产品身份，不包含“主动 DIY 生成”、“虚拟”或“不创建实体卡牌”；“主动 DIY 生成”、“虚拟”与“不创建实体卡牌”等来源与生命周期语义统一由日志模板独立表达；
- 保留 `{recipe}` 与 `{product}` 两条独立 presentation 路径，不得再次合并；
- 若后续有新 recipe 生成相同产品，必须维护 recipe 与 product 的对应映射；
- 中英文模板必须同时保留配方 `{recipe}` 与产品 `{product}` 语义，不得丢失方程式或出现重复错位词句；
- 不改变 DIY 配方、生成物、伤害、目标、响应窗口或结算规则。

### 7.3 其它 Presentation 规则

1. **解析入口**：
   - 角色/玩家：`getPlayerDisplayNameById(playerId, locale, context)`
   - 卡牌：`getCardDisplayName(cardDefinitionId, fallback, locale)`
   - 技能：`getSkillDisplayName(skillId, locale)`
   - 状态：`getStatusDisplayName(statusId, locale)`
   - 配方：`getDiyRecipeDisplayName(recipeId, locale)`
   - 虚拟产品：`getDiyVirtualProductDisplayName(recipeId, locale)`
   - 反应：`getReactionDisplayName(reactionId, locale)`
2. **Exhaustive 渲染**：`Record<GameLogEventKey, Renderer>` 或 TS `switch` + `never` 分支，编译期强校验。
3. **缺失处理**：编译期报错 + 测试环境 `throw` (fail fast)，绝不向生产露底内部 ID。
4. **纯函数无副作用**：只读 `params` 计算结果，不重算规则、不读取/修改可变游戏状态。

## 8. Reaction 兼容合同

- 遵守 `docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`：`SuccessfulReactionEvent` 仅附着在 `GameLogEntry.reaction`。
- 每次成功反应恰好产生 1 个 `eventKey === "reaction"` 日志；顺序必须先于 `sulfate_byproduct_draw`。
- `FIRE` 处理是普通日志（`status_handled_fire`），不是 reaction。
- 非法路径返回原状态，不写日志也不写 reaction 事件。
- `SuccessfulReactionNotice` 的 timer（约 2000ms）与去重逻辑仅依赖 `game.log` 引用与 `entry.reaction`，不受日志双语重渲染影响。

## 9. Legacy message 迁移合同

- 过渡期允许保留 `message` 作为实现分支内部调试/对比字段，**但在 Phase 16 PR 提交合并前必须彻底删除**。
- production renderer 不得依赖 `message`。
- 移除所有 raw `appendLog(state, "中文")` 格式 helper，替换为强制要求 `eventKey` 的强类型写入 helper。
- `rg "message"` 在日志路径中无残留引用后，才允许进行 Phase 16 closeout。

## 10. Locale 切换生命周期（冻结行为）

- `GameState.log` 只存语言无关事件（`eventKey` + `params` + 可选 `reaction`）。
- `locale` 仅作用于展示层，不修改 `GameState`。
- 语言切换时，已有历史日志按新 locale 纯函数重新渲染，不 dispatch action，不写 log，不写 storage。
- 切换语言只做原位重渲染，**不得重启或重置 `SuccessfulReactionNotice` 的 2000ms timer**。
- 刷新页面保持 LocaleProvider 原有浏览器建议语言逻辑。

## 11. 双语精确模板表（含待响应基础伤害语义）

说明：
- 攻击日志（`card_play_attack` 与 `diy_virtual_attack`）在建立 response window 时写入，HP 尚未扣除。
- 中英文模板**必须严格使用待响应基础伤害语义**（如 “the base damage value is {amount}, awaiting response”），**严禁提前宣称伤害已结算**（不得使用 dealing damage / deals damage / took damage / caused damage 等词汇）。

| eventKey | 中文模板 | 英文模板 |
| --- | --- | --- |
| `game_start` | 游戏开始，进入第 {cycleNumber} 实验周期。 | Game started; entering experiment cycle {cycleNumber}. |
| `recycle_discard_into_deck` | 主牌堆不足，弃牌堆洗回主牌堆。 | The main deck was insufficient; the discard pile was shuffled back into the deck. |
| `draw_stopped_empty` | 主牌堆与弃牌堆均为空，摸牌停止。 | Both the main deck and discard pile were empty; drawing stopped. |
| `cycle_cleanup_discard_hands` | 实验周期结束，所有剩余手牌进入弃牌堆。 | The experiment cycle ended; all remaining hands were discarded. |
| `cycle_start` | 进入第 {cycleNumber} 实验周期。 | Entering experiment cycle {cycleNumber}. |
| `round_start` | 进入第 {roundInCycle} 实验轮次。 | Entering experiment round {roundInCycle}. |
| `turn_start` | 轮到 {player} 行动。 | It is {player}'s turn. |
| `laboratory_preparation_confirmed` | {player} 完成备课，保留 {keepCount} 张牌。 | {player} completed lesson preparation, keeping {keepCount} cards. |
| `status_window_start` | {player} 开始处理 {status}。 | {player} begins handling {status}. |
| `status_gained` | {player} 获得 {status}。 | {player} gained {status}. |
| `status_refreshed` | {player} 的 {status} 已刷新/重复施加。 | {player}'s {status} was refreshed / re-applied. |
| `status_handled_fire` | {player} 使用 {card} 处理火情。 | {player} used {card} to handle Fire. |
| `status_passed_damage` | {player} 未处理 {status}，受到 {amount} 点状态伤害；{status} 保留。 | {player} did not handle {status}, taking {amount} status damage; {status} persists. |
| `card_play_so2` | {player} 打出 SO2，使 {target} 获得 SO2 泄漏；不造成即时伤害。 | {player} played SO2, giving {target} SO2 leak; no immediate damage. |
| `card_play_o2` | {player} 使用 O2，回复 {amount} HP。 | {player} used O2 and recovered {amount} HP. |
| `card_play_reference` | {player} 普通出牌 {card}，作为场面基准；不触发原有效果。 | {player} played {card} as the table reference; its original effect does not trigger. |
| `card_play_attack` | {player} 打出 {card}，对 {target} 的{damageKind}伤害基础值为 {baseAmount} 点，等待响应。 | {player} played {card}; the base {damageKind} damage value to {target} is {baseAmount}, awaiting response. |
| `response_pass_damage` | {target} 放弃响应，受到 {amount} 点{damageKind}伤害。 | {target} declined to respond and took {amount} {damageKind} damage. |
| `response_pass_so2` | {target} 放弃碱性吸收，受到 {amount} 点 SO2 伤害。 | {target} declined alkaline absorption and took {amount} SO2 damage. |
| `lose_hp` | {player} 失去 {amount} 点体力。 | {player} lost {amount} HP. |
| `eliminated` | {player} HP 降至 0，被淘汰。 | {player}'s HP dropped to 0 and was eliminated. |
| `winner` | {player} 获胜。 | {player} wins. |
| `draw_game` | 所有玩家均被淘汰，本局平局。 | All players were eliminated; the game is a draw. |
| `sulfate_byproduct_draw` | {player} 的硫酸盐副产成功结算，摸 1 张牌。 | {player}'s sulfate byproduct settled successfully and drew 1 card. |
| `skill_draw` | {player} 发动{skill}，实际摸 {amount} 张牌，本行动结束。 | {player} activated {skill} and drew {amount} cards; this action ends. |
| `skill_alkali_recovery` | {player} 发动碱液回收，弃置 {card}，回复 {amount} HP，本行动结束。 | {player} activated Alkali Recovery, discarded {card}, and recovered {amount} HP; this action ends. |
| `skill_exhaust_discharge` | {player} 发动排放尾气，使 {target} 获得 SO2 泄漏；不造成即时伤害，本行动结束。 | {player} activated Exhaust Discharge, giving {target} SO2 leak; no immediate damage; this action ends. |
| `skill_exhaust_leak` | {player} 发动尾气泄漏，按稳定顺序等待 {targetCount} 名目标分别进行碱性吸收响应。 | {player} activated Exhaust Leak; awaiting alkaline absorption responses from {targetCount} targets in stable order. |
| `skill_lab_fire` | {player} 发动实验台起火，以虚拟角色技能效果向所有其他存活玩家施加火情；本行动结束。 | {player} activated Laboratory Bench Fire, applying Fire to all other surviving players via a virtual character-skill effect; this action ends. |
| `skill_exothermic_accident` | {player} 发动强放热事故，所有其他存活玩家失去 {amount} 点体力。 | {player} activated Exothermic Accident; all other surviving players lose {amount} HP. |
| `counterattack_window_open` | {responder} 成功完全抵消来自 {attacker} 的攻击，进入实验反击选择窗口。 | {responder} fully cancelled {attacker}'s attack and entered the experiment counterattack selection window. |
| `counterattack_recover` | {player} 发动实验反击，回复 {amount} HP。 | {player} activated the experiment counterattack and recovered {amount} HP. |
| `counterattack_pursuit` | {player} 发动实验反击，使用 {card} 追击 {target}，造成 {amount} 点伤害。 | {player} activated the experiment counterattack, used {card} to pursue {target}, and dealt {amount} damage. |
| `diy_co2_remove_fire` | {player} 主动 DIY 生成 CO2 并移除火情；不创建 CO2 卡牌。 | {player} used active DIY to produce CO2 and remove Fire; no CO2 card is created. |
| `diy_h2o_remove_fire` | {player} 主动 DIY 生成 H2O 并移除火情；不创建 H2O 卡牌。 | {player} used active DIY to produce H2O and remove Fire; no H2O card is created. |
| `diy_virtual_attack` | {player} 主动 DIY 使用 {recipe}，生成虚拟产品 {product}；对 {target} 的{damageKind}伤害基础值为 {amount} 点，等待响应；不创建实体卡牌。 | {player} used active DIY recipe {recipe} to produce the virtual product {product}; the base {damageKind} damage value to {target} is {amount}, awaiting response; no entity card is created. |
| `diy_so2_apply_leak` | {player} 主动 DIY 生成 SO2，使 {target} 获得 SO2 泄漏；不创建 SO2 卡牌。 | {player} used active DIY to produce SO2, giving {target} SO2 leak; no SO2 card is created. |
| `reaction` | 由 `getPublicReactionLogView(…, "zh-CN")` 派生（成功反应 · 名称 + 入口 + 参与 + 结果） | 由 `getPublicReactionLogView(…, "en")` 派生 |

`damageKind` 的中文显示为“酸性/碱性”，英文为“acid/base”。

## 12. 可访问性

- 正式日志保持有序列表语义（当前 `<ol>`）与 `aria-labelledby`；双语标题“完整游戏日志 / Full game log”维持。
- 成功反应即时提示维持 `role="status"` + `aria-atomic="true"` + polite，不抢焦点、不遮挡控件。
- 语言切换按钮维持 `role="group"` 与 `aria-pressed`。
- 390×844 下长文本可读、无横向溢出；日志区保持可滚动。

## 13. 隐私与网络边界

- 不引入 storage、网络、telemetry、外部 API、service worker。
- 不向任何外部端点发送 `GameState`、手牌、日志、诊断或浏览器数据。
- 语言切换不写 storage、不发请求。
- 不读取/输出 `.env`、密钥、token、凭据。

## 14. 允许修改范围（Phase 16 实现阶段）

- 结构化 `GameLogEntry`（`eventKey`/`params`/可选 `reaction`）类型与只读写入 helper。
- 10 个生产文件中的全部 producer 写入点改造成结构化事件。
- renderer（`GameLog.tsx` 及新增渲染 helper）。
- 相关直接单测、组件测试、fixture E2E、production E2E 断言。
- `PHASE16_BILINGUAL_GAME_LOG_FREEZE.md`（ Gate 1 冻结阶段唯一允许写入）。

## 15. 禁止修改范围

- MVP0-P10 规则、卡池 68 张、`event_lab_fire` 出池约束。
- 新增金属卡 / `experiment_counterattack` 金属选项 / 新 DIY / 新 reaction / 新 status / 响应 DIY / 方程式牌 / 沉淀或金属反应链。
- AI、多人、账号、存档、回放。
- 完整英文规则书；翻译技术错误码、commit SHA、version、rules version。
- iOS Firefox 修复、新依赖、telemetry、storage、外部 API、service worker。
- CI/workflow、Pages、tag、Release 操作。
- `README.md`、`README.zh-CN.md`、`docs/MVP_PLAN.md`、`docs/PHASE15_FIRST_GAME_CONVERSION_FREEZE.md`（文档债另行收口）。

## 16. 规则不变量（不可破坏）

- 普通实体卡池 68 张；`event_lab_fire` 不进入普通卡池、不被创建为普通 `CardInstance`。
- `src/game/engine/reducer.ts` 是正式 game action reducer 入口；`GameState.log` 只由引擎正式路径写入。
- fatal 会话不得继续暴露旧的可交互 `GameState`；恢复创建匹配阵容的新状态或返回角色选择。
- 非法 action / reducer rejection 返回原状态，不写日志、不写 reaction 事件。
- 每次成功反应恰好一个 reaction 日志；reaction 日志先于硫酸盐副产摸牌日志。
- fatal / root failure 不属于 `GameState.log`（在 `FatalLocalGameSession.error` 与诊断中）。

## 17. 测试矩阵（防假绿五大测试合同）

| 层 | 命令 | 覆盖内容与断言合同 |
| --- | --- | --- |
| 单元（Vitest） | `pnpm test:run`（`vitest run`） | **防假绿 5 大合同**：<br>1. **独立 oracle**：硬编码预期值（非引用 renderer 模板表），覆盖 37 个普通事件与 4 个 reaction 变体的 zh-CN/en 精确断言；<br>2. **编译期负例**：包含类型负例断言（错误 params 组合报错、非 reaction 带有 reaction 报错、修改 params 字段报错、修改 readonly participants 报错、renderer 漏键触发 exhaustiveness 报错）；<br>3. **正式 producer 关联**：每个 eventKey 必须由至少 1 个正式 reducer/engine helper/createInitialGame 覆盖；跨文件重复 producer（`status_window_start` 2 处、`status_gained` 3 处、`status_refreshed` 3 处、`eliminated` 2 处）分别覆盖；<br>4. **Notice 生命周期**：保留 8 项 Notice 合同测试；<br>5. **无内部 ID 泄露**：校验不暴露 `statusId`、`skillId`、`recipeId` 或英文模式中文字符串。 |
| 单元（shuffle） | `pnpm test:shuffle` | 顺序无关稳定性 |
| 组件 | 同上（happy-dom） | `GameLog.tsx` 双语渲染、历史日志随 locale 重渲染、`SuccessfulReactionNotice.tsx` 8 大生命周期合同 |
| fixture E2E | `pnpm test:e2e`（`build:e2e` + Playwright） | `e2e/tests/debug-alpha.spec.ts`：双语日志、`long-log`（≥100 条）、reaction 视图、语言切换后历史日志立即重渲染 |
| production E2E | `pnpm test:e2e:production`（`build` + production config） | 真实 `dist`（`/` 与 `/playtest/`）双路径，无 debug fixture / 私有 marker 注入；由正式 UI/reducer 触发真实日志；断言 zh-CN/en 可见文本；检验原位重渲染；检查 console/pageerror/requestfailed / 非成功同源响应 / 外部请求拦截 / 390×844 溢出 |
| 390×844 | 上述 E2E 内 `setViewportSize({width:390,height:844})` | 中英文长日志无横向溢出 |
| size | `pnpm check:size`（`scripts/check-size.mjs`） | 两阶段 size 检查（骨架落地后 + 最终 build 后）：js gzip ≤100KB、css gzip ≤10KB、总 ≤500KB |

### 17.1 编译期 negative test 详细规范

项目将使用现有 TypeScript (`tsc` / typecheck) 机制表达以下 negative test 合同（不得引入新外部依赖）：

- **负例 1 (Mismatch Params)**: `appendEvent(state, { eventKey: "turn_start", params: { cycleNumber: 1 } })` 必须产生 TS 编译错误。
- **负例 2 (Missing Reaction)**: `appendEvent(state, { eventKey: "reaction", params: {} })`（缺少 reaction）必须产生 TS 编译错误。
- **负例 3 (Unexpected Reaction)**: `appendEvent(state, { eventKey: "turn_start", params: { playerId: "player_1" }, reaction: ... })` 必须产生 TS 编译错误。
- **负例 4 (Mutating Params Field)**: `const entry = state.log[0]; entry.params.amount = 5;` 必须产生 TS 编译错误。
- **负例 5 (Mutating Participants)**: `entry.reaction.participants.push(...)` 或修改 `participants[0]` 必须产生 TS 编译错误。
- **负例 6 (Non-Exhaustive Renderer)**: `renderGameLogEntry` 若漏写任一 `eventKey`，`satisfies Record<GameLogEventKey, ...>` 必须产生 TS 编译错误。

## 18. Production E2E 要求

- 运行 `pnpm run build` 后以 `playwright.production.config.ts` 在真实 `dist`（`/` 与 `/playtest/`）验收。
- `base: "./"` 支持两条路径的相对资源；不新增网络请求。
- 必须通过正式 UI/reducer 产生真实普通日志，不得在 production E2E 中直接注入 GameState 或依赖 debug fixture。
- 双语切换后正式日志正确渲染，且不改变 `GameState` 语义（`game.log` 长度不变、事件不变）。
- 无横向溢出（`body.scrollWidth <= body.clientWidth`、`document.scrollWidth <= document.clientWidth`）。

## 19. 390×844 验收

- 在 `390×844` 视口断言中英文正式日志均无横向溢出。
- `long-log` fixture（≥100 条）下日志区 `overflowY` 为 `auto/scroll`，`scrollHeight > clientHeight`。
- 长反应参与者/结果文本在 390px 宽下可读、不溢出。

## 20. console / pageerror / requestfailed 要求

- console 无 `error`/`warning`。
- 无 `pageerror`。
- 无 base-origin 内 `requestfailed` 或非 2xx/3xx `response`。
- 无跨 base-origin 外部请求（现有 production spec 的 `externalRequests` 断言保持）。
- 语言切换不产生任何 console 噪声或网络请求。

## 21. Size Gate（两阶段检查）

门限保持：`javascriptGzip ≤ 100KB`、`cssGzip ≤ 10KB`、`total ≤ 500KB`。

**两阶段 Checkpoint 机制**：
1. **阶段 Checkpoint 1**：在类型定义、双语模板表、presentation resolver 以及最小 renderer 骨架落地后，**尽早运行一次 `pnpm run check:size`**，及时识别膨胀风险；
2. **阶段 Checkpoint 2**：在全部 producer、UI 迁移、测试补充及 production build 完成后，运行最终 size gate。

**超限应对冻结合同**：
- 不得提高现有 JS、CSS 或总体积门限；
- 不得引入大型 i18n 依赖（如 react-i18next 等）；
- 不得在 `GameState.log` 中同时保存完整中文和英文文本；
- 优先复用 `presentationLocale` 已有映射；
- 接近或超过门限时，先去除冗余模板、优化 map 声明与压缩结构；
- 不得通过削弱 Phase 16 测试、裁剪必要类型或提高门限解决超限。

## 22. 停止条件

以下任一成立即停止：

- 原仓库基线不匹配（`BASELINE_MISMATCH`）。
- 目标分支或 worktree 已存在冲突。
- 日志清点发现无法从现有实现确定的玩家语义（停止并报告 `BLOCKED`）。
- 出现本文件之外的文件修改或新增 untracked。
- 未授权的外部操作（fetch、commit、push、tag、PR、部署、Release、Pages）。

## 23. 实现分步计划（含两阶段 Size Gate）

1. **类型与只读骨架**：引入 `GameLogEventKey` + `GameLogParamsMap` + `LogPresentationContext` + `GameLogEntry`。
2. **两阶段 Size Gate 检查 1**：模板与骨架落地后，尽早运行 `pnpm run check:size`，验证体积增量符合预期。
3. **Producer 迁移**：逐点把 10 个生产文件中的所有 producer 写入改造为结构化事件（包括 `status_window_start` 2 处、`status_gained` 3 处、`status_refreshed` 3 处、`eliminated` 2 处）。
4. **Renderer 与 Presentation 实现**：实现双语 renderer `Record<GameLogEventKey, Renderer>`，扩展 `getDiyVirtualProductDisplayName(recipeId, locale)`。
5. **测试用例迁移与防假绿补齐**：编写独立 text oracle 测试、编译期 type negative test、正式 producer 关联测试及 8 项 Notice 生命周期测试。
6. **删除 Legacy Message**：在 Phase 16 PR 提交前彻底删除 `message` 兼容字段与 `createLogEntry` 死代码，`rg "message"` 确认无残留。
7. **两阶段 Size Gate 检查 2 及完整验收**：运行 unit/component/fixture E2E/production E2E/390×844/最终 size gate。

## 24. 已知风险

- 文案真值分散：41 个去重语义模板分布于 10 个生产文件，`status_gained`/`status_refreshed`/`status_window_start`/`eliminated` 存在跨文件重复 producer，迁移时必须逐一核对。
- `getDamageSourceName` 对 status/character-skill 来源回退为原始 `statusId`/`skillId`（内部 ID），结构化后需改由 ID 参数 + renderer 正式 presentation 入口解析。
- `DIYRecipe.displayName` 是仅中文数据字段；Phase 16 必须通过 `getDiyRecipeDisplayName` (方程式) 与 `getDiyVirtualProductDisplayName` (双语产品) 两个独立入口解析，不得暴露中文 `displayName` 或 `recipeId`。
- `createLogEntry` 为死代码，迁移时一并清理。
- 现有单测大量 `entry.message.includes(...)` 耦合中文文案，迁移必须同步更新断言。
- `PASS_ACTION`（放弃主行动）不写日志，此为既有行为，不做改变。

## 25. 尚需用户裁决的问题（非阻塞，供评审）

- 第 11 节英文模板的措辞为忠实翻译，已调整为待响应基础伤害语义（waiting for response, base damage value），最终文案需用户验收。
- `diy_virtual_attack` 配方与产品解耦展示：已冻结为由 `getDiyRecipeDisplayName` 与 `getDiyVirtualProductDisplayName` 两个独立入口解析。
- legacy `message` 过渡字段：已冻结为“仅实现分支内部临时保留、PR 合并前彻底删除”。
- 内部“调试详情”中继续限制在折叠区，不进入公开日志文案。
