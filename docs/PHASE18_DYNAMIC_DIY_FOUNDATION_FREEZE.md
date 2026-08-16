# Phase 18 — Dynamic DIY Foundation 架构与产品行为冻结

本文档为 Reaction Field Phase 18「Dynamic DIY Foundation（动态 DIY 基础）」的权威架构与产品行为冻结合同。本文档确立了从“配方优先（recipe-first）”向“选牌驱动（selection-driven）+ 规则解析（rule-resolved）”迁移的全部技术契约、分层架构、交互边界、数据定义与验收原则。

除本文明确覆盖的边界外，所有适用的已合并权威冻结文档（包括但不限于 `docs/MVP0_RULE_FREEZE.md`、`docs/PHASE8_CHARACTER_RULE_FREEZE.md`、`docs/PHASE9_DEBUG_UI_RULE_FREEZE.md`、`docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`、`docs/PHASE13_NEW_PLAYER_GUIDANCE_FREEZE.md` 与 `docs/PHASE16_BILINGUAL_GAME_LOG_FREEZE.md` 等）继续有效；既有规则冻结不因本阶段被改写。

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
| (元素符号 / 原子团 / 常见化合价表 / 显式离子电荷 / 只读物种注册表)       |
+---------------------------------+---------------------------------+
                                  | 引用化学物种定义
                                  v
+-------------------------------------------------------------------+
| LAYER 2: Card -> Chemistry Mapping                                |
| (CardDefinitionId -> ChemicalSpeciesId? 单向声明与派生关联)        |
+---------------------------------+---------------------------------+
                                  | 识别组件卡牌
                                  v
+-------------------------------------------------------------------+
| LAYER 3: Reaction Field DIY Rule Resolver & Analysis              |
| (纯语义分析 / 规则白名单匹配 / 可执行性校验 / 纯数据输出)             |
+---------------------------------+---------------------------------+
                                  | 产出纯语义分析结果
                                  v
+-------------------------------------------------------------------+
| LAYER 4: Game Effect Executor & Presentation                      |
| (Executor 执行状态机变更 / Presentation Layer 独立负责双语展示)     |
+-------------------------------------------------------------------+
```

### Layer 1: Chemistry Knowledge（纯化学知识层）
- **职责**：管理元素符号、原子团、用户确认的初中常见化合价表、显式离子与原子团电荷、稳定的只读化学物种注册表（`ChemicalSpecies`）。
- **禁止事项**：绝不包含任何 Reaction Field 游戏概念（伤害数值、生命值、牌区、时点合法性、状态、回合推进、卡牌数量等）。不得在 Phase 18C 引入化学式合成算法或方程式自动配平器。

### Layer 2: Card $\rightarrow$ Chemistry Mapping（卡牌至化学映射层）
- **职责**：建立实体卡牌定义（`CardDefinitionId`）到化学物种（`ChemicalSpeciesId?`）的单向关联声明与只读派生。
- **映射关系边界（非严格双射）**：
  - 权威依赖方向为：`CardInstanceId` $\rightarrow$ `CardDefinitionId` $\rightarrow$ `ChemicalSpeciesId?`；
  - `CardInstance` 绝不重复保存 chemistry identity；
  - 允许某些 `CardDefinition` 无对应 `ChemicalSpecies`（如事件卡、未来概念卡）；
  - 允许某些 `ChemicalSpecies` 当前无对应实体卡牌（如金属物种）；
  - 允许未来多个不同 `CardDefinition` 指向同一个 `ChemicalSpecies`；
  - 反向查找（Reverse lookup）若未来需要，仅为可选的派生一对多映射，非权威身份来源。
- **禁止事项**：不得决定 DIY 组合在游戏中的合法性，不得覆盖或篡改 `CardDefinition` 的既有游戏字段。

### Layer 3: RF DIY Rule Resolver & Analysis（游戏规则解析与分析层）
- **职责**：根据当前已冻结的 Reaction Field 游戏规则，纯函数解析玩家所选的卡牌实例组合：
  - 区分非法选牌（`INVALID_SELECTION`）、配方无匹配（`NO_RECIPE_MATCH`）、配方匹配但当前不可执行（`MATCHED_NOT_EXECUTABLE`）以及完全可执行（`EXECUTABLE`）；
  - 输出强类型的纯语义数据结构（不包含任何面向玩家的展示字符串）；
  - 指示目标需求（`targetRequirement`）与强类型效果语义数据。
- **禁止事项**：不得仅因“化学式能配平”就判定合法；必须严格受限于已冻结的游戏规则配方白名单；不得返回展示文案。

### Layer 4: Game Effect Executor & Presentation（执行与展示层）
- **Effect Executor 职责**：在接收到正式游戏 Action 后，在权威 `GameState` 上重新调用 Layer 3 分析，仅在 `EXECUTABLE` 状态下执行状态变更（弃牌、`DamageContext`、状态处理、回合推进等）。
- **Presentation Layer 职责**：独立消费 Layer 3 的纯语义数据，结合当前语言环境（`zh-CN` / `en`）生成面向玩家的展示文本、预览描述、按钮禁用原因与调试信息。

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

## 4. 化合价、电荷与现有 CardDefinition 字段所有权

### 4.1 化合价与具体离子电荷严格区分（Valence vs Charge）
1. **化合价不可直接推断为自由离子电荷**：
   - 严禁将 `common valence` 自动等同于自由离子的 `charge`；
   - 例：铁（Fe）的常见化合价包含 `+2` 与 `+3`，系统绝不得在通用引擎中盲目竞猜当前代表 $\text{Fe}^{2+}$ 还是 $\text{Fe}^{3+}$；必须由具体的卡牌物种定义或显式上下文明确指定；
   - 氯（Cl）的常见化合价包含 `-1, +1, +5, +7`，但当前卡池中的 `ion_cl` 实体卡牌仅代表氯离子（$\text{Cl}^-$，电荷 `-1`），绝不能在运行时动态变为 $\text{Cl}^+$、$\text{Cl}^{5+}$ 或 $\text{Cl}^{7+}$。
2. **数据模型分离**：
   - 数据结构中必须将“元素的化学属性（`ElementKnowledge`）”与“具体的带电物种（`IonSpecies`）”分为两个独立类型，禁止混淆。

### 4.2 现有 CardDefinition 游戏字段所有权保护
当前代码库中：
- `CardDefinition.elements`
- `CardDefinition.ionsProvided`
- `CardDefinition.tags`
- `CardDefinition.allowedTimings`
- 伤害与反应相关元数据

已经深度参与现有游戏结算（例如 `ionsProvided` 参与硫酸厂厂长“硫酸盐副产”判定，`tags` 参与酸碱中和与状态处理）。

**重要不变量**：
- Phase 18C 新增 Layer 1 化学知识时，现有 `CardDefinition` 中的上述游戏字段继续作为**显式游戏规则声明（explicit gameplay declarations）**；
- **Phase 18C 严禁从 Chemistry Knowledge 自动覆盖或重新推导现有 `CardDefinition` 的游戏字段**；
- V1 Dynamic DIY 配方匹配继续以当前冻结的 `CardDefinitionId` 多重集白名单为准；
- 两个卡牌定义即使对应相同化学物种（`ChemicalSpecies`），**绝不代表其在现有 DIY 配方中自动可互换**；
- 任何将现有游戏元数据重构为“由化学数据自动派生”的工作，必须经由未来独立 Freeze 明确批准。

---

## 5. 化学知识不等于卡牌入池（Card Pool Invariant）

特别冻结以下不变量：
- **知识库存在 $\neq$ 卡池存在**：Layer 1 中包含 $\text{Mg, Zn, Al, Fe, Cu, Ag, Ba, Mn}$ 等元素知识，**绝不代表初始牌堆或卡池中新增了对应金属实体卡**。
- **68 张实体卡池绝对不变**：Phase 18 Foundation 阶段不得修改当前 68 张实体卡牌池。
- **真实单质金属卡状态**：继续维持为 **ABSENT**（缺失），直到未来独立的金属规则与卡池冻结文档落地。

---

## 6. 化学式合成与配平边界（Formula Composition Boundary）

- **Phase 18C 范围收窄**：通用的化学式合成器（Formula Composer）与方程式自动配平算法**不包含在 Phase 18C 的落地范围中**。
- **计算能力 $\neq$ 游戏合法 DIY**：未来若引入化学式合成算法，其合成能力仅作为 Chemistry Core 的底层辅助函数；未经 Reaction Field 游戏规则显式冻结的物质（如 $\text{(NH}_4)_2\text{CO}_3$、$\text{Al}_2(\text{SO}_4)_3$），只能存在于 Chemistry Core 的独立测试中，严禁自动进入可玩 DIY 配方。

---

## 7. DIY 选牌上下文与 UI 交互合同（DIY Selection Context）

为彻底避免手牌普通出牌（如普通打出关联基准牌、打出主行动物质牌）与 DIY 选材点击之间的语义冲突，冻结统一的 **DIY Selection Context**。

### 7.1 进入与退出合同
- **进入 Context**：玩家通过 UI 显式入口进入选牌状态。
  - 进入操作**不消耗行动点**、**不修改 GameState**、**不算使用 DIY**。
- **退出或取消 Context**：玩家可随时取消或退出 DIY 选牌模式。
  - 退出操作**立即清空 UI 本地选牌状态**，**不产生任何 GameState 副作用**。

### 7.2 候选资格与选择规则
- **候选白名单**：仅允许当前手牌中具备 DIY 组件资格（`allowedTimings.includes("diy-component")`）的实体卡牌实例被加入选牌集合。
- **非组件阻断**：普通非 DIY 组件卡牌（如无组件时点的物质牌、事件卡等）严禁被误选为 DIY 输入。
- **基于 CardInstanceId 的唯一性**：
  - 选牌状态以 `CardInstanceId` 为唯一标识；
  - 玩家手牌中若有 2 张相同的 `ion_h` 实体卡，它们具有不同的 `CardInstanceId`，玩家必须且能够独立选择其中任意一张或两张。
- **选择与反选行为**：
  - 点击未选中的候选卡 $\rightarrow$ 标记为 `selected`；
  - 再次点击已选中的卡 $\rightarrow$ 取消选中（`deselected`）；
  - 手牌的原本排列顺序**绝对不得因选择状态而改变**。

---

## 8. 权威 DIY 语义分析与纯数据预览契约（Authoritative DIY Analysis & Preview Contract）

### 8.1 核心概念严格区分：匹配（Match） vs 可执行性（Executability）
必须在类型系统与分析入口中严格区分以下四种互斥状态：

1. **`INVALID_SELECTION`（非法选择）**：所选 `CardInstanceId` 包含重复 ID、非玩家当前手牌、未知实例或不具备 `diy-component` 时点的卡牌。这是强类型的选择边界错误，**绝不能被掩盖为配方未匹配**。
2. **`NO_RECIPE_MATCH`（配方未匹配）**：所选手牌组件集合在合法的 DIY 配方白名单中无任何匹配。
3. **`MATCHED_NOT_EXECUTABLE`（匹配但不可执行）**：所选组件成功匹配到唯一合法配方，但受限于当前游戏状态机无法执行（例如：匹配到 $\text{CO}_2$ 配方但自身没有 `FIRE` 状态；或者当前周期已使用过主动 DIY；或者不是当前行动玩家；或者未提供必须的目标对手）。返回稳定的阻断原因码（`BlockerCode`）。
4. **`EXECUTABLE`（完全可执行）**：所选组件成功匹配唯一配方，且当前游戏状态机、前置条件、目标参数全部满足，允许执行出牌。

### 8.2 权威纯语义分析入口（Authoritative Pure Semantic Analysis）
冻结统一的纯函数语义分析接口：

```ts
export type DIYBlockerCode =
  | "NOT_ACTIVE_PLAYER"
  | "INVALID_PHASE"
  | "DIY_ALREADY_USED_THIS_CYCLE"
  | "OWN_FIRE_REQUIRED"
  | "TARGET_PLAYER_REQUIRED"
  | "TARGET_PLAYER_INVALID";

export type DIYSelectionAnalysis =
  | {
      status: "INVALID_SELECTION";
      invalidCardInstanceIds: readonly CardInstanceId[];
    }
  | {
      status: "NO_RECIPE_MATCH";
    }
  | {
      status: "MATCHED_NOT_EXECUTABLE";
      recipeId: string;
      blockerCode: DIYBlockerCode;
      targetRequirement: "NONE" | "OPPONENT_REQUIRED";
    }
  | {
      status: "EXECUTABLE";
      recipeId: string;
      targetRequirement: "NONE" | "OPPONENT_REQUIRED";
      outcome:
        | { kind: "CO2_REMOVE_OWN_FIRE" }
        | { kind: "H2O_REMOVE_OWN_FIRE" }
        | { kind: "SO2_APPLY_LEAK"; targetPlayerId: PlayerId }
        | {
            kind: "VIRTUAL_ATTACK";
            targetPlayerId: PlayerId;
            damageKind: "acid" | "base";
            damageAmount: number;
          };
    };

export function analyzeDIYSelection(
  state: GameState,
  playerId: PlayerId,
  componentCardInstanceIds: readonly CardInstanceId[],
  targetPlayerId?: PlayerId,
): DIYSelectionAnalysis;
```

### 8.3 纯语义输出与展示层解耦（No Human Strings in Layer 3）
- **禁止在 Layer 3 返回展示字符串**：`analyzeDIYSelection` 及其内部 helper **绝不返回 `displayName`、`reason`、`message` 等面向玩家的本地化文本**。
- **展示层映射**：所有中文/英文预览描述（如“执行效果：稀 NaOH”）、按钮提示与阻断提示文案，统一由现有 `presentationLocale` / UI 本地化渲染函数消费上述强类型字段生成，严格遵循 Phase 16 双语渲染架构。

### 8.4 UI 预览契约与按钮行为
1. **当 `status !== "EXECUTABLE"` 时**：
   - 统一“出牌 / 执行”按钮保持 **disabled**；
   - UI 展示对应的本地化提示（例如：未匹配时显示“当前组合暂无可执行 DIY”；匹配灭火配方但无火情时显示“需处于火情状态”；缺少目标时提示“请选择目标”）；
   - 严禁弹出侵入式的 alert / modal 错误窗口。
2. **当 `status === "EXECUTABLE"` 时**：
   - 预览区域展示解析出的效果预览（例如通过 `getDiyVirtualProductDisplayName` 渲染生成的虚拟产物）；
   - 启用“出牌 / 执行”按钮。
3. **只读性**：预览结果纯粹为只读数据，**绝对不改变 GameState**。

### 8.5 调试呈现与未来视觉映射
- **当前 Preview / Debug presentation**：
  - 仅要求具备明确、可测试、可无障碍访问（a11y）的选中状态表现（高亮边框、背景高亮、选中标记或简单微位移）；
  - **严禁将“斗地主式手牌上浮流畅动画”作为 Phase 18 验收门槛**。
- **未来正式前端视觉映射**：
  - 未来的正式精美前端可以将同一个 `selected` 状态渲染为“卡牌脱离手牌行向上浮起”的动画效果；该视觉效果纯属展示层糖，绝对不污染引擎协议或 `GameState` 数据结构。

---

## 9. 动作权威性与执行边界（Action Authority & Execution Boundary）

### 9.1 目标正式 Action 定义
冻结 selection-driven Dynamic DIY 的目标正式 Action：

```ts
export type PlayDiySelectionAction = {
  type: "PLAY_DIY_SELECTION";
  playerId: PlayerId;
  componentCardInstanceIds: CardInstanceId[];
  targetPlayerId?: PlayerId;
};
```

### 9.2 选牌驱动与配方权威性
- **禁止要求客户端传递 `recipeId` 作为规则权威**：正式的 `PLAY_DIY_SELECTION` Action 中**不得包含 `recipeId` 字段**；配方的识别与判定必须由 Engine 通过权威的 `analyzeDIYSelection` 纯函数在当前权威状态上解析；
- **迁移期兼容说明**：若迁移过渡期间暂时兼容旧 `START_ACTIVE_DIY` Action，其中的 `recipeId` 最多只能作为一致性断言（consistency assertion），绝不可决定实际合法性；最终契约以 selection 为唯一权威输入。

### 9.3 引擎端强制重新验证（Anti-Tampering & Stale Check）
- **绝不盲目信任客户端状态**：Engine 在接收到 `PLAY_DIY_SELECTION` 后，**必须使用完全相同的 `analyzeDIYSelection` 在当前权威 `GameState` 上重新分析**；
- **拒绝与不变量保证**：只有当分析结果确为 `status === "EXECUTABLE"` 时，才允许进入 Layer 4 的 Effect Executor；若状态为非 `EXECUTABLE`，引擎必须**直接拒绝执行 Action，原样返回未修改的 `GameState`**，杜绝任何中间状态或脏数据。

---

## 10. 单一真值源与配方注册表结构不变量（Single Source of Truth & Registry Invariants）

### 10.1 单一真值源保障
- **严禁双重规则实现**：代码库中绝对不得同时存在“UI 独立编写的配方匹配逻辑”与“Engine 独立编写的配方匹配逻辑”；
- **同源调用**：UI 预览渲染与 Engine 执行校验必须直接调用同一个底层的权威分析入口 `analyzeDIYSelection`。

### 10.2 配方注册表结构不变量（Registry Invariants）
DIY 规则注册表（`DIYRecipe[]`）必须满足以下编译期与测试断言强保证的结构不变量：
1. **`recipeId` 全局唯一性**：注册表中不得存在重复的 `recipeId`；
2. **组件签名（Component Signature）唯一性**：任意两个配方的所需组件多重集（`CardDefinitionId` 及数量）必须不同，**严禁存在相同组件签名的冲突配方**；
3. **正整数组件数量**：每个配方中每项组件的 `count` 必须为正整数（$\ge 1$）；
4. **顺序无关决定论（Order Independence）**：同一组选牌输入，在注册表中无论配方数组顺序如何颠倒，都必须匹配到完全相同的唯一结果；
5. **歧义即开发期违规**：Phase 18 V1 不支持多结果歧义 DIY 玩法；若注册表中出现重复签名，视为开发期不变量违规（Development-time Invariant Violation），严禁采用运行时“默认取数组第一个”的静默容错。

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
3. **灭火前置条件**：$\text{CO}_2$ 与 $\text{H}_2\text{O}$ 配方仅在玩家自身处于 `FIRE` 状态时合法可用；若无 `FIRE` 则必须判定为不可执行（`MATCHED_NOT_EXECUTABLE`）。
4. **组件销毁**：参与 DIY 的实体卡牌实例在结算时必须移入 `discardPile`，且不创建新的实体卡牌（不创建产物 `CardInstance`）。
5. **伤害与响应上下文**：虚拟酸碱攻击产生的 `DamageEffect` 继续携带 `source.kind === "diy"` 的强类型 `DamageContext`，正确触发对手的酸碱中和或碳酸盐响应。
6. **角色被动技能联动**：化学爱好者（Chemistry Enthusiast）的 DIY 被动技能（DIY 实验）及相关结算保持原有语义。
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
   - 实验反击中化学爱好者“金属反击”选项的正式启用。
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
| 仅落地 Layer 1 只读化学数据/模型（SpeciesId/元素/原子团/化合价表）|
| 纯数据与完整性测试，零游戏/UI/Reducer变更，不含合成器        |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Phase 18D: Authoritative DIY Selection Resolver V1          |
| 落地 analyzeDIYSelection 纯语义分析器，支持 PLAY_DIY_SELECTION|
| 匹配现有 8 个 DIY，保障 100% 规则等价与引擎重校验            |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Phase 18E: Preview / Debug Hand-Selection UI                |
| 前端改造：手牌多选 -> 纯语义 Preview 呈现 -> 统一出牌按钮    |
| 仅需 Debug 选中状态，不含斗地主式卡牌上浮复杂动画           |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Phase 18F: Junior Chemistry Rule Expansion                  |
| 逐批由用户确认新反应规则：先单独 Freeze，再扩展 Resolver 白名单|
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
| **B. Preview Purity（预览纯粹性）** | 语义分析与预览函数必须为无副作用的纯函数，不得派发 Action，不得修改游戏状态。 |
| **C. Execution Revalidation（执行重新验证）** | Engine 在执行“出牌”时，必须调用权威分析器重新校验选中的组件实例，杜绝过期 UI 或伪造 Action。 |
| **D. Existing Equivalence（既有行为等价）** | 现有 8 个 DIY 配方的触发条件、目标、伤害、状态、日志和推进行为 100% 保持原有语义，无任何回归。 |
| **E. Card Instance Correctness（实例独立性）** | 相同定义的多张实体卡（如两张 `ion_h`）必须能被独立选中与区分。 |
| **F. No Duplicate Rules（单一真值源）** | UI 与 Engine 之间不存在两份独立的 DIY 合法性判定逻辑，共享唯一分析入口。 |
| **G. No Hidden Expansion（零隐式扩展）** | 引入初中化学知识库绝不自动导致可玩 DIY 配方或卡池偷偷扩充，`CardDefinition` 既有游戏字段不被覆盖。 |

---

## 17. 规则持久化与裁决层级（Rule Authority Persistence & Precedence）

### 17.1 规则持久化合同（Rule Authority Persistence）
- 用户可以随时提出新的正式产品决策与规则裁定；
- **在生产代码或测试代码根据该裁定修改行为之前，必须先将裁定持久化至当前权威 Freeze 文档的更新或新的继承 Freeze 文档中**，并通过正常的 Git 评审与合并流程；
- 对话上下文（Conversation history）可以作为触发规则变更的讨论输入，但**仅留在对话中的记忆不是未来 Agent 与开发团队可依赖的持久可执行规范（durable executable specification）**；
- 若用户在对话中的意图与已合并的权威 Freeze 文档发生冲突，遵循“先更新并合并 Freeze 文档，再修改生产行为”的严格流程。

### 17.2 裁决层级（Authority Precedence）
规则与架构解释权严格遵循以下层级：
1. **所有适用的已合并权威冻结文档**（以 `docs/PHASE18_DYNAMIC_DIY_FOUNDATION_FREEZE.md`（本文档）、`docs/MVP0_RULE_FREEZE.md`、`docs/PHASE8_CHARACTER_RULE_FREEZE.md`、`docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`、`docs/PHASE13_NEW_PLAYER_GUIDANCE_FREEZE.md`、`docs/PHASE16_BILINGUAL_GAME_LOG_FREEZE.md` 等为代表）；
2. **代码库中已实现且未被上述冻结文档覆盖或修正的既有正确行为与测试不变量**；
3. **历史 AI 生成规则手册（`docs/rules/core-rules-v0.1.docx` 与 `docs/rules/ion-reaction-and-diy-manual-v1.0.docx`，仅作为非约束性历史概念参考，严禁自动导入未批准规则）**。

---

## 18. 明确未完成与非目标声明（Non-Goals & Unfinished Boundaries）

为防范任何误解与过度承诺，在此明确声明：
- **单质金属卡牌未入池，金属反应未实现**；
- **初中化学完整反应网络未实现（当前仅冻结知识库与 8 个既有配方）**；
- **响应 DIY（Response DIY）继续保持关闭**；
- **斗地主式手牌上升精美动画属于未来前端美化，当前仅冻结可测试的 debug 选中状态**；
- **Phase 18 游戏玩法与代码目前未发生任何变更，本阶段仅完成架构与行为冻结**。
