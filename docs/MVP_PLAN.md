# 化学在线卡牌游戏 MVP 0 规划

## 规则来源

权威规则来自 `docs/rules/` 下两份文档，文件名已统一为英文：

- `core-rules-v0.1.docx`：核心游戏流程、伤害、状态与基础卡池。
- `ion-reaction-and-diy-manual-v1.0.docx`：离子反应、DIY 构建、气体与状态裁定手册。

## MVP 0 定案范围

MVP 0 只做一个可运行、可调试、可复盘的本地双人规则模拟器。目标不是还原完整桌游，而是先验证“摸牌、行动、主动 DIY、少量核心反应、状态处理、伤害和胜负”这条最短闭环。

已定案：

- 只支持本地双人。
- 只支持公开调试模式：双方手牌、牌堆数量、弃牌堆、状态、日志全部可见。
- 无角色：不实现角色选择、角色体力差异、角色技能、角色摸牌规则。
- 双方初始体力均为 10。
- 关闭响应 DIY；仅保留每名玩家每周期 1 次主动 DIY。
- 采用 V0.1 默认自由出牌；正常行动不要求与场面基准牌关联。
- 保留 70 张固定测试卡池，不压缩到 40 张。
- 禁止任何“无即时合法效果”的主行动出牌。
- 元素牌、普通离子牌只能作为 DIY 组件。
- H+、OH-、CO3^2- 等特殊离子仅能在各自合法响应窗口或状态处理窗口使用。
- H2O、手牌 CO2 仅能在火情状态处理窗口使用。
- O2 是可从牌库摸到的物质牌，可在主行动中仅对自己使用并回复 2 HP。
- Na2CO3 仅能作为酸性攻击的响应牌。
- 暂不实现 Ag+、AgCl、方程式牌、金属置换、高危牌、专业处置牌、多人技能。
- 暂不实现 BaSO4 沉淀链，直到先定义零伤害盐/离子牌在正常行动中的触发窗口和收益。
- 暂不实现私密手牌、账号、匹配、房间、断线重连、观战、AI。

MVP 0 核心反应仅保留：

- 酸碱中和。
- 酸与碳酸盐生成 CO2。
- SO2 泄漏与碱性吸收。
- 火情与 H2O / CO2 灭火。

MVP 0 对 SO2 的定案：

- SO2 物质牌的效果固定为：使目标获得 `SO2_LEAK` 状态。
- SO2 物质牌不直接造成即时伤害。
- `SO2_LEAK` 在目标行动开始时进入状态处理窗口；若未移除，才造成 2 点伤害。
- `SO2_LEAK` 是持续状态：伤害后不自动移除，直到被合法处理牌或效果移除。
- SO2 施加 `SO2_LEAK` 时不开启即时响应窗口；目标只能在其下一次行动开始时的状态处理窗口中处理。

MVP 0 对火情的定案：

- 加入测试事件牌“实验台起火”，类型为 `event`。
- “实验台起火”效果：选择一名其他玩家，使其获得 `FIRE`。
- “实验台起火”不造成即时伤害，不描述现实操作。
- `FIRE` 在目标行动开始时进入状态处理窗口；若未移除，才造成 2 点伤害。
- `FIRE` 是持续状态：伤害后不自动移除，直到被合法处理牌或效果移除。
- “实验台起火”施加 `FIRE` 时不开启即时响应窗口；目标只能在其下一次行动开始时的状态处理窗口中处理。
- DIY 生成 CO2 时，仅当行动玩家当前拥有 `FIRE` 时，才允许选择该配方。
- DIY 生成 CO2 后，立即移除行动玩家自己的 `FIRE`。
- 如果该行动开始时 `FIRE` 未被手牌处理，则玩家已经先承受本次 2 点状态伤害；主行动中 DIY CO2 只能阻止后续行动开始时再次受伤，不能追溯抵消本次伤害。

MVP 0 对 O2 的定案：

- O2 是可从牌库摸到的物质牌，不是通过 O + O 临时生成。
- O2 仅允许存活的 `activePlayer` 在 `mainAction` 对自己使用。
- 使用 O2 时，弃置 1 张手牌中的 O2，回复 2 HP，且不超过最大 HP。
- O2 不进入 `responseWindow`。
- 满 HP 时不能使用 O2。
- 当自己拥有 `SO2_LEAK` 或 `FIRE` 时不能使用 O2。
- `SO2_LEAK` 与 `FIRE` 在 MVP 0 中标记为“阻止回复”的负面状态。
- H2O 仅用于处理 `FIRE`，不回复 HP。
- O + O -> O2 主动 DIY 仍暂缓。

## MVP 0 状态规则

`SO2_LEAK` 与 `FIRE` 都是持续状态：

- 行动开始时未被处理，则受到 2 点状态伤害。
- 伤害后状态不自动移除。
- 状态会一直保留，直到被合法处理牌或效果移除。

状态叠加与处理顺序：

- 同名状态不叠加。
- 玩家已有同名状态时再次获得该状态，不创建新的状态实例，仅记录“状态刷新”日志。
- 不同状态可以同时存在。
- 行动开始时，按状态获得时间从早到晚逐个处理。
- 每个状态单独进入状态处理窗口。
- 玩家淘汰后，立刻停止后续状态结算。

MVP 0 特别覆写：

- SO2 与“实验台起火”施加状态时，不开启即时响应窗口。
- 目标只能在其下一次行动开始时的状态处理窗口中处理对应状态。

## MVP 0 完整对局流程

1. 创建本地双人游戏：玩家 A、玩家 B，双方体力 10。
2. 使用固定 MVP 0 测试卡池生成主牌堆并洗牌。
3. 随机或手动指定起始玩家。
4. 进入第 1 个实验周期。
5. 周期开始：每名玩家摸 10 张牌。
6. 每个实验周期包含 3 个实验轮次。
7. 每个实验轮次中，玩家按顺序各进行一次行动阶段。
8. 行动阶段开始时，如果当前玩家有 `SO2_LEAK` 或 `FIRE`，先按状态获得时间从早到晚逐个进入状态处理窗口。
9. 状态处理窗口中，当前玩家可以打出合法处理牌移除当前正在处理的状态。
10. 若玩家不处理或无法处理，仍存在的当前状态造成 2 点伤害；伤害后状态不自动移除。
11. 若玩家因状态伤害被淘汰，立刻停止后续状态结算。
12. 状态处理完成后进入主行动窗口。
13. 主行动窗口中，当前玩家可以选择：正常打出 1 张允许主行动使用且会产生即时合法效果的牌、进行 1 次主动 DIY、或放弃行动。
14. 正常打出酸/碱攻击牌时，若目标手中有合法响应牌，可进入响应窗口。
15. SO2 与“实验台起火”施加状态时不进入即时响应窗口。
16. 响应窗口只允许打出现有手牌；不允许响应 DIY。
17. 酸伤害可被碱中和，也可被普通 CO3^2- 或 Na2CO3 响应并生成 CO2；碱伤害可被酸中和。
18. 酸与碳酸盐响应后生成的 CO2 在 MVP 0 只写入操作日志，不创建临时资源、CO2 token 或可用于灭火的临时 CO2。
19. MVP 0 不实现反击伤害；响应成功只取消或改变当前效果。
20. 每次效果结算后检查体力。体力降至 0 的玩家立即淘汰。
21. 若只剩 1 名玩家存活，该玩家获胜。
22. 若同一次结算中双方同时体力降至 0，按 V0.1 测试规则判为平局。
23. 每个实验周期的 3 个实验轮次结束后进入清理阶段。
24. 清理阶段：双方弃置剩余手牌，重置本周期主动 DIY 使用次数，进入下一实验周期。
25. 主牌堆不足时，将弃牌堆洗混为新主牌堆；正在结算的牌不参与洗混。

## MVP 0 暂缓规则

这些规则来自原始规则书，但不进入 MVP 0：

- 角色牌与角色技能。
- 响应 DIY。
- 接牌限制变体。
- 方程式牌。
- Ag+ / AgCl 检验链。
- BaSO4 沉淀链。
- 金属活动性与金属置换。
- 高危牌与专业处置牌。
- 多目标技能。
- 多人座位响应顺序。
- 私密手牌与不同玩家视角。
- 任意无效果主行动弃牌。
- H2O、手牌 CO2 在主行动中自由弃置。
- Na2CO3 在主行动中自由弃置。
- H + H -> H2、O + O -> O2、2Na+ + CO3^2- -> Na2CO3 这三条主动 DIY 配方。

BaSO4 沉淀链暂缓的原因：BaCl2、Na2SO4 等零伤害盐牌如果能在主行动中正常打出，需要先定义它们的主动收益、目标、是否占用行动、是否建立场面资源、是否可被对方立即响应。否则很容易出现“为了以后反应而空打一张牌”的体验和程序判定都不清楚。

## MVP 0 架构硬边界

- `engine/reducer.ts` 是唯一能改变 `GameState` 的入口。
- React 组件只能读取 `GameState` 和 `dispatch Action`，不能自行修改血量、手牌、牌堆、弃牌堆、回合、状态或胜负。
- `engine/actions.ts` 只定义玩家意图，例如出牌、选择目标、选择响应、主动 DIY、放弃行动；它不直接修改状态。
- `engine/effects.ts` 定义可结算的效果类型，例如 `DAMAGE`、`HEAL`、`DRAW`、`DISCARD`、`ADD_STATUS`、`REMOVE_STATUS`、`MOVE_CARD`、`ADVANCE_TURN`。
- `engine/resolution.ts` 负责统一结算效果队列、状态处理窗口、响应窗口、反应链深度、淘汰和胜负。
- 任何卡牌、DIY、状态或反应都不应直接写入 `GameState`；它们只能生成 `Effect[]`，交给 `resolution.ts` 结算。
- `visibility.ts` 在 MVP 0 中仅保留接口和公开调试模式；不实现私密手牌。
- MVP 0 删除未使用的 `inPlay`。打出的牌通过 `MOVE_CARD` 从手牌进入弃牌堆；需要展示的过程依赖日志和 `PendingResponse`。

建议采用这条单向数据流：

```txt
React UI
  -> dispatch(Action)
  -> engine/reducer.ts
  -> validate Action
  -> card/diy/status/reaction logic produces Effect[]
  -> engine/resolution.ts resolves Effect queue and PendingResponse
  -> new GameState
  -> React UI renders new state
```

## MVP 0 数据结构草案

MVP 0 必须拆分 `CardDefinition` 与 `CardInstance`：

- `CardDefinition` 描述一种卡是什么，例如 HCl、NaOH、CO2。
- `CardInstance` 描述牌堆里某一张具体牌，例如 `card_042`，它引用一个 definition。

```ts
type CardType = "element" | "ion" | "substance" | "event";

type PlayTiming =
  | "main-action"
  | "response"
  | "status-window"
  | "diy-component";

type Tag =
  | "acid"
  | "base"
  | "carbonate"
  | "harmful-gas"
  | "aqueous"
  | "fire-extinguish"
  | "alkaline-absorb"
  | "neutralizer"
  | "fire-source";

interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  formula?: string;
  elements?: string[];
  ionsProvided?: string[];
  tags: Tag[];
  baseDamage?: number;
  allowedTimings: PlayTiming[];
  rulesText: string;
}

interface CardInstance {
  id: string;
  definitionId: string;
  ownerId?: string;
  zone: CardZone;
}

type CardZone =
  | { type: "deck" }
  | { type: "hand"; playerId: string }
  | { type: "discard" };

interface Player {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  hand: string[];
  statuses: PlayerStatus[];
  eliminated: boolean;
  usedDIYThisCycle: boolean;
}

interface PlayerStatus {
  id: string;
  statusId: "SO2_LEAK" | "FIRE";
  sourcePlayerId?: string;
}

interface GameState {
  id: string;
  phase:
    | "setup"
    | "cycleStart"
    | "actionStart"
    | "statusWindow"
    | "mainAction"
    | "responseWindow"
    | "cleanup"
    | "gameOver";
  players: Player[];
  activePlayerId: string;
  startingPlayerId: string;
  cycleNumber: number;
  roundInCycle: 1 | 2 | 3;
  cardInstances: Record<string, CardInstance>;
  deck: string[];
  discardPile: string[];
  baselineCardId?: string;
  pendingResponse?: PendingResponse;
  effectQueue: Effect[];
  log: GameLogEntry[];
  winnerPlayerId?: string;
  isDraw?: boolean;
  settings: GameSettings;
}

type Action =
  | { type: "START_GAME"; payload: StartGamePayload }
  | { type: "PLAY_CARD"; playerId: string; cardInstanceId: string; targetPlayerId?: string }
  | { type: "START_ACTIVE_DIY"; playerId: string; recipeId: string; componentCardInstanceIds: string[]; targetPlayerId?: string }
  | { type: "RESPOND_WITH_CARD"; playerId: string; cardInstanceId: string }
  | { type: "PASS_RESPONSE"; playerId: string }
  | { type: "HANDLE_STATUS_WITH_CARD"; playerId: string; statusInstanceId: string; cardInstanceId: string }
  | { type: "PASS_STATUS_HANDLING"; playerId: string; statusInstanceId: string }
  | { type: "PASS_ACTION"; playerId: string };

type Effect =
  | { type: "DAMAGE"; sourceId: string; targetPlayerId: string; amount: number; damageKind: "acid" | "base" | "status"; canRespond: boolean }
  | { type: "HEAL"; sourceId: string; targetPlayerId: string; amount: number }
  | { type: "DRAW"; playerId: string; count: number }
  | { type: "DISCARD"; playerId: string; cardInstanceIds: string[] }
  | { type: "ADD_STATUS"; sourceId: string; targetPlayerId: string; statusId: "SO2_LEAK" | "FIRE" }
  | { type: "REMOVE_STATUS"; targetPlayerId: string; statusInstanceId: string }
  | { type: "MOVE_CARD"; cardInstanceId: string; from: CardZone; to: CardZone }
  | { type: "ADVANCE_TURN" };

interface PendingResponse {
  responderId: string;
  sourceEffect: Effect;
  chainDepth: number;
  effectsAfterPass: Effect[];
}

interface Reaction {
  id: string;
  name: string;
  trigger:
    | "acid_vs_base"
    | "acid_vs_carbonate"
    | "base_vs_acid"
    | "so2_absorption"
    | "fire_extinguish";
  responseRequirements: ResponseRequirement[];
  cancelsSourceEffect: boolean;
  producedEffects: Effect[];
  logOnlyProducts?: string[];
  rulesText: string;
}

interface DIYRecipe {
  id: string;
  name: string;
  requiredComponents: ComponentRequirement[];
  resultDefinitionId: string;
  allowedTiming: "active-only";
  rulesText: string;
}

interface ComponentRequirement {
  definitionId: string;
  count: number;
}

interface StatusDefinition {
  id: "SO2_LEAK" | "FIRE";
  name: string;
  triggerTiming: "actionStart";
  damageOnUnresolved: number;
  removableByTags: Tag[];
  rulesText: string;
}
```

## 每种可使用卡的效果

MVP 0 中，元素牌和离子牌不能在主行动中无效果打出。它们只能在 `allowedTimings` 指定的窗口使用。

| 卡牌 | 允许时机 | 主行动效果 | 响应窗口效果 | 状态处理窗口效果 |
| --- | --- | --- | --- | --- |
| O 元素 | diy-component | 不可主行动打出 | 不可响应 | 不可处理状态 |
| C 元素 | diy-component | 不可主行动打出 | 不可响应 | 不可处理状态 |
| S 元素 | diy-component | 不可主行动打出 | 不可响应 | 不可处理状态 |
| H+ 离子 | diy-component, response | 不可主行动打出 | 可响应碱性伤害，视为酸碱中和并取消伤害 | 不可处理状态 |
| OH- 离子 | diy-component, response, status-window | 不可主行动打出 | 可响应酸性伤害，视为酸碱中和并取消伤害 | 可处理 SO2 泄漏，视为碱性吸收并移除状态 |
| CO3 2- 离子 | diy-component, response | 不可主行动打出 | 可响应酸性伤害，取消伤害并记录生成 CO2；不创建 CO2 卡牌、token 或灭火资源 | 不可处理状态 |
| Cl- 离子 | diy-component | 不可主行动打出 | 不可响应 | 不可处理状态 |
| SO4 2- 离子 | diy-component | 不可主行动打出 | 不可响应 | 不可处理状态 |
| Na+ 离子 | diy-component | 不可主行动打出 | 不可响应 | 不可处理状态 |
| K+ 离子 | diy-component | 不可主行动打出 | 不可响应 | 不可处理状态 |
| Ca2+ 离子 | diy-component | 不可主行动打出 | 不可响应 | 不可处理状态 |
| H2O | status-window | 不可主行动打出 | 不可响应普通伤害 | 可处理火情并移除 `FIRE` |
| CO2 | status-window | 不可主行动打出 | 不可响应普通伤害 | 可处理火情并移除 `FIRE` |
| O2 | main-action | 仅可对自己使用；若自己未满 HP 且没有 `SO2_LEAK` / `FIRE`，弃置 O2 并回复 2 HP，不超过最大 HP | 不可响应 | 不可处理状态 |
| SO2 | main-action | 使目标获得 `SO2_LEAK`，不造成即时伤害 | 不可响应 | 不可处理状态 |
| 稀 HCl | main-action, response | 对目标造成 1 点酸性伤害，可被响应 | 可响应碱性伤害，视为酸碱中和并取消伤害 | 不可处理状态 |
| 稀 H2SO4 | main-action, response | 对目标造成 1 点酸性伤害，可被响应 | 可响应碱性伤害，视为酸碱中和并取消伤害 | 不可处理状态 |
| 稀 NaOH | main-action, response, status-window | 对目标造成 1 点碱性伤害，可被响应 | 可响应酸性伤害，视为酸碱中和并取消伤害 | 可处理 SO2 泄漏并移除 `SO2_LEAK` |
| 稀 KOH | main-action, response, status-window | 对目标造成 1 点碱性伤害，可被响应 | 可响应酸性伤害，视为酸碱中和并取消伤害 | 可处理 SO2 泄漏并移除 `SO2_LEAK` |
| 石灰水 Ca(OH)2 | main-action, response, status-window | 对目标造成 1 点碱性伤害，可被响应 | 可响应酸性伤害，视为酸碱中和并取消伤害 | 可处理 SO2 泄漏并移除 `SO2_LEAK` |
| Na2CO3 | response | 不可主行动打出 | 可响应酸性伤害，取消伤害并记录生成 CO2；不创建 CO2 卡牌、token 或灭火资源 | 不可处理状态 |
| 实验台起火 | main-action | 选择一名其他玩家，使其获得 `FIRE` | 不可响应 | 不可处理状态 |

## MVP 0 主动 DIY 配方

主动 DIY 只能在自己的主行动窗口使用，每名玩家每个实验周期最多 1 次。构建结果立即作为本次正常出牌结算，不进入手牌。

MVP 0 移除无即时效果的主动 DIY 配方：H2、O2、Na2CO3。

| 配方 | 结果 | MVP 0 效果 |
| --- | --- | --- |
| C + O + O | CO2 | 仅当行动玩家当前拥有 `FIRE` 时可选择；生成后立即移除自己的 `FIRE` |
| S + O + O | SO2 | 使目标获得 `SO2_LEAK` |
| H+ + OH- | H2O | 仅当行动玩家当前拥有 `FIRE` 时可选择；两张组件弃置，立即移除自己的 `FIRE`；不创建 H2O 卡牌，不影响自己的 `SO2_LEAK` 或对方状态 |
| H+ + Cl- | 稀 HCl | 对目标造成 1 点酸性伤害 |
| 2H+ + SO4 2- | 稀 H2SO4 | 对目标造成 1 点酸性伤害 |
| Na+ + OH- | 稀 NaOH | 对目标造成 1 点碱性伤害 |
| K+ + OH- | 稀 KOH | 对目标造成 1 点碱性伤害 |
| Ca2+ + 2OH- | 石灰水 Ca(OH)2 | 对目标造成 1 点碱性伤害 |

## 固定测试卡池

MVP 0 使用固定测试卡池，不做卡组构筑。总数 70 张。

| 类别 | 卡牌 | 张数 | 用途 |
| --- | --- | ---: | --- |
| 元素 | O | 4 | DIY CO2、SO2 |
| 元素 | C | 3 | DIY CO2 |
| 元素 | S | 3 | DIY SO2 |
| 离子 | H+ | 5 | DIY 酸、响应碱 |
| 离子 | OH- | 5 | DIY 碱、响应酸、处理 SO2 |
| 离子 | CO3 2- | 4 | 响应酸生成 CO2 日志 |
| 离子 | Cl- | 4 | DIY HCl |
| 离子 | SO4 2- | 3 | DIY H2SO4 |
| 离子 | Na+ | 5 | DIY NaOH |
| 离子 | K+ | 3 | DIY KOH |
| 离子 | Ca2+ | 2 | DIY 石灰水 |
| 物质 | H2O | 3 | 灭火 |
| 物质 | CO2 | 4 | 灭火 |
| 物质 | O2 | 2 | 主行动自我回复 |
| 物质 | SO2 | 4 | 施加 SO2 泄漏 |
| 物质 | 稀 HCl | 3 | 酸性攻击 |
| 物质 | 稀 H2SO4 | 2 | 酸性攻击 |
| 物质 | 稀 NaOH | 3 | 碱性攻击、SO2 吸收 |
| 物质 | 稀 KOH | 2 | 碱性攻击、SO2 吸收 |
| 物质 | 石灰水 Ca(OH)2 | 2 | 碱性攻击、SO2 吸收 |
| 物质 | Na2CO3 | 2 | 响应酸生成 CO2 |
| 事件 | 实验台起火 | 2 | 施加 FIRE |

## 6 个可复现调试对局场景

这些场景用于写手动调试脚本或后续自动测试。每个场景都应允许固定双方手牌、牌堆顺序、当前阶段和行动玩家。

1. 酸碱中和：玩家 A 打出稀 HCl 攻击玩家 B；玩家 B 用稀 NaOH 响应；结果为 B 不掉血，两张牌进入弃牌堆，日志记录中和。
2. 碱酸中和：玩家 A 打出稀 KOH 攻击玩家 B；玩家 B 用稀 HCl 响应；结果为 B 不掉血，日志记录中和。
3. 酸与碳酸盐：玩家 A 打出稀 HCl 攻击玩家 B；玩家 B 用 CO3^2- 或 Na2CO3 响应；结果为 B 不掉血，日志记录生成 CO2；不创建临时 CO2 资源，也不触发灭火连锁。
4. SO2 泄漏处理成功：玩家 A 打出 SO2 使玩家 B 获得 `SO2_LEAK`；到 B 行动开始时，B 用稀 NaOH 处理；结果为 `SO2_LEAK` 移除，B 不受状态伤害。
5. SO2 泄漏处理失败：玩家 A 打出 SO2 使玩家 B 获得 `SO2_LEAK`；到 B 行动开始时，B 选择不处理；结果为 B 受到 2 点状态伤害。
6. 火情事件与处理：玩家 A 打出“实验台起火”使玩家 B 获得 `FIRE`；到 B 行动开始时，B 用 H2O 或 CO2 处理；结果为 `FIRE` 移除，B 不受状态伤害。另一个分支为 B 不处理并受到 2 点状态伤害；随后 B 在主行动中使用 C + O + O 主动 DIY 生成 CO2，移除自己的 `FIRE`，但不追溯抵消刚刚承受的 2 点伤害。

## 技术栈建议

MVP 0 前端建议使用 React + TypeScript + Vite。原因是界面状态复杂、组件化需求强，且本地调试体验好。

MVP 0 状态管理建议先用 React reducer 或 Zustand。但无论 UI 层用什么，游戏状态修改都必须汇入 `engine/reducer.ts`，不能在组件里临时改血量、手牌或状态。

MVP 0 测试建议用 Vitest。规则引擎必须能脱离 UI 单独测试，例如“稀 HCl 被 Na2CO3 响应后取消伤害并记录生成 CO2”。

正式后端建议等本地规则闭环稳定后再引入 Node.js + TypeScript。多人阶段必须由后端持有权威 `GameState`，客户端只提交玩家意图。

职责划分：

- 前端：展示手牌、场面、状态、操作按钮、日志；只提交玩家意图。
- 规则引擎：校验行动是否合法，生成效果，统一结算效果队列、响应、状态处理、淘汰和胜负。
- 数据层：保存卡牌定义、卡牌实例、DIY 配方、状态定义、固定测试卡池。
- 后端：MVP 0 不实现；正式多人阶段再负责房间、同步、权限、断线重连、日志保存和反作弊。

## 建议目录结构

```txt
docs/
  MVP_PLAN.md
  rules/
    core-rules-v0.1.docx
    ion-reaction-and-diy-manual-v1.0.docx

src/
  app/
    App.tsx
    routes.tsx

  game/
    engine/
      types.ts
      createInitialGame.ts
      reducer.ts
      actions.ts
      effects.ts
      resolution.ts
      turnFlow.ts
      damage.ts
      reactions.ts
      diy.ts
      statuses.ts
      visibility.ts
      log.ts

    data/
      cardDefinitions.ts
      reactions.ts
      diyRecipes.ts
      statusDefinitions.ts
      starterDeck.ts
      debugScenarios.ts

    tests/
      gameSetup.test.ts
      damage.test.ts
      reactions.test.ts
      diy.test.ts
      statuses.test.ts
      turnFlow.test.ts
      resolution.test.ts

  features/
    local-game/
      LocalGamePage.tsx
      PlayerBoard.tsx
      HandView.tsx
      CardView.tsx
      ActionPanel.tsx
      ResponsePanel.tsx
      StatusWindow.tsx
      GameLog.tsx

  shared/
    ids.ts
    random.ts
    assertions.ts

server/
  README.md
  # MVP 0 不启用；正式多人阶段再实现
```

## 暂缓功能回收清单

本清单记录 MVP 0 明确不做、但后续可回收进入第二阶段或正式多人阶段的功能。回收任何一项前，都应补齐规则口径、数据定义、测试场景和 UI 操作入口。

规则规模：

- 角色牌与 6 个 V0.1 角色。
- 角色技能，包括被动、主动、响应、每周期限次、每轮次限次。
- 响应 DIY。
- 接牌限制变体，例如“每周期一次自由出牌”。
- 方程式牌。
- 条件牌，例如加热、点燃、通电、催化。
- 多目标技能。
- 多人座位响应顺序。

反应体系：

- BaSO4 沉淀链。
- Ag+ / AgCl 检验链。
- 其他沉淀链，例如 CaCO3、Cu(OH)2、Fe(OH)3。
- 金属-酸反应。
- 金属-离子置换。
- 铵根、硝酸盐、氨气等进阶模块。
- 酸与碳酸盐响应生成的 CO2 转化为可用临时资源。

卡牌与行动：

- 任意无效果主行动弃牌。
- H2O、手牌 CO2 在主行动中自由弃置。
- Na2CO3 在主行动中自由弃置。
- H + H -> H2 主动 DIY。
- O + O -> O2 主动 DIY。
- 2Na+ + CO3^2- -> Na2CO3 主动 DIY。
- 零伤害盐/离子牌在主行动中的资源收益。
- 卡牌构筑与自定义卡池。

状态与高危模块：

- 高危牌。
- 专业处置牌。
- 强氧化性、浓溶液、剧毒等标签。
- 高危牌每周期使用限制。
- 更复杂的状态残留、状态转化和专业处理流程。

联网与产品化：

- 私密手牌与不同玩家视角。
- 账号、昵称、头像。
- 房间、匹配、邀请链接。
- 断线重连。
- 观战。
- 服务器权威规则引擎。
- 操作日志持久化与对局回放。
- 反作弊校验。
- AI 简单对手或出牌建议。

## 第二阶段候选内容

- 引入角色牌与 6 个 V0.1 角色。
- 定义零伤害盐/离子牌在主行动中的收益后，再加入 BaSO4 沉淀链。
- 加入 Ag+ / AgCl 检验链。
- 加入方程式牌与条件牌，例如加热、点燃、催化。
- 加入金属-酸反应和基础金属-离子置换。
- 加入响应 DIY，但作为可开关规则。
- 加入高危牌与专业处置牌，但保持抽象化，不提供现实操作步骤。
- 加入卡牌构筑/卡池配置界面。
- 加入可保存/回放的对局日志。
- 加入 AI 简单出牌建议或单人测试对手。

## 正式多人联机阶段内容

- 后端权威规则引擎，客户端只提交意图，不直接决定结果。
- 房间、邀请链接、座位、准备状态。
- 断线重连、重放当前 `GameState`、超时托管。
- WebSocket 实时同步。
- 私密手牌同步：每个客户端只收到自己可见的信息。
- 服务器保存操作日志，支持争议回放。
- 账号、昵称、头像、历史战绩。
- 匹配系统和观战模式。
- 版本化规则与卡池，避免旧对局被新规则破坏。
- 反作弊：服务器校验所有行动是否合法。
