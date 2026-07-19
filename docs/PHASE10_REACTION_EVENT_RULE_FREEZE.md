# Phase 10 成功反应事件规则冻结

本文档冻结 Phase 10「成功反应事件最小可玩闭环」。它只为三类既有成功结算增加强类型事实事件，并启用硫酸厂厂长“硫酸盐副产”。除本文明确覆盖的边界外，`docs/MVP0_RULE_FREEZE.md`、`docs/PHASE8_CHARACTER_RULE_FREEZE.md` 与 `docs/PHASE9_DEBUG_UI_RULE_FREEZE.md` 继续有效；Phase 8、Phase 9 的历史规则不因本阶段被改写。

## 一、阶段范围

Phase 10 只有三个正式 `ReactionDefinitionId`：

1. `acid_base_neutralization`：酸碱中和。
2. `acid_carbonate_co2`：酸与碳酸盐。
3. `so2_alkaline_absorption`：SO2 碱性吸收。

不得根据名称、formula、日志文字或现实化学知识增加其他反应。`FIRE` 处理不属于 Phase 10 成功反应事件；本阶段不增加反应 action、反应 phase、Effect 分支、牌区、普通 `CardInstance` 或第二份反应历史。

## 二、酸碱中和

- 合法酸性 `DAMAGE` 被当前规则允许的碱性实体响应牌成功响应，或合法碱性 `DAMAGE` 被酸性实体响应牌成功响应时，记录一次 `acid_base_neutralization`。
- 攻击来源可以是真实实体卡，也可以是合法虚拟主动 DIY 伤害结果；响应参与者仍必须是真实实体响应牌。
- 原伤害完全取消，真实响应牌及真实攻击来源牌按既有规则各弃置一次。
- 结果中的 H2O 仅为结构化虚拟结果；不创建 `CardInstance`、token 或临时资源。
- 不更新 `tableReference`，不打开额外响应窗口，不创建后续反应链。

## 三、酸与碳酸盐

- 合法酸性 `DAMAGE` 被实体 `CO3^2-` 或实体 `Na2CO3` 成功响应时，记录一次 `acid_carbonate_co2`。
- 攻击来源可以是真实实体酸牌，也可以是合法虚拟主动 DIY 酸性伤害结果。
- 原伤害完全取消，响应牌及真实攻击来源牌按既有规则弃置一次。
- CO2 只存在于结构化事件与对应日志中；不创建 `CardInstance`、token 或临时资源。
- 不自动处理 `FIRE`，不建立额外 continuation，不产生反应链。

## 四、SO2 碱性吸收

以下两条生产路径共享 `so2_alkaline_absorption`，并使用不同强类型 trigger：

- `multi-target-damage-response`：书记“尾气泄漏”的即时普通 SO2 `DAMAGE` 被合法碱性牌吸收。原伤害完全抵消，响应牌弃置，书记多目标队列继续保留剩余目标和已完成结果。
- `status-handling`：玩家在 `statusWindow` 使用合法碱性牌处理并移除指定 `SO2_LEAK`。该路径不创建即时 `DAMAGE`，不改变其他状态顺序。

两条路径均不创建新卡牌实例。即时多目标响应仍可按 Phase 8 规则进入实验反击并恢复原 multi-target continuation；状态处理不触发实验反击。

## 五、FIRE 与明确不触发边界

H2O / CO2 处理 `FIRE` 继续只是既有状态处理，不产生 `SuccessfulReactionEvent`，不泛化为化学反应或灭火连锁。

以下行为均不产生成功反应事件，也不触发硫酸盐副产：

- 普通出牌、关联成功和 `tableReference` 更新；
- 主动 DIY 构建动作本身及虚拟 DIY 组件组合本身；
- `PASS_ACTION`、放弃普通响应、放弃书记 SO2 响应；
- 非法 action、非法响应、角色免疫、普通伤害被修饰至 0；
- 实验反击追击；
- `FIRE` 状态处理、`FIRE` / `SO2_LEAK` 自然状态伤害与自然清理；
- 单纯弃牌、摸牌、回复；
- 任何未列入本文件三条正式 definition 的行为。

## 六、强类型事件模型

`SuccessfulReactionEvent` 是已经成功结算的只读事实，不是待执行 `Effect`。每个事件必须保存：

- 稳定的 `ReactionDefinitionId`；
- 判别联合形式的准确 `ReactionTrigger`；
- 判别联合形式的 `ReactionParticipant` 来源快照；
- 判别联合形式的 `ReactionOutcome`。

真实卡参与者保存 `playerId`、`cardInstanceId`、`cardDefinitionId` 和反应角色；虚拟 DIY 保存 `playerId`、`recipeId` 和反应角色；角色技能来源保存 `sourcePlayerId` 与 `skillId`；状态来源保存 `targetPlayerId`、`statusInstanceId` 与 `statusId`。事件不得伪造普通卡牌实例，不得修改 `DamageContext`，不得加入 `Effect` 联合，不得重写 `effectQueue` / `resolveEffects`。

## 七、日志与持久化

- `SuccessfulReactionEvent` 只附着在对应 `GameLogEntry.reaction`，不新增 `reactionHistory` 或 `recentReaction`。
- 普通日志继续使用原有结构；UI 只读取结构化 reaction 字段，不解析 message。
- 每次成功反应恰好产生一个事件日志。continuation 暂停、恢复或实验反击结算不得重复记录。
- 事件参与者只保存原始值快照；后续牌区和状态变化不得篡改事件。
- 反应事件日志必须先于对应硫酸盐副产成功摸牌日志。
- 非法路径返回原状态，不得写入事件或日志。

## 八、硫酸盐副产

`sulfuric_acid_factory_director_sulfate_byproduct` 从 Phase 10 起正式启用。统一事件消费者只在以下条件全部成立时摸 1：

1. 事件属于本阶段三条正式 definition。
2. 硫酸厂厂长以真实实体物质牌参与事件，且角色为攻击来源或合法响应者。
3. 该牌的正式 `CardDefinition.ionsProvided` 明确包含 `SO4^2-`。
4. 该玩家本实验轮次尚未成功发动副产。
5. 反应开始前的 deck 或 discard pile 中存在实际可摸取的牌，且统一手牌上限允许摸牌。

不得按 definition ID、名称、formula 或现实知识判断硫酸根。实体稀 H2SO4 作为攻击来源，即使其攻击被对方完全抵消，仍属于成功参与反应；它作为合法酸性响应牌时也可触发。非厂长实体牌、虚拟 H2SO4 DIY、仅作为 DIY 组件的 `ion_so4`、普通参考出牌、状态、角色技能、实验反击和非法响应均不触发。

副产不占主行动，不更新 `tableReference`，不修改 `usedDIYThisCycle` 或 `perCycle`。每名厂长独立复用现有 `perRound` usage key；新实验轮次和新周期继续使用既有统一重置入口。

## 九、空牌与原子性

- 成功反应事件不因副产无法摸牌而取消。
- 只有手牌实际增加 1 张时，才写入副产成功日志并消耗 `perRound` usage。
- 若反应开始前 deck 与 discard pile 均无可摸牌，或手牌上限不允许摸牌，不消耗次数、不写成功摸牌日志、不创建或复制牌，不改变牌区，也不阻塞 continuation。
- 同一轮后续再次满足条件且已有实际可摸牌时，可以再次尝试。
- deck 为空而 discard pile 有牌时，复用既有随机洗回及统一摸牌逻辑。

## 十、固定结算顺序

普通单目标成功响应：完成全部校验；移动响应牌及需要弃置的真实攻击牌；记录一次事件；统一消费副产；按既有条件进入实验反击，否则只恢复一次 single-response continuation。

书记即时 SO2 多目标响应：完成当前响应者校验与弃牌；记录一次事件；统一消费事件；按既有条件进入实验反击或恢复 multi-target continuation；不得丢失 remaining targets、completed results，不得提前 `gameOver` 或重复当前目标。

`SO2_LEAK` 状态处理：校验 pending 与处理牌；弃置处理牌；移除指定状态；记录一次事件；统一消费事件；继续既有状态顺序或进入主行动。

## 十一、Debug UI 与延期范围

Debug UI 在现有日志中展示反应名称、入口、参与来源和虚拟结果或状态移除结果；不新增操作面板。虚拟 H2O / CO2 必须明确标记为不创建 `CardInstance`，即时 SO2 与状态处理必须可区分，副产摸牌仍使用独立普通日志。

Phase 10 不支持方程式、沉淀、完整金属反应、响应 DIY、通用反应链、多人或发布能力。实验反击金属选项继续等待真实金属卡池。普通实体卡池保持 68，初始 `event_lab_fire` 实例保持 0，starter deck、CardZone、action、phase、`DamageContext` 和 Phase 9 本地会话语义均不改变。
