# Phase 9 本地 Debug UI 规则冻结

本文档只冻结本地双人 Debug Alpha 的角色选择、对局创建、当前阵容重开、返回角色选择和 UI/引擎边界。它不修改 `docs/MVP0_RULE_FREEZE.md` 与 `docs/PHASE8_CHARACTER_RULE_FREEZE.md` 已冻结的卡牌、角色技能、伤害、状态、DIY 或回合规则。

## 一、双人角色选择

- 开局严格为两名玩家，`GameSettings.playersPerGame` 保持为 2。
- 初次打开或刷新本地 Debug 页面进入角色选择，不自动创建 `GameState`。
- 默认预选为 player_1“实验室老师”、player_2“化工厂 CEO”。
- 选择数据直接来自正式 `characterDefinitions`，恰好展示 7 个角色及其中文名、`maxHp`、技能名称、类型、规则文本、实现状态和实现说明。
- 配置保存真实 `CharacterId`，不按数组下标保存身份，不复制第二份角色定义。
- Debug Alpha 允许任意两角色有序组合，包括 7 种镜像角色组合。该测试能力不预先冻结未来正式实体角色牌模式。
- 未知或非法运行时角色值必须在调用 `createInitialGame` 前拒绝。
- 用户必须点击“开始游戏”后才创建对局；重复快速触发不能创建多个相互竞争的状态。

## 二、本地会话与引擎边界

本地页面使用严格判别状态：

- `configuring`：只保存两名角色预选、会话版本和配置错误，不持有 `GameState`。
- `playing`：保存当前阵容、会话版本和一份由真实初始化器创建的 `GameState`。

角色选择属于 React 本地会话状态，不进入 `GameState`。本阶段不新增 `START_GAME` 游戏 action，不修改 `engineReducer` 处理页面配置。playing 状态下的所有对局内操作继续包装为既有 `GameAction` 并由 `engineReducer` 结算；页面不手工拼装或直接修改 `GameState`。

角色选择页面不挂载玩家手牌、普通出牌、DIY、角色主动技能、备课、响应、状态处理、实验反击或游戏日志操作面板，因此配置阶段不能触发任何游戏 action。返回配置后收到的旧游戏 action 必须原样拒绝。

## 三、开始游戏

- 合法配置通过 `createInitialGame({ characterIds })` 创建全新 `GameState`。
- 初始化继续沿用现有起始玩家、牌堆、摸牌、角色 HP、CEO 14 张上限与老师备课规则。
- 阵容含老师时进入 `preparationSelection`；双老师按 player_1、player_2 的既有顺序依次备课；无老师阵容进入既有正常行动流程。
- 普通实体 `CardInstance` 保持 68，`event_lab_fire` 初始实例保持 0。

## 四、按当前阵容重开

- playing 页面在进行中和 `gameOver` 均提供“按当前阵容重开”。
- 重开读取当前 player_1、player_2 的 `CharacterId`，再次调用 `createInitialGame({ characterIds })`，不返回配置页。
- 新旧 `GameState` 不共享对象身份；上一局 HP、牌区、弃牌、状态、角色 usage、DIY 次数、周期、轮次、phase、所有 pending、`tableReference`、effect queue、日志和胜负状态均不保留。
- 镜像角色继续合法；双老师重新按顺序备课；CEO 继续受 14 张上限；化学爱好者重新使用 8 HP。
- 重开不是引擎 action，也不保留默认老师/CEO的隐式重置路径。

## 五、返回角色选择

- playing 页面在进行中和 `gameOver` 均提供“返回角色选择”。
- 该操作保留当前两名角色作为预选，丢弃活动 `GameState` 并返回 `configuring`；不自动开始新局。
- 用户可以修改任意一个或两个角色；再次点击“开始游戏”时创建全新 `GameState`。
- 返回配置或重开会卸载或整体重挂载 playing 子树，清除选中卡牌、目标、DIY 组件、备课选择、响应选择、状态处理和实验反击 UI 的 React 局部状态。

## 六、UI 展示与延期能力

- 角色选择页包含标题、Debug Alpha 说明、两个玩家选择区、当前阵容摘要、镜像角色说明、开始按钮、7 个正式角色资料和延期说明。
- 化学爱好者显示 8 HP、“DIY 实验”和“实验反击”；实验反击金属选项明确标记等待真实金属卡池。
- 硫酸厂厂长“硫酸盐副产”明确标记延期；其他角色只显示正式定义与当前真实实现状态。
- 延期或部分实现能力不得提供虚假可执行入口。
- 页面维持现有 Debug UI 视觉语言，并适配 390px 宽视口，不引入拖拽、动画系统或整体视觉重构。

## 七、排除范围

本阶段不增加 3–4 人、角色随机抽取、角色实体牌模式、`localStorage`、IndexedDB、账号、存档、房间、联网、桌面打包或发布下载。不得修改 68 张普通卡池、创建 `event_lab_fire CardInstance`，也不得提前实现真实金属牌、方程式、沉淀、响应 DIY、硫酸盐副产、完整金属反应或完整反应事件系统。

## 八、完成与验收标准

- 7 个正式角色与全部 49 种有序双角色组合可通过真实初始化器创建。
- 配置、开始、当前阵容重开、返回配置、镜像阵容、非法运行时值和旧 action 隔离均有回归测试。
- 老师备课、CEO 手牌上限、化学爱好者 8 HP、68 张卡池和零 `event_lab_fire` 初始实例保持不变。
- build、全量 Vitest、固定 seed 随机顺序 Vitest、`git diff --check` 与真实浏览器桌面/390×844 检查全部通过后，Phase 9 才达到可提交条件。
