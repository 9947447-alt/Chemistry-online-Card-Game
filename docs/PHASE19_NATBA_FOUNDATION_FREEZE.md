# Phase 19 — NATBA Foundation Freeze 架构与技术契约冻结

本文档为 Reaction Field Phase 19「NATBA Foundation（NATBA 游戏决策系统基础）」的权威架构与技术契约冻结合同。本文档确立了本地 AI 决策系统 NATBA（Nulledge's Artificial Tactician, Built by AI）的分层架构、状态机权限边界、决策上下文模型、公平观测投影、仿真与确定性约束、NATBA-0 验收标准以及 Phase 19 后续分步演进路线图。

除本文明确覆盖与修正的边界外，所有适用的已合并权威冻结文档（包括但不限于 `docs/MVP0_RULE_FREEZE.md`、`docs/PHASE8_CHARACTER_RULE_FREEZE.md`、`docs/PHASE9_DEBUG_UI_RULE_FREEZE.md`、`docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`、`docs/PHASE13_NEW_PLAYER_GUIDANCE_FREEZE.md`、`docs/PHASE16_BILINGUAL_GAME_LOG_FREEZE.md` 与 `docs/PHASE18_DYNAMIC_DIY_FOUNDATION_FREEZE.md` 等）继续有效；既有规则冻结不因本阶段被改写。

---

## 0. 当前发布与分支基线

- **仓库标识**：`9947447-alt/reaction-field`
- **Canonical Trunk**：`main`
- **基线提交 SHA**：`93468c9e3eb4e17f6e56353df9b848360bf3acbb`
- **当前实体卡池总数**：68 张（严格冻结，不可更改）
- **当前活跃主动 DIY 配方数**：8 个（严格冻结，行为完全等价）
- **真实单质金属卡池**：ABSENT（缺失，当前不引入）
- **响应 DIY（Response DIY）**：DISABLED（已关闭，当前不开放）
- **Phase 18E PR #21 状态**：独立处于 BLOCKED 状态，其 UI 代码与分支不进入本任务基线，亦不构成 Phase 19 引擎依赖。
- **性质**：纯文档架构与技术契约冻结，不包含生产代码、测试代码、依赖配置或规则执行变更。

---

## 1. 目的与核心问题（Purpose and Core Questions）

本文档作为 Phase 19 的基础契约，对以下 12 个核心问题提供权威且具约束力的冻结答案：

1. **NATBA 是什么？**
   - 答：Reaction Field 的本地、离线、可测试、可解释、可逐步增强的确定性游戏决策系统。
2. **NATBA 的第一代训练 / 演进方法是什么？**
   - 答：遵循“先合法、再有价值、后考虑未来”的三阶段思想，基于确定性自对弈（Self-play）、启发式权重调优与统计回归进行演进，非默认引入神经网络或强化学习。
3. **谁负责游戏规则合法性？**
   - 答：规则合法性 100% 属于 **Engine Authority**。Policy 自身无权判定规则合法性，只能在 Engine 给出的合法决策空间中做偏好选择。
4. **NATBA policy 能看到什么？**
   - 答：仅能看到通过 `AIObservation` 投影暴露的公开与自身私有信息（自身手牌、双方公开角色/HP/状态/使用标记、对手手牌数量、参考牌、弃牌堆、公开日志与当前公开决策上下文）。
5. **NATBA policy 不能看到什么？**
   - 答：人类对手的手牌具体内容、牌堆（Deck）中未来抽牌的具体顺序以及任何未公开的未来隐藏信息。
6. **哪些决策可以完整枚举？**
   - 答：有限行动决策（`finite-actions`），包含 `mainAction`、`responseWindow`、`statusWindow` 与 `experimentCounterattackWindow`。
7. **哪些决策必须使用结构化决策上下文（Structured Decision Space）？**
   - 答：组合爆炸的阶段决策，特别是实验室老师的 `preparationSelection`（20 选 10，组合数 $C(20,10)=184,756$），禁止全量枚举物化为 Action 数组。
8. **reducer 在 NATBA 中扮演什么角色？**
   - 答：reducer 是无状态副作用的权威状态转换器（state transformer），但不是纯确定性模拟器（当前存在洗牌 RNG 依赖），也不是合法的只读判定 API（不得用 `nextState !== state` 代替合法性验证）。
9. **当前 simulation 的确定性限制（Determinism Constraints）是什么？**
   - 答：评级为 **YES WITH CONSTRAINTS**。当前 `engineReducer` 内部洗牌默认调用 `Math.random`，在 Phase 19B 完成 RNG/Shuffle 依赖注入前，不可声称全局 rollout 完全可重放。
10. **NATBA-0 的精确目标是什么？**
    - 答：作为 **Random Legal Bot**，其目标不是胜率，而是作为合法决策契约验证器、状态机死锁探测器和确定性仿真基线。
11. **后续 Phase 19 如何拆分为小步 PR？**
    - 答：拆分为 Phase 19A（决策上下文与规则层）、19B（确定性仿真基础设施）、19C（NATBA-0 随机合法 Bot）、19D（人机对战集成）、19E（NATBA-1 启发式战术家）及后续演进。
12. **哪些 Engine gaps 属于 Phase 19 必修，哪些属于 future debt？**
    - 答：角色技能合法性只读查询接口缺失（Phase 19A 必修）、Reducer 洗牌依赖注入缺失（Phase 19B 必修）；实验室老师发牌不足 20 张退化至 setup 为已知健壮性技术债（Known Engine Robustness Debt，记录但在 19A 不扩大范围修改规则）。

---

## 2. NATBA 身份与设计定位（Official Identity）

### 2.1 正式名称与命名规范

- **唯一正式产品与工程全称**：
  $$\text{\textbf{NATBA — Nulledge's Artificial Tactician, Built by AI}}$$
- **历史说明（Naming History Note）**：
  早期探讨中曾使用带有文字梗性质的短语（如 *Nulledge's AI Trained By AI*），该表述现已正式废止。自 Phase 19 起，所有文档、代码注释、UI 呈现与测试用例中，唯一正式名称严格使用 **Nulledge's Artificial Tactician, Built by AI**。

### 2.2 明确否定与技术边界（What NATBA Is Not）

为避免概念混淆与过度工程，明确界定 NATBA 的否定属性：
- **NATBA 不是大语言模型（LLM Agent）**：运行时不包含 LLM 提示词工程、不调用自然语言生成。
- **NATBA 不是外部网络 API 服务**：运行时完全本地化，零网络推理依赖，不依赖 OpenAI、Claude、Gemini 等云端 API。
- **NATBA 默认不是深度神经网络（Neural Network by default）**：初始阶段不引入张量计算框架或权重黑盒。
- **NATBA 不是化学真理机（Chemistry Oracle）**：不基于现实化学常识推断规则，其一切行为严格受限于权威 Engine 规则白名单。
- **“Built by AI”的含义**：描述的是该决策系统的开发与工程构建方式（由 AI 协作设计与实现），而非运行时的外部依赖。

### 2.3 正式定位（What NATBA Is）

NATBA 是为 Reaction Field 卡牌对战系统量身打造的**本地（Local）、离线可用（Offline-capable）、全覆测试（Testable）、逻辑可解释（Explainable）、分层解耦且可逐步增强的游戏决策系统**。

---

## 3. 训练与演进哲学（Training / Evolution Philosophy）

### 3.1 阶段演进三原则

NATBA 的发展严格遵循以下核心思想梯次推进：
1. **第一阶段：永远做合法的事（Always Legal）** —— 确保 100% 的决策符合引擎权威规则，杜绝非法 Action 与状态机死锁。
2. **第二阶段：做有价值的事（Valuable & Tactical）** —— 建立透明、可解释的局面与动作评估函数，懂得伤害转化、手牌利用与状态防御。
3. **第三阶段：考虑未来局面（Lookahead & Search）** —— 在确定性仿真支持下进行有限步浅层搜索，权衡长远收益。

### 3.2 推荐版本演进路线

```
NATBA-0: Random Legal Bot
(随机合法 Bot，状态机与合法性契约验证器)
   │
   ▼
NATBA-1: Heuristic Tactician
(基于显式特征加权的确定性启发式战术家)
   │
   ▼
NATBA-1.x: Self-play Tuned Heuristic Policy
(通过海量确定性自对弈回归调优权重的启发式策略)
   │
   ▼
NATBA-2: Shallow Search Tactician
(基于确定性 Engine 模拟的浅层前瞻搜索策略)
   │
   ▼
Future: Advanced Search / Evaluators
(深度搜索 / 进阶策略探索)
```

### 3.3 初期“训练（Training）”的精确定义

在 Phase 19 基础契约中，“训练”具有明确且受限的工程定义：
- **包含**：
  - 本地无头（Headless）环境下的确定性自对弈（Deterministic Self-play）；
  - 启发式特征权重网格搜索与自动化回归微调；
  - 对局胜率矩阵、先后手偏差与角色平衡性统计；
  - 自动化回归断言与死锁探测。
- **不包含**：
  - 深度强化学习（RL）梯度更新；
  - 神经网络反向传播；
  - 大模型微调（Fine-tuning）。
- 机器学习与深度搜索可作为长期远景研究，但不属于 Phase 19 Foundation 的必选契约。

---

## 4. 权威分层体系与职责边界（Authority Model）

### 4.1 核心架构数据流与边界

系统架构严格遵循下图所示的单向控制与数据流：

```
                    +-----------------------------+
                    |       Full GameState        |
                    +--------------+--------------+
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
   +------------------------------+  +------------------------------+
   |       Engine Authority       |  |    Observation Projector     |
   | (Authoritative Rule Analysis |  | (Fair Semantic View / Filter |
   |  & Legal Action Generation)  |  |  No Opponent Hand / Deck)    |
   +--------------+---------------+  +--------------+---------------+
                  |                                 |
                  | Bounded Legal Decision Context  | Fair AIObservation
                  +----------------+----------------+
                                   |
                                   v
                    +-----------------------------+
                    |        NATBA Policy         |
                    | (Decision Logic / Heuristics|
                    |  Selects Preferred Legal Act|
                    +--------------+--------------+
                                   |
                                   | Chosen Action / Choice
                                   v
                    +-----------------------------+
                    |    Engine Revalidation      |
                    | (Authoritative Guard Check) |
                    +--------------+--------------+
                                   |
                                   | Validated Action
                                   v
                    +-----------------------------+
                    |        engineReducer        |
                    | (Authoritative Execution    |
                    |  State Transformer)         |
                    +-----------------------------+
```

### 4.2 五大核心职责严格分离

| 模块角色 | 核心问题 | 职责定义 | 权限边界 |
| :--- | :--- | :--- | :--- |
| **Engine Authority** | *“Can this action legally happen?”* | 维护全部游戏规则、时点限制、前置条件与合法动作空间。 | 拥有完整 `GameState`，负责全局合法性判断。 |
| **Observation Projector** | *“What information is policy allowed to see?”* | 将完整状态过滤为符合竞技公平性的受限只读视图。 | 抹除对手手牌内容与牌堆未来顺序。 |
| **NATBA Policy** | *“Among legal possibilities, which one do I prefer?”* | 评估当前可见信息与合法候选，做出决策。 | 绝无规则裁定权，绝不绕过合法空间自行决定动作。 |
| **Evaluator** | *“How valuable is this outcome / resulting state?”* | 对局面特征（HP、手牌、状态、轮次等）打分。 | 纯只读函数，不产生任何状态修改。 |
| **Simulator** | *“What state follows if engine executes it?”* | 在受控环境下调用权威 reducer 派生后续状态。 | 仅消费引擎执行逻辑，不自行模拟非权威规则。 |

---

## 5. 决策上下文模型（Decision Context Model）

### 5.1 架构纠偏：禁止全量物化万能 Action 数组

在 Phase 19-0 审计中曾探讨过统一提供 `enumerateLegalActions(state, playerId): readonly GameAction[]` 的接口。**本冻结文档正式纠正该方案**：

- **组合爆炸阻断**：
  在实验室老师的 `preparationSelection`（备课）阶段，玩家从发到的 20 张候选牌中挑选 10 张保留。
  其组合数学空间为：
  $$C(20, 10) = \frac{20!}{10! \cdot 10!} = 184,756$$
  若在内存中为每个决策瞬间物化 184,756 个 `CONFIRM_LABORATORY_PREPARATION` GameAction 对象，将导致极大的垃圾回收压力与性能退化，严重破坏引擎与决策层性能。
- **正式契约**：
  决策系统必须正式拆分为**有限行动空间（Finite Action Space）**与**结构化决策空间（Structured Decision Space）**。

### 5.2 决策上下文抽象契约（Conceptual Decision Context Contract）

系统应提供统一的高层决策上下文判定接口（例如概念函数 `getDecisionContext(state)`），其输出分为以下明确类别：

```ts
// 概念契约类型，具体实现文件位置与细微类型命名在 Phase 19A 中落实
export type DecisionContext =
  | { kind: "none" }
  | {
      kind: "finite-actions";
      phase: "mainAction" | "responseWindow" | "statusWindow" | "experimentCounterattackWindow";
      playerId: PlayerId;
      legalActions: readonly GameAction[];
    }
  | {
      kind: "laboratory-preparation";
      phase: "preparationSelection";
      playerId: PlayerId;
      candidateCardInstanceIds: readonly CardInstanceId[];
      keepCount: 10;
    }
  | { kind: "game-over"; winnerPlayerId?: PlayerId; isDraw?: boolean };
```

---

## 6. 有限行动决策空间（Finite Action Decision Space）

有限行动决策空间适用于所有能够在一个紧凑（bounded）数组中完整枚举全部合法 Action 的游戏阶段：

### 6.1 主行动阶段（`mainAction`）
- 当前存活且为 `activePlayerId` 的玩家进行决策；
- 合法行动集合包含：
  - `PLAY_CARD`：手牌中具备 `main-action` 时点的物质牌打出（附带合法目标玩家）；
  - `PLAY_REFERENCE_CARD`：手牌中与桌面基准牌匹配的卡牌打出；
  - `PLAY_DIY_SELECTION`：手牌组件子集经 Layer 3 `analyzeDIYSelection` 判定为 `EXECUTABLE` 的 DIY 动作；
  - `ACTIVATE_CHARACTER_SKILL`：满足角色技能前置条件的主动技能释放；
  - `PASS_ACTION`：合法的回合放弃保底动作。

### 6.2 响应窗口阶段（`responseWindow`）
- 当前 `pendingResponse.responderId` 的玩家进行决策；
- 合法行动集合包含：
  - `RESPOND_WITH_CARD`：手牌中符合响应时点与中和/吸收标签的卡牌；
  - `PASS_RESPONSE`：放弃响应并承受后续伤害/效果的保底动作。

### 6.3 状态处理窗口阶段（`statusWindow`）
- 当前 `pendingStatusHandling.playerId` 的玩家进行决策；
- 合法行动集合包含：
  - `HANDLE_STATUS_WITH_CARD`：针对 `FIRE` 状态使用灭火牌（如 $\text{CO}_2$ 或水系）进行消除；
  - `PASS_STATUS_HANDLING`：放弃处理并承受状态伤害/效果的保底动作。

### 6.4 实验反击窗口阶段（`experimentCounterattackWindow`）
- 化学爱好者（Chemistry Enthusiast）特有响应窗口，当前 `pendingExperimentCounterattack.responderPlayerId` 进行决策；
- 合法行动集合依据 `pendingExperimentCounterattack.legalOptions` 生成：
  - `RESOLVE_EXPERIMENT_COUNTERATTACK` (option: `"recover"`)：在自身生命未满且合法时回血；
  - `RESOLVE_EXPERIMENT_COUNTERATTACK` (option: `"acid-base-pursuit"`, cardInstanceId)：打出酸碱物质牌进行追击；
  - *注：`metal-counterattack` 选项当前未实装且无实体金属卡，严禁生成。*

---

## 7. 结构化决策空间（Structured Decision Space）

结构化决策空间适用于参数空间较大、需要结构化约束表达的特殊决策场景：

### 7.1 实验室老师备课阶段（`preparationSelection`）
- **触发条件**：`phase === "preparationSelection"` 且存在 `pendingLaboratoryPreparation`；
- **决策约束**：
  - 候选牌池：`candidateCardInstanceIds`（精确包含 20 张本次周期的候选卡牌实例）；
  - 约束参数：`keepCount === 10`（必须从中选择且仅选择 10 张卡牌实例）；
- **策略职责**：
  - Policy 根据当前手牌构成、角色相性与战术偏好，从 20 张候选中选出 10 张 `keptCardInstanceIds`；
  - 输出格式为：
    ```ts
    {
      type: "CONFIRM_LABORATORY_PREPARATION",
      playerId: player.id,
      keptCardInstanceIds: CardInstanceId[] // 长度必须严格等于 10 且均为 candidate 成员
    }
    ```
- **引擎权威校验**：
  - Engine 重新校验 `keptCardInstanceIds` 确实属于当前 `candidateCardInstanceIds` 且无重复、数量为 10；
  - 校验通过后推进状态机进入 `actionStart`，未保留的 10 张卡牌自动移入 `discardPile`。

---

## 8. Action Surface 权威总表与废弃隔离

### 8.1 完整 GameAction Surface 状态

| Action 类型 | 当前引擎支持状态 | NATBA 决策支持状态 | 决策空间归属 |
| :--- | :--- | :--- | :--- |
| `CONFIRM_LABORATORY_PREPARATION` | SUPPORTED | **SUPPORTED** | Structured Decision |
| `PASS_ACTION` | SUPPORTED | **SUPPORTED** | Finite Action |
| `PLAY_REFERENCE_CARD` | SUPPORTED | **SUPPORTED** | Finite Action |
| `PLAY_CARD` | SUPPORTED | **SUPPORTED** | Finite Action |
| `RESPOND_WITH_CARD` | SUPPORTED | **SUPPORTED** | Finite Action |
| `PASS_RESPONSE` | SUPPORTED | **SUPPORTED** | Finite Action |
| `HANDLE_STATUS_WITH_CARD` | SUPPORTED | **SUPPORTED** | Finite Action |
| `PASS_STATUS_HANDLING` | SUPPORTED | **SUPPORTED** | Finite Action |
| `ACTIVATE_CHARACTER_SKILL` | SUPPORTED | **SUPPORTED** | Finite Action |
| `RESOLVE_EXPERIMENT_COUNTERATTACK` | SUPPORTED | **SUPPORTED** | Finite Action |
| `PLAY_DIY_SELECTION` | SUPPORTED | **SUPPORTED** (唯一 DIY 路径) | Finite Action |
| `START_ACTIVE_DIY` | LEGACY COMPAT | **STRICTLY EXCLUDED** (严禁使用) | N/A (排除) |

### 8.2 `START_ACTIVE_DIY` 排除契约

- `START_ACTIVE_DIY` 仅作为 Phase 18 迁移期的历史兼容入口，依赖显式 `recipeId`，破坏选牌驱动设计。
- **严格冻结契约**：NATBA 的决策生成器、策略实现、无头测试与集成对战中，**绝对不得生成 `START_ACTIVE_DIY` Action**。所有主动 DIY 决策必须唯一使用 `PLAY_DIY_SELECTION`。

---

## 9. DIY 权威性与枚举边界（DIY Authority）

### 9.1 权威语义分析器（Layer 3 Authority）

- `analyzeDIYSelection(state, playerId, componentCardInstanceIds, targetPlayerId)` 是 Phase 18D 建立的 Layer 3 唯一权威语义分析器。
- **NATBA 的使用规则**：
  1. NATBA 从自身可见手牌中生成有界（bounded）的卡牌实例组合；
  2. 针对需要目标的配方，附加潜在合法目标对手；
  3. 将组合传入 `analyzeDIYSelection`；
  4. 仅当返回 `status === "EXECUTABLE"` 时，才将该组合封装为 `PLAY_DIY_SELECTION` 加入合法行动集合。
- **禁止事项**：
  - NATBA 严禁自行实现独立的 DIY 配方匹配算法；
  - NATBA 严禁根据化学式合成逻辑或化学常识假定某组合合法；
  - NATBA 严禁将 `recipeId` 作为出牌合法性凭据。

### 9.2 候选组合生成与卡牌实例身份

- **实例身份不变量**：手牌中若存在多张同名卡牌（例如两张 `ion_h`），它们具有不同的 `CardInstanceId`。生成候选时必须保留具体实例身份。
- **组合范围契约**：当前 8 个配方的组件规模为 $k \in [2, 3]$。但在契约层面，**不硬编码“只枚举 2~3 张”**作为永恒上限。契约定义为：*“候选组合生成必须是有界的（bounded），且所有候选的合法性最终由 `analyzeDIYSelection` 判定”*。
- **等价分支优化契约**：若未来对相同 definition 的卡牌实例分支进行剪枝优化，必须确保不改变卡牌实例销毁与结算语义。

---

## 10. 角色技能引擎契约差距（Character Skill Authority Gap）

### 10.1 现状与 Material Engine Gap 记录

当前代码库中存在以下已知架构差距：
- **现状**：主动角色技能（如补课 `extra_lesson`、紧急物资 `emergency_supply`、强碱回收 `alkali_recovery`、尾气排放 `exhaust_discharge`、尾气泄漏 `exhaust_leak`、实验室起火 `lab_fire`、放热事故 `exothermic_accident`）的前置条件判断、合法性校验与消耗逻辑分散在 `src/game/engine/characterSkills.ts` 的执行器内部。
- **差距（Gap）**：引擎层缺乏统一、公开、只读的技能合法性判定接口（如 `canActivateCharacterSkill`）与技能合法动作生成器。
- **风险**：若 UI、AI 与 Engine 各自维护一套技能前置判定条件，将产生三方逻辑漂移与潜在回归。

### 10.2 Phase 19A 修复契约

- **Phase 19A 必须消除该 Gap**：在 Phase 19A 中，必须在 Engine 层提供统一的只读角色技能合法性分析器与合法技能 Action 生成逻辑。
- **建议 API 方向（Suggested API，具体名称由 Phase 19A 落地）**：
  ```ts
  // 建议接口形态，供 Phase 19A 参考
  export function canActivateCharacterSkill(state: GameState, playerId: PlayerId, skillId: CharacterSkillId): boolean;
  export function getLegalCharacterSkillActions(state: GameState, playerId: PlayerId): readonly ActivateCharacterSkillAction[];
  ```
- **不变量**：AI Policy 严禁在策略内部硬编码复制角色技能的私有前置规则。

---

## 11. 公平 AI 观测模型（Fair AI Observation Model）

### 11.1 产品决策唯一冻结（Frozen Product Decision）

本项为正式产品决策，不再作为未决项：
$$\text{\textbf{默认单人对战（Solo vs AI）中的 NATBA 必须是严格公平的非全知 AI（Fair / Non-Omniscient）。}}$$

### 11.2 信息可见性与隔离边界

| 信息类别 | NATBA Policy 可见性 | 说明 |
| :--- | :--- | :--- |
| **自身手牌** | **完全可见** | 包含完整的 `CardInstanceId` 与对应 `CardDefinition`。 |
| **自身与对手角色** | **完全可见** | 双方的角色定义、`CharacterId` 与技能描述。 |
| **双方 HP 与 MaxHP** | **完全可见** | 当前生命值与最大生命值。 |
| **双方 Statuses** | **完全可见** | 包含 `FIRE`、`SO2_LEAK` 及其创建信息。 |
| **技能使用标记** | **完全可见** | `characterUsage`（每周期/每轮次使用计数）、`usedDIYThisCycle`。 |
| **对手手牌数量** | **完全可见** | 仅知道对手当前持有几张牌（数字），**绝不知道卡牌内容**。 |
| **桌面基准牌** | **完全可见** | 当前 `tableReference` 的全部公开数据。 |
| **弃牌堆（Discard Pile）** | **完全可见** | 弃牌堆为公开已知区域，卡牌 ID 与内容可见。 |
| **公开游戏日志** | **完全可见** | `state.log` 中记录的所有历史事件。 |
| **游戏阶段与轮次** | **完全可见** | `cycleNumber`、`roundInCycle`、`phase`、`activePlayerId` 等。 |
| **牌堆剩余张数** | **完全可见** | `deck.length`（数字）。 |
| **对手手牌具体内容** | **严格隐藏** | **禁止**策略读取对手手牌中的 `definitionId` 或实例信息。 |
| **牌堆未来抽牌顺序** | **严格隐藏** | **禁止**策略预读牌堆数组后续元素的排列。 |
| **其他未来隐藏信息** | **严格隐藏** | 包括未触发的随机洗牌结果等。 |

### 11.3 引擎权限 vs 策略可见性解耦

- **Engine Authority 的全知性**：Engine 在计算合法动作空间（如评估是否有人需要响应）时可以使用完整 `GameState`，这属于规则裁决，不属于 AI 作弊。
- **Policy 的受限性**：真正进行价值权衡、偏好挑选与启发式打分的 NATBA Policy，只能消费经由 `Observation Projector` 投影后的 `AIObservation`。
- **调试模式隔离**：现有的 `VisibilityMode = "public-debug"` 仅服务于开发者调试 UI，严禁作为单人对战公平 AI 的可见性模型。未来若实现全知作弊 Bot（Omniscient Debug Bot），只能作为独立的压测工具，不得污染正式 NATBA 契约。

---

## 12. 仿真与 Reducer 契约纠偏（Simulation & Reducer Contract）

### 12.1 重要架构纠偏：Reducer 当前非完全确定性模拟器

在 Phase 19-0 审计中曾将 `engineReducer` 称为“纯确定性 Rollout 模拟器”。**本冻结文档正式纠正该表述**：

- **现状事实**：
  `engineReducer` 是**无变异的状态转换器（mutation-free state transformer）**，但在执行某些逻辑（如抽牌时弃牌堆重洗入牌堆 `recycleDiscardIntoDeck`）时，当前静态传递了 `fisherYatesShuffle`，其内部默认依赖未受控的 `Math.random()`。
- **直接后果**：
  在触发洗牌的状态转换路径上，相同的 `(state, action)` 无法保证产出位级一致（bit-identical）的 `nextState`。
- **仿真安全性正式评级**：
  $$\text{\textbf{Simulation Safety: YES WITH CONSTRAINTS}}$$
- **约束要求**：
  在 Phase 19B 完成确定性 RNG 与洗牌依赖注入前，不得声称所有 rollout 完全可重放，亦不得将当前公共 `engineReducer` 直接用作无约束的确定性前瞻搜索模拟器。

### 12.2 Reducer 不是合法性判定 API（Reducer is NOT the Legality API）

- **重要原则**：
  禁止将 `engineReducer(state, action) !== state`（即“执行后状态引用是否发生改变”）作为运行期判定 Action 合法性的手段。
- **危害**：
  若策略采用“试探性执行每个 Action 看状态是否改变”来检测合法性，不仅存在严重的性能浪费与潜在副作用（如洗牌 RNG 消耗），而且混淆了规则分析与状态执行的职责。
- **正确关系**：
  $$\text{Authoritative Analyzer} \longrightarrow \text{Legal Decision Context} \longrightarrow \text{Policy Choice} \longrightarrow \text{Authoritative Execution}$$
  测试中可以断言“合法 Action 不被 Reducer 拒绝”，但生产代码必须先验证后执行。

---

## 13. 随机性与确定性契约（Randomness & Determinism）

### 13.1 当前代码库随机性现状记录

1. `createInitialGame` 已支持可选传入注入的 `ShuffleFunction`；
2. `src/shared/random.ts` 中已实现 `identityShuffle` 与带可插拔随机源的 `fisherYatesShuffle`；
3. `drawCardsForPlayer` 与 `turnFlow` 内部函数已支持接收 `ShuffleFunction` 参数；
4. 公共入口 `engineReducer` 当前硬编码传递默认 `fisherYatesShuffle`（依赖 `Math.random`）。

### 13.2 Phase 19B 确定性目标

- **目标**：为 Headless Simulation 与未来搜索提供 100% 可重现的 Seeded Execution 路径。
- **重现契约**：
  在相同的初始状态、相同的 PRNG 种子（Seed）与相同的策略版本下，必须能够 100% 稳定复现整局游戏轨迹（包括每一步 Action、状态转移与日志）。
- **算法解耦**：文档不强制绑定某一种特定 PRNG 实现（如 `mulberry32` 或 `xorshift128`），具体 PRNG 算法在 Phase 19B 中选型落地，本契约冻结的是确定性重现能力。

---

## 14. 循环与死锁防护（Loop & Deadlock Safety）

### 14.1 窗口保底与死锁防护机制

为了保障 NATBA-0 及后续策略在任何合法可达状态下绝不发生死锁，冻结以下兜底机制：

1. **主行动保底**：`PASS_ACTION` 在 `phase === "mainAction"` 时永远合法，确保无法出牌或无利可图时能安全推进轮次。
2. **响应窗口保底**：`PASS_RESPONSE` 在 `phase === "responseWindow"` 时永远合法，确保不响应时伤害正常结算。
3. **状态处理保底**：`PASS_STATUS_HANDLING` 在 `phase === "statusWindow"` 时永远合法，确保放弃处理时状态伤害正常结算。
4. **实验反击窗口安全**：`experimentCounterattackWindow` 仅在当前 Engine 判定存在合法选项（如 `recover` 或 `acid-base-pursuit`）时开启，且处理后立即恢复原响应链路。
5. **金属反击休眠安全**：
   - 当前 `metal-counterattack` 在 `experimentCounterattack.ts` 执行器中直接返回原状态（未实现）；
   - 当前 68 张实体卡池中无金属单质卡牌，`legalMetalCardInstanceIds` 恒为空；
   - 契约冻结：**NATBA 严禁生成 `metal-counterattack`**。在未来 Phase 18G/金属规则正式落地前，该风险保持休眠。

---

## 15. 已知引擎技术债与健壮性差距（Known Engine Gaps）

以下内容列入引擎已知技术债清单（Known Engine Robustness Debt），不阻断 Phase 19A，但在后续必须审慎对待：

### 15.1 实验室老师发牌退化 Gap（Setup Fallback Gap）
- **现象**：在 `src/game/engine/turnFlow.ts` 的 `dealCycleStartHands` 中，若因牌堆+弃牌堆总牌数不足导致发牌后 `candidateCardInstanceIds.length !== 20`，代码将直接把 `phase` 置为 `"setup"`，且未设置 `pendingLaboratoryPreparation`。
- **影响**：进入 `"setup"` 阶段后，当前状态机没有定义玩家动作可以继续推进游戏。
- **定位**：在标准 68 张卡牌双人对战中，正常循环极难触发该极限状态。
- **处理契约**：本问题不属于 Phase 19A 的即时阻断项，**严禁在 Phase 19A 中擅自修改发牌规则**。若在 Phase 19C 的海量 Headless 自对弈中实际触发了该状态，则在单独的修复 PR 中冻结恢复语义并修复。

---

## 16. NATBA-0 核心契约与验收标准（NATBA-0 Contract）

### 16.1 NATBA-0 角色与定位

- **角色定位**：**Random Legal Bot（随机合法决策机器人）**。
- **目标价值**：
  - 验证 Engine 规则合法性接口与状态机转换契约；
  - 在全状态机路径下作为死锁探测器；
  - 验证确定性仿真与种子重放能力；
  - 作为未来 NATBA-1 等高阶策略的胜率对比基线。
- **策略逻辑**：
  - 在有限行动决策空间中：以确定性受控随机源从合法 Action 列表中选择一个；
  - 在结构化备课空间中：以确定性受控随机源从 20 张候选中选择满足 `keepCount === 10` 的一组卡牌。
  - **不冻结复杂启发式**：不强制要求 NATBA-0 “绝不 PASS” 或进行贪心选择，保持其作为纯随机合法 Bot 的测试基线纯洁性。

### 16.2 功能性验收标准（Functional Acceptance Gates）

NATBA-0 必须满足以下全部功能性标准，方可通过验收：

1. **零非法动作生成**：在任何状态下生成的动作，100% 能够被权威 Engine 接受，绝不产生被 Reducer 拒绝的原样返回；
2. **零信息泄露**：策略逻辑完全基于受限的 `AIObservation`，不触碰对手手牌与未来牌堆顺序；
3. **全时点决策覆盖**：能正确完成 `preparationSelection`、`mainAction`、`responseWindow`、`statusWindow` 与 `experimentCounterattackWindow` 的全部决策；
4. **DIY 正确性**：主动 DIY 决策 100% 使用 `PLAY_DIY_SELECTION`，绝不生成 `START_ACTIVE_DIY`；
5. **死锁免疫**：在正常可达的游戏状态下，AI 不进入死循环或死锁状态；
6. **确定性重现**：固定随机种子（Seed）下，AI vs AI 整局对战的每一步状态转移与日志完全可重放；
7. **完整自对弈闭环**：能够独立完成端到端的 AI vs AI 完整对局，直至产生明确胜者或平局；
8. **批量统计输出**：批量自对弈（Batch Self-play）能够稳定输出结构化的工程与平衡性统计指标。

*注：本冻结文档不包含未经基准测试的推测性毫秒级耗时指标（如 <0.1ms 或 1000局 <10s 等），性能预算指标应在代码实现并实测后制定。*

---

## 17. 自对弈数据与工程指标契约（Self-Play / Telemetry Contract）

### 17.1 本地工程指标收集项

在无头批量自对弈中，框架至少应支持统计以下结构化工程与平衡性数据：

- **对局概况**：总对局数、胜/负/平局数量及分布；
- **先后手分析**：先手胜率、后手胜率、先手优势偏差；
- **角色分析**：各角色的出场率、胜率、角色间对抗矩阵（Matchup Matrix）；
- **对局长度**：平均周期数（Cycles）、平均轮次数（Rounds）、平均动作数（Actions）；
- **动作频次**：各类型卡牌出牌率、主动 DIY 使用率、角色技能发动频次；
- **响应与状态**：响应窗口触发率与通过率、状态处理选择偏好；
- **异常事件**：非法动作尝试拦截计数（应恒为 0）、死锁告警计数（应恒为 0）。

### 17.2 零网络依赖声明

上述数据纯粹为本地测试与平衡性分析产物，**严禁引入任何向外部服务器上传数据的网络遥测逻辑**。所有指标收集与分析必须在本地内存及本地测试断言中完成。

---

## 18. 推荐实施路线图（Phase 19 Roadmap）

Phase 19 推荐按照以下清晰解耦的小步 PR 路线推进：

```
+---------------------------------------------------------------+
| Phase 19-0: NATBA Foundation Audit                            |
| 现状梳理、架构探索与差距审计                                   |
| 状态: COMPLETED                                               |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
| Phase 19 Freeze: NATBA Foundation Freeze (当前阶段)            |
| 架构纠偏、决策上下文、公平观测、确定性契约与演进路线冻结          |
| 状态: CURRENT                                                 |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
| Phase 19A: Decision Context & Authoritative Rule Layer        |
| 落地 DecisionContext 类型与决策生成器                           |
| 落地角色技能只读合法性判定接口                                  |
| 落地公平 AIObservation 投影契约                                |
| 排除 START_ACTIVE_DIY                                         |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
| Phase 19B: Deterministic Simulation Infrastructure            |
| 落地 Reducer/Engine 的 PRNG 与洗牌依赖注入                     |
| 建立 Headless 确定性可重现仿真执行器与死锁熔断器                 |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
| Phase 19C: NATBA-0 Random Legal Bot                           |
| 落地 Random Policy 实现                                       |
| 支持 Finite Action 与 Structured Preparation 决策             |
| 建立批量 AI vs AI 测试与统计分析验证                           |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
| Phase 19D: Solo vs AI Session Integration                     |
| 接入前端/本地游戏会话，支持人机对战（Human vs NATBA）           |
| 维护公平性边界，保障非阻塞的异步出牌与视觉反馈                   |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
| Phase 19E: NATBA-1 Heuristic Tactician                        |
| 落地局面评估函数与可解释的启发式策略                             |
| 实现基于战术权重的出牌偏好，与 NATBA-0 对弈验证胜率提升          |
+-------------------------------+-------------------------------+
```

---

## 19. 明确未完成与非目标声明（Non-Goals）

为严格防范范围蔓延，本 Freeze 文档明确声明以下内容**不属于当前授权范围**：

- **禁止编写 AI 决策逻辑实现代码**；
- **禁止修改任何 `src/` 源码、测试或配置文件**；
- **禁止修改前端 UI 或 Phase 18E 的任何代码**；
- **禁止引入新的化学规则或修改现有 8 个 DIY 配方**；
- **禁止引入金属卡牌、金属置换或启用金属反击**；
- **禁止引入沉淀生成（Precipitation）或方程式自动配平算法**；
- **禁止引入多人联机、网络对战或云端 AI 推理**；
- **禁止引入神经网络、深度学习或强化学习运行时**；
- **禁止调整卡牌数值、卡池构成或角色技能数值**。

---

## 20. 术语与语言规范（Freeze Language Standards）

为确保后续工程实现语义严密，本文档明确使用以下分类标识：

- **`[FROZEN]`（已冻结）**：已达成正式架构或产品决策，后续 PR 必须严格遵守，不得擅自修改。
- **`[KNOWN CURRENT STATE]`（当前已知现状）**：当前代码库中的实际运行现状记录。
- **`[KNOWN GAP]`（已知差距）**：当前引擎存在的不足，已在路线图中规划修复。
- **`[DEFERRED]`（延期处理）**：明确留待未来独立阶段处理的特性。
- **`[SUGGESTED API]`（建议 API）**：供实现阶段参考的函数签名或结构，具体实现时允许依据工程细节微调，非强制冻结名称。
- **`[NON-GOAL]`（非目标）**：明确禁止在当前阶段实现的范围。

---

## 21. Phase 19A 入场准入准则（Acceptance Gate for Phase 19A）

在启动 Phase 19A 代码实现 PR 之前，必须逐项核对满足以下准入条件：

- [x] **唯一权威依据**：本 Freeze 文档已作为 Phase 19 的唯一权威基础合并入 `main` 分支；
- [x] **规则不被重新解释**：Phase 19A 仅封装与暴露规则查询，不擅自修改任何既有游戏规则；
- [x] **决策空间二元划分已确定**：明确区分有限行动枚举与结构化备课决策，不全量枚举 $C(20, 10)$；
- [x] **公平观测模型已确立**：明确策略不可读取对手手牌与未来牌堆，仅消费 `AIObservation`；
- [x] **Reducer 合法性边界已明确**：不把 `nextState !== state` 作为合法性判定依据；
- [x] **确定性限制已明晰**：知晓当前洗牌存在未注入的 RNG 依赖，19A 不做超出能力的确定性假设；
- [x] **排除旧动作入口**：明确排除 `START_ACTIVE_DIY`，仅支持 `PLAY_DIY_SELECTION`；
- [x] **独立于 Phase 18E**：Phase 18E（UI PR）保持独立状态，不构成 Phase 19A 的引擎依赖；
- [x] **零规则猜测原则**：若在开发中遇到任何未覆盖的规则歧义，必须立即停止并报告，严禁凭借常识自行推测。
