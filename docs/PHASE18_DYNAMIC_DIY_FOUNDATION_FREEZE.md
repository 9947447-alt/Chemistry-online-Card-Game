# Phase 18 — Dynamic DIY Foundation 架构与产品行为冻结

本文档为 Reaction Field Phase 18「Dynamic DIY Foundation（动态 DIY 基础）」的权威架构与产品行为冻结合同。本文档确立了从“配方优先（recipe-first）”向“选牌驱动（selection-driven）+ 规则解析（rule-resolved）”迁移的全部技术契约、分层架构、交互边界、数据定义与验收原则。

除本文明确覆盖的边界外，`docs/MVP0_RULE_FREEZE.md`、`docs/PHASE8_CHARACTER_RULE_FREEZE.md`、`docs/PHASE9_DEBUG_UI_RULE_FREEZE.md`、`docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md` 与 `docs/PHASE16_BILINGUAL_GAME_LOG_FREEZE.md` 继续有效；既有规则冻结不因本阶段被改写。

---

## 0. 当前发布与分支基线

- **仓库标识**：`9947447-alt/reaction-field`
- **Canonical Trunk**：`main`
- **基线提交 SHA**：`be0ee8e91c946e9b98645e46a2a46b851f2df7f1`
- **当前实体卡池总数**：68 张（严格冻结，不可更改）
- **当前活跃主动 DIY 配方数**：8 个（严格冻结，行为完全等价）
- **真实单质金属卡池**：ABSENT（缺失，当前不引入）
- **响应 DIY（Response DIY）**：DISABLED（已关闭，当前不开放）
- **性质**：纯文档架构与产品行为冻结，不包含生产代码、测试代码、依赖配置或规则执行变更。

---

## 1. 产品目标与 Dynamic DIY 核心定义

### 1.1 迁移目标

将 Reaction Field 当前的“配方优先（recipe-first）DIY”模式：
$$\text{选择配方列表} \longrightarrow \text{按 recipe slots 选择具体组件} \longrightarrow \text{点击执行}$$

逐步迁移为符合实体卡牌直觉的“选牌驱动（selection-driven）DIY”模式：
$$\text{直接选择手牌 CardInstance} \longrightarrow \text{实时解析所选材料组合} \longrightarrow \text{展示唯一合法结果 preview} \longrightarrow \text{点击统一“出牌”按钮} \longrightarrow \text{正式执行效果}$$

### 1.2 Dynamic DIY 的核心含义

Dynamic DIY 在本阶段的严格定义为：**selection-driven + rule-resolved DIY（由手牌选择驱动、经由权威游戏规则解析的 DIY）**。

其明确边界如下：
1. **不等于 AI 自动操作**：系统不会通过启发式或自动化脚本替玩家进行出牌。
2. **不等于自动替玩家选牌**：玩家必须自主决定并点击选中手牌中的具体卡牌实例。
3. **不等于自动替玩家确认**：选中材料后仅产生只读预览，必须经由玩家显式点击统一“出牌”按钮才会触发结算。
4. **不等于任意化学组合均合法**：化学上能够配平或存在的物质，绝不自动成为 Reaction Field 当前合法可执行的 DIY。合法性完全由游戏规则解析器决定。

---

## 2. 架构分层体系：化学知识与游戏规则严格隔离

为杜绝化学知识污染游戏状态机、以及游戏规则反向硬编码化学特例的问题，建立严格的四层单向依赖架构：

```
+-------------------------------------------------------------------+
| LAYER 1: Chemistry Knowledge                                      |
| (元素符号 / 原子团 / 常见化合价 / 显式离子电荷 / 化学式表示 / 配平辅助) |
+---------------------------------+---------------------------------+
                                  | 引用知识
                                  v
+-------------------------------------------------------------------+
| LAYER 2: Card <-> Chemistry Adapter                               |
| (CardDefinition / CardInstance 映射到 Chemical Species 身份)        |
+---------------------------------+---------------------------------+
                                  | 识别物质/离子
                                  v
+-------------------------------------------------------------------+
| LAYER 3: Reaction Field DIY Rule Resolver                         |
| (判断所选材料组合是否合法 / 唯一结果 / 是否需要目标 / 对应游戏效果)  |
+---------------------------------+---------------------------------+
                                  | 产出结算指示
                                  v
+-------------------------------------------------------------------+
| LAYER 4: Game Effect Executor                                     |
| (弃牌 / DamageContext / 状态 / 响应窗口 / usedDIYThisCycle / 日志)  |
+-------------------------------------------------------------------+
```

### Layer 1: Chemistry Knowledge（纯化学知识层）
- **职责**：管理元素符号、原子团、用户确认的初中常见化合价表、显式离子电荷、标准化学式字符串生成与最简整数比计算。
- **禁止事项**：绝不包含任何 Reaction Field 游戏概念（伤害点数、生命值、牌区、时点合法性、状态、回合推进等）。

### Layer 2: Card $\leftrightarrow$ Chemistry Adapter（卡牌与化学适配层）
- **职责**：建立实体卡牌定义（`CardDefinitionId`）与具体化学物种（`Chemical Species`）之间的双向映射。
  - 例：`ion_na` $\rightarrow \text{Na}^+$
  - 例：`ion_oh` $\rightarrow \text{OH}^-$
  - 例：`ion_ca` $\rightarrow \text{Ca}^{2+}$
  - 例：`element_c` $\rightarrow \text{C}$
- **禁止事项**：不得决定 DIY 组合在游戏中的合法性，不得包含动作派发或结算逻辑。

### Layer 3: RF DIY Rule Resolver（游戏规则解析层）
- **职责**：根据当前已冻结的 Reaction Field 游戏规则，纯函数解析玩家所选的化学物种/卡牌组合：
  - 判断当前组合是否合法；
  - 解析唯一匹配的游戏结果（或返回无匹配）；
  - 指示是否需要选择目标玩家；
  - 确定对应的游戏伤害类型与数值。
- **禁止事项**：不得仅因“化学式能配平”就判定合法；必须严格受限于已冻结的游戏规则配方白名单。

### Layer 4: Game Effect Executor（游戏效果执行层）
- **职责**：在正式游戏 Action 派发后，执行状态变更：
  - 从手牌移动组件卡牌至弃牌堆（`discardComponents`）；
  - 构建 `DamageContext` 并开启 `responseWindow`，或施加状态、移除 `FIRE`；
  - 标记 `usedDIYThisCycle: true`；
  - 推进回合或轮次（`advanceTurnFromReducer`）；
  - 记录双语结构化日志。
- **禁止事项**：不得在执行层自行推导或硬编码化学知识，必须消费 Layer 3 的解析结果。

---

## 3. 初中化学人工确认知识库（Junior Chemistry Data）

以下数据来自用户明确指定的初中化学常见化合价与常见原子团，作为 Phase 18 第一批人工确认的 Layer 1 权威化学知识库：

### 3.1 元素及常见化合价（Elements and Common Valences）

| 元素符号 | 英文名称 | 中文名称 | 常见化合价（Common Valences） |
| :--- | :--- | :--- | :--- |
| **H** | Hydrogen | 氢 | `+1` |
| **Na** | Sodium | 钠 | `+1` |
| **K** | Potassium | 钾 | `+1` |
| **Cu** | Copper | 铜 | `+1, +2` |
| **Ag** | Silver | 银 | `+1` |
| **Mg** | Magnesium | 镁 | `+2` |
| **Ca** | Calcium | 钙 | `+2` |
| **Ba** | Barium | 钡 | `+2` |
| **Zn** | Zinc | 锌 | `+2` |
| **Al** | Aluminium | 铝 | `+3` |
| **Mn** | Manganese | 锰 | `+2, +4, +6, +7` |
| **Fe** | Iron | 铁 | `+2, +3` |
| **F** | Fluorine | 氟 | `-1` |
| **Cl** | Chlorine | 氯 | `-1, +1, +5, +7` |
| **Br** | Bromine | 溴 | `-1` |
| **O** | Oxygen | 氧 | `-2` |
| **S** | Sulfur | 硫 | `-2, +4, +6` |
| **N** | Nitrogen | 氮 | `-3, +2, +3, +4, +5` |
| **P** | Phosphorus | 磷 | `-3, +3, +5` |
| **C** | Carbon | 碳 | `+2, +4` |
| **Si** | Silicon | 硅 | `+4` |

### 3.2 常见原子团及化合价（Common Radicals）

| 原子团化学式 | 中文名称 | 英文名称 | 整体化合价 / 电荷 |
| :--- | :--- | :--- | :--- |
| **OH** | 氢氧根 | Hydroxide | `-1` |
| **NO3** | 硝酸根 | Nitrate | `-1` |
| **CO3** | 碳酸根 | Carbonate | `-2` |
| **SO4** | 硫酸根 | Sulfate | `-2` |
| **NH4** | 铵根 | Ammonium | `+1` |

---

## 4. 化合价与具体离子电荷严格区分（Valence vs Charge）

在化学数据模型与运行时设计中，必须严格区分“元素常见化合价知识”与“具体自由离子带电量”：

1. **化合价不可直接推断为离子电荷**：
   - 严禁将 `common valence` 自动等同于自由离子的 `charge`。
   - 例：铁（Fe）的常见化合价包含 `+2` 与 `+3`，系统绝不得在通用引擎中盲目竞猜当前代表 $\text{Fe}^{2+}$ 还是 $\text{Fe}^{3+}$；必须由具体的卡牌物种定义或显式上下文明确指定。
2. **多价态非金属的卡牌物种单义性**：
   - 氯（Cl）的化合价包含 `-1, +1, +5, +7`；但在当前卡池中，`ion_cl` 实体卡牌仅代表氯离子（$\text{Cl}^-$，电荷 `-1`）。
   - 引擎绝不可因为常见化合价表中存在 `+1, +5, +7` 而在运行时将 `ion_cl` 动态篡改为 $\text{Cl}^+$、$\text{Cl}^{5+}$ 或 $\text{Cl}^{7+}$。
3. **数据模型表达**：
   - 数据结构中必须将“元素的化学属性（`ElementKnowledge`）”与“具体的带电离子物种（`IonSpecies`）”分为两个独立类型，禁止混淆。

---

## 5. 化学知识不等于卡牌入池（Card Pool Invariant）

特别冻结以下不变量：
- **知识库存在 $\neq$ 卡池存在**：Layer 1 中包含 $\text{Mg, Zn, Al, Fe, Cu, Ag, Ba, Mn}$ 等元素知识，**绝不代表初始牌堆或卡池中新增了对应金属实体卡**。
- **68 张实体卡池绝对不变**：Phase 18 Foundation 阶段不得修改当前 68 张实体卡牌池。
- **真实单质金属卡状态**：继续维持为 **ABSENT**（缺失），直到未来独立的金属规则与卡池冻结文档落地。

---

## 6. 化学式合成与配平边界（Formula Composition Boundary）

未来 Chemistry Core 可以支持基于显式化合价/离子电荷的化合物化学式生成与最简整数比计算：

- $\text{Na}^+ + \text{Cl}^- \longrightarrow \text{NaCl}$
- $\text{Ca}^{2+} + 2\text{Cl}^- \longrightarrow \text{CaCl}_2$
- $\text{Ca}^{2+} + 2\text{OH}^- \longrightarrow \text{Ca(OH)}_2$
- $2\text{NH}_4^+ + \text{CO}_3^{2-} \longrightarrow \text{(NH}_4)_2\text{CO}_3$
- $2\text{Al}^{3+} + 3\text{SO}_4^{2-} \longrightarrow \text{Al}_2(\text{SO}_4)_3$

### 边界约束：
1. **合成能力 $\neq$ 游戏合法 DIY**：上述化学式合成能力仅作为 Chemistry Core 的底层化学算法能力。未经 Reaction Field 游戏规则显式冻结的物质（如 $\text{(NH}_4)_2\text{CO}_3$、$\text{Al}_2(\text{SO}_4)_3$），**只能存在于 Chemistry Core 的单元测试/示例中，严禁进入可玩 DIY 配方**。
2. **多价元素禁止自动猜测**：对于具有多种化合价的元素（如 $\text{Fe, Cu, Mn, S, N, Cl, C}$），Formula Composer 严禁在缺失上下文时猜测化合价，调用方必须提供显式指定的物种或价态。

---

## 7. DIY 选牌上下文与 UI 交互合同（DIY Selection Context）

为彻底避免手牌普通出牌（如普通打出关联基准牌、打出主行动物质牌）与 DIY 选材点击之间的语义冲突，冻结统一的 **DIY Selection Context**。

### 7.1 进入与退出合同
- **进入 Context**：玩家通过 Preview / Debug UI 上的显式入口（如“进入 DIY 模式 / Active DIY”）进入选牌状态。
  - 进入操作**不消耗行动点**、**不修改 GameState**、**不算使用 DIY**。
- **退出或取消 Context**：玩家可随时取消或退出 DIY 模式。
  - 退出操作**立即清空 UI 本地选牌状态**，**不产生任何 GameState 副作用**。

### 7.2 候选资格与选择规则
- **候选白名单**：仅允许当前手牌中具备 DIY 组件资格（`allowedTimings.includes("diy-component")`）的实体卡牌实例被加入选牌集合。
- **非组件阻断**：普通非 DIY 组件卡牌（如无组件时点的物质牌、事件卡等）严禁被误选为 DIY 输入。
- **基于 CardInstanceId 的唯一性**：
  - 选牌状态以 `CardInstanceId` 为唯一标识。
  - 玩家手牌中若有 2 张相同的 `ion_h` 实体卡，它们具有不同的 `CardInstanceId`，玩家必须且能够独立选择其中任意一张或两张。
- **选择与反选行为**：
  - 点击未选中的候选卡 $\rightarrow$ 标记为 `selected`；
  - 再次点击已选中的卡 $\rightarrow$ 取消选中（`deselected`）；
  - 手牌的原本排列顺序**绝对不得因选择状态而改变**。

---

## 8. 预览与调试呈现合同（Preview & Debug UI Contract）

### 8.1 预览纯函数调用契约
每当 `selectedCardInstanceIds` 发生变化时，UI 必须调用 Layer 3 提供的纯函数解析器 `previewDIYSelection`：

```ts
export type DIYPreviewResult =
  | {
      status: "NO_MATCH";
      reason?: string;
    }
  | {
      status: "UNIQUE_MATCH";
      recipeId: string;
      displayName: string;
      requiresTarget: boolean;
      damageKind?: "acid" | "base";
      damageAmount?: number;
      resultKind: "CO2_REMOVE_OWN_FIRE" | "H2O_REMOVE_OWN_FIRE" | "SO2_APPLY_LEAK" | "VIRTUAL_ATTACK";
    };
```

*注：Phase 18 V1 仅正式支持 `NO_MATCH` 与 `UNIQUE_MATCH` 两种判别联合分支。不提前引入复杂的多歧义匹配 UI。*

### 8.2 预览状态与按钮行为
1. **当 `status === "NO_MATCH"` 时**：
   - 统一“出牌 / 执行 DIY”按钮保持 **disabled**（禁用）；
   - UI 展示温和的状态说明（如“当前组合暂无可执行 DIY”）；
   - 严禁弹出侵入式的 alert、modal 错误窗口。
2. **当 `status === "UNIQUE_MATCH"` 时**：
   - 预览区域显示解析出的效果（例：“执行效果：稀 NaOH，对目标造成 1 点碱性伤害”）；
   - 若该配方需要目标（`requiresTarget: true`），提示并允许选择合法目标对手；
   - 在满足目标与周期使用限制的前提下，启用“出牌 / 执行 DIY”按钮。
3. **只读性**：预览结果纯粹为只读描述，**绝对不是 GameAction 的执行**。

### 8.3 视觉呈现合同与未来效果边界
- **当前 Preview / Debug presentation**：
  - 仅要求具备明确、可自动化测试、可无障碍访问（a11y）的选中状态表现。
  - 允许使用：高亮边框（border）、背景高亮（highlight）、选中勾选标记（selected indicator）或简单的位置微调（simple positional offset）。
  - **严禁将“斗地主式卡牌上浮流畅动画”作为 Phase 18 当前验收门槛**。
- **未来正式前端视觉映射**：
  - 未来的正式精美前端可以将同一个 `selected` 状态渲染为“卡牌脱离手牌行向上浮起（visually rises above hand row）”的视觉效果。
  - 该视觉效果属于纯前端展示糖，**绝对不得反向污染引擎协议或 GameState 数据结构**。

---

## 9. 权威 Resolver 与执行边界（Authoritative Resolver & Execution Boundary）

### 9.1 执行触发点
只有当玩家显式点击“出牌 / 执行”按钮时，UI 才允许向引擎 dispatch 正式游戏 Action（如 `START_ACTIVE_DIY` 或 `PLAY_DIY_SELECTION`）。

正式 Action 必须包含足够的重新验证上下文：
- `playerId`: 发起玩家 ID；
- `componentCardInstanceIds`: 玩家选中的具体卡牌实例 ID 列表；
- `targetPlayerId`: 选定的目标玩家 ID（若配方需要）。

### 9.2 引擎端强制重新验证（Anti-Tampering & Stale Check）
- **绝不盲目信任 UI 预览**：Engine / Reducer 在接收到 Action 后，**必须调用同一个权威 Rule Resolver 重新完整校验当前所选手牌实例的合法性**。
- **重新验证内容**：
  1. 当前玩家是否处于 `mainAction` 时点且为 `activePlayer`；
  2. 当前玩家本周期是否已使用过主动 DIY（`usedDIYThisCycle === false`）；
  3. `componentCardInstanceIds` 是否全都在该玩家当前手牌中，且无重复 ID；
  4. 每张卡牌是否具备 `diy-component` 时点；
  5. 组合解析出的配方与前置条件（如 `FIRE` 状态）是否完全满足；
  6. 目标玩家是否存在、存活且非自身（若需要目标）。
- **拒绝行为**：若执行时校验失败（例如手牌已在并发或异常状态下失效），引擎必须**拒绝执行 Action，保持原 GameState 完全不变**，不得产生任何部分状态修改或脏数据。

---

## 10. 单一真值源保障（Single Source of Truth）

冻结以下架构红线：
- **严禁双重规则实现**：代码库中绝对不得同时存在“UI 独立编写的配方匹配逻辑”与“Engine 独立编写的配方匹配逻辑”。
- **同源解析**：UI 预览纯函数与 Engine 校验逻辑必须直接调用同一个底层的权威 Resolver（`resolveDIYSelection`）。
- **允许展示适配**：UI 层可以编写将 Resolver 输出格式化为本地多语言文本的 presentation mapper，但**规则合法性（legality）的唯一真值源必须且只能有一个**。

---

## 11. 现有 8 个 DIY 配方 100% 等价性冻结（Existing 8 DIY Equivalence）

在向 Dynamic DIY 迁移过程中，MVP 0 与 Phase 10 已实现的 8 个主动 DIY 配方必须保持 **100% 游戏性与结算等价**：

| # | 配方名称 / 方程式 | 所需组件（Cards & Counts） | 目标要求 | 游戏结算结果（Outcome） |
| :--- | :--- | :--- | :--- | :--- |
| 1 | $\text{C} + \text{O} + \text{O} \longrightarrow \text{CO}_2$ | `element_c` $\times 1$, `element_o` $\times 2$ | 无目标 | `CO2_REMOVE_OWN_FIRE`（需自身有 `FIRE`，移除自身 `FIRE`） |
| 2 | $\text{H}^+ + \text{OH}^- \longrightarrow \text{H}_2\text{O}$ | `ion_h` $\times 1$, `ion_oh` $\times 1$ | 无目标 | `H2O_REMOVE_OWN_FIRE`（需自身有 `FIRE`，移除自身 `FIRE`） |
| 3 | $\text{H}^+ + \text{Cl}^- \longrightarrow \text{稀 HCl}$ | `ion_h` $\times 1$, `ion_cl` $\times 1$ | 需对手目标 | `VIRTUAL_ATTACK`（造成 1 点 `acid` 伤害，开启响应窗口） |
| 4 | $2\text{H}^+ + \text{SO}_4^{2-} \longrightarrow \text{稀 H}_2\text{SO}_4$ | `ion_h` $\times 2$, `ion_so4` $\times 1$ | 需对手目标 | `VIRTUAL_ATTACK`（造成 1 点 `acid` 伤害，开启响应窗口） |
| 5 | $\text{Na}^+ + \text{OH}^- \longrightarrow \text{稀 NaOH}$ | `ion_na` $\times 1$, `ion_oh` $\times 1$ | 需对手目标 | `VIRTUAL_ATTACK`（造成 1 点 `base` 伤害，开启响应窗口） |
| 6 | $\text{K}^+ + \text{OH}^- \longrightarrow \text{稀 KOH}$ | `ion_k` $\times 1$, `ion_oh` $\times 1$ | 需对手目标 | `VIRTUAL_ATTACK`（造成 1 点 `base` 伤害，开启响应窗口） |
| 7 | $\text{Ca}^{2+} + 2\text{OH}^- \longrightarrow \text{石灰水 Ca(OH)}_2$ | `ion_ca` $\times 1$, `ion_oh` $\times 2$ | 需对手目标 | `VIRTUAL_ATTACK`（造成 1 点 `base` 伤害，开启响应窗口） |
| 8 | $\text{S} + \text{O} + \text{O} \longrightarrow \text{SO}_2$ | `element_s` $\times 1$, `element_o` $\times 2$ | 需对手目标 | `SO2_APPLY_LEAK`（对目标施加 `SO2_LEAK` 状态） |

> **核心原则**：Dynamic DIY 的第一阶段是**“动态匹配玩家自由选择的手牌组件”**，而**不是“动态发明未经规则冻结的新化学反应”**。

---

## 12. 现有游戏结算行为与规则不变量

在 Dynamic DIY 迁移与执行期间，下列既有规则不变量必须保持绝对不变，严禁顺手修改：

1. **时点与权限**：仅存活的 `activePlayer` 在 `phase === "mainAction"` 时可用。
2. **周期频次限制**：每名玩家每个实验周期最多使用 1 次主动 DIY（受 `usedDIYThisCycle` 严格约束）。
3. **灭火前置条件**：$\text{CO}_2$ 与 $\text{H}_2\text{O}$ 配方仅在玩家自身处于 `FIRE` 状态时合法可用；若无 `FIRE` 则必须判定为非法。
4. **组件销毁**：参与 DIY 的实体卡牌实例在结算时必须移入 `discardPile`，且不创建新的实体卡牌（不创建产物 `CardInstance`）。
5. **伤害与响应上下文**：虚拟酸碱攻击产生的 `DamageEffect` 继续携带 `source.kind === "diy"` 的强类型 `DamageContext`，正确触发对手的酸碱中和或碳酸盐响应。
6. **角色被动技能联动**：化学课代表的 DIY 被动技能（如适用）及相关结算保持原有语义。
7. **状态处理与清除**：$\text{SO}_2$ 施加 `SO2_LEAK` 状态；灭火配方正确清除 `FIRE`。
8. **结构化双语日志**：按照 `docs/PHASE16_BILINGUAL_GAME_LOG_FREEZE.md` 的规范，正确记录 `diy_co2_remove_fire`、`diy_h2o_remove_fire`、`diy_virtual_attack`、`diy_so2_apply_leak` 及成功反应事件。
9. **回合推进**：无响应窗口的主动 DIY 成功后正常推进回合；带攻击响应窗口的 DIY 待响应结算后推进。

---

## 13. 金属规则与金属卡牌延期范围（Metals Scope & Deferral）

1. **知识与玩法的隔离**：Layer 1 中允许包含金属元素（如 $\text{Fe, Cu, Al, Zn, Mg, Ag, Ba}$）的基础化学属性。
2. **玩法完全延期**：所有金属相关的卡牌与玩法**一律不进入当前 Phase 18 Foundation 的实现范围**。
3. **未来独立冻结项**：
   - 哪些金属元素制作成实体卡牌及其数量分布；
   - 是否扩充或重新平衡 68 张普通实体卡池；
   - 金属活动性顺序表（Activity Series）的实现；
   - 金属与酸反应（生成氢气/伤害/状态）；
   - 金属与盐溶液置换反应；
   - 变价金属的氧化还原行为；
   - 实验反击中化学课代表“金属反击”选项的正式启用。
4. **禁止推测实现**：严禁凭通用现实化学经验提前在代码库中实现任何未经规则冻结的金属玩法。

---

## 14. 禁止过早引入未冻结抽象（No Premature Abstractions）

为了保持代码库的精简与高内聚，在 Phase 18 中**禁止**提前引入以下未冻结特性的运行时数据模型与抽象层：

- **沉淀生成与沉淀物管理（Precipitation）**；
- **Token 实体生成或任意临时卡牌创建**；
- **响应 DIY（Response DIY）**；
- **复杂反应方程式连锁链（Equation Chains）**；
- **通用的网状反应动力学图谱（General Reaction Networks）**。

当前 TypeScript 类型定义与接口仅覆盖当前已冻结的 8 个配方与初中化学基础模型。

---

## 15. 推荐实现路线图（Phase 18C ~ Phase 18H）

Reaction Field Phase 18 后续推荐按以下严格顺序分步演进：

```
+-------------------------------------------------------------+
| Phase 18B: Dynamic DIY Foundation Freeze (当前阶段)          |
| 架构与产品行为冻结，零代码变更                               |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Phase 18C: Junior Chemistry Data Foundation                 |
| 落地纯 Chemistry Knowledge (Layer 1) 数据模型与测试，零游戏变更|
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Phase 18D: Authoritative DIY Selection Resolver V1          |
| 实现基于手牌实例 ID 匹配现有 8 个 DIY 的核心解析器，保障 100% 等价|
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Phase 18E: Preview / Debug Hand-Selection UI                |
| 前端改造：手牌直接多选 -> 实时只读 Preview -> 统一出牌按钮   |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Phase 18F: Junior Chemistry Rule Expansion                  |
| 逐批由用户确认新反应规则：先单独 Freeze，再实现 Resolver 扩展  |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Phase 18G: Metal Card Pool & Metal Gameplay Freeze          |
| 独立冻结金属卡牌、金属置换与金属反击规则                     |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Phase 18H: Metal Dynamic DIY Integration                    |
| 正式接入金属卡牌与相关 Dynamic DIY 玩法                      |
+-------------------------------------------------------------+
```

*注：当前任务严禁实现 Phase 18C 及后续阶段的代码。*

---

## 16. 验收原则与测试合同（Acceptance Principles & Test Contracts）

后续代码实现阶段必须满足以下七大验收原则：

| 验收原则 | 合同要求 |
| :--- | :--- |
| **A. Selection Purity（选择纯粹性）** | 在手牌中选中或反选 `CardInstance` 纯属 UI 本地状态，绝不改变 `GameState`，不消耗卡牌，不记日志，不占使用次数。 |
| **B. Preview Purity（预览纯粹性）** | 组合解析与预览函数必须为无副作用的纯函数，不得派发 Action，不得修改游戏状态。 |
| **C. Execution Revalidation（执行重新验证）** | Engine 在执行“出牌”时，必须调用权威 Resolver 重新校验选中的组件实例，杜绝过期 UI 或伪造 Action。 |
| **D. Existing Equivalence（既有行为等价）** | 现有 8 个 DIY 配方的触发条件、目标、伤害、状态、日志和推进行为 100% 保持原有语义，无任何回归。 |
| **E. Card Instance Correctness（实例独立性）** | 相同定义的多张实体卡（如两张 `ion_h`）必须能被独立选中与区分。 |
| **F. No Duplicate Rules（单一真值源）** | UI 与 Engine 之间不存在两份独立的 DIY 合法性判定逻辑。 |
| **G. No Hidden Expansion（零隐式扩展）** | 引入初中化学知识库绝不自动导致可玩 DIY 配方或卡池偷偷扩充。 |

---

## 17. 文档权威性与裁决层级（Document Authority Precedence）

明确废止历史 AI 生成规则文档的权威性：
- `docs/rules/core-rules-v0.1.docx` 与 `docs/rules/ion-reaction-and-diy-manual-v1.0.docx` 从 Phase 18 起仅作为**非权威的历史概念参考资料（historical conceptual references only）**，不再作为 Reaction Field 的化学与游戏规则真值源。

从 Phase 18 起，规则与架构解释权遵循以下绝对裁决层级：
1. **用户明确批准的 Phase 18 设计决策与裁定**；
2. **`docs/PHASE18_DYNAMIC_DIY_FOUNDATION_FREEZE.md`（本文档）**；
3. **适用的既有规则冻结文档（`docs/MVP0_RULE_FREEZE.md`、`docs/PHASE8_CHARACTER_RULE_FREEZE.md`、`docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`、`docs/PHASE16_BILINGUAL_GAME_LOG_FREEZE.md`）**；
4. **代码库中已实现且未被上述文档覆盖的既有正确行为**；
5. **历史 AI 生成规则手册（仅供非约束性灵感参考，严禁自动导入未批准规则）**。

---

## 18. 明确未完成与非目标声明（Non-Goals & Unfinished Boundaries）

为防范任何误解与过度承诺，在此明确声明：
- **单质金属卡牌未入池，金属反应未实现**；
- **初中化学完整反应网络未实现（当前仅冻结知识库与 8 个既有配方）**；
- **响应 DIY（Response DIY）继续保持关闭**；
- **斗地主式手牌上升精美动画属于未来前端美化，当前仅冻结可测试的 debug 选中状态**；
- **Phase 18 游戏玩法与代码目前未发生任何变更，本阶段仅完成架构与行为冻结**。
