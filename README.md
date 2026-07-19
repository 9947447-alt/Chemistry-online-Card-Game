# Chemistry Online Card Game

一个基于 React、TypeScript、Vite 和 Vitest 的本地双人化学卡牌 Debug Alpha。当前版本用于公开调试规则引擎与双人可玩闭环，不是正式发行版。

## 当前能力

- 双人角色选择：7 个正式角色，Debug Alpha 允许两名玩家选择同一角色。
- 68 张普通实体卡池；`event_lab_fire` 仅保留为角色技能相关定义，初始不创建普通 `CardInstance`。
- 完整本地开局、实验周期、轮次、行动、牌堆重洗、淘汰、胜负与公开日志。
- 关联出牌与 `tableReference`，以及普通出牌和实体卡牌效果两条明确路径。
- 酸碱伤害与响应、碳酸盐响应、`SO2_LEAK`、`FIRE`、行动开始状态处理和统一 `DAMAGE` 管线。
- Phase 10 三类结构化成功反应事件：酸碱中和、酸与碳酸盐、SO2 碱性吸收；虚拟 H2O / CO2 不创建卡牌实例。
- 主动 DIY：H2O、CO2、SO2，以及当前冻结的虚拟酸、虚拟碱配方；DIY 结果不创建普通卡牌实例。
- 7 个角色的体力、周期摸牌、备课、主动技能、伤害被动、共享次数与响应技能入口。
- 化学爱好者“实验反击”的回复和实体酸碱追击已实现；金属元素选项因当前没有真实金属卡池而延期。
- 硫酸厂厂长“硫酸盐副产”已通过统一成功反应事件消费者实现，并严格读取实体物质牌的 `ionsProvided`。
- 按当前阵容创建全新对局、返回角色选择后保留当前阵容预选。

## 本地运行

安装依赖：

```bash
pnpm install
```

启动开发服务器：

```bash
pnpm run dev
```

按终端输出的 Vite 地址打开页面。首次进入会显示角色选择，默认预选实验室老师与化工厂 CEO；点击“开始游戏”后才会创建本地 `GameState`。

构建：

```bash
pnpm run build
```

运行全量测试：

```bash
pnpm exec vitest run
```

运行固定 seed 的随机顺序回归：

```bash
pnpm exec vitest run --sequence.shuffle --sequence.seed=20260717
```

## 当前限制

- 仅支持本地双人公开调试；没有联网、账号、房间、正式多人或私密手牌。
- 不使用本地存档；刷新页面后回到默认角色预选。
- 没有发布下载包、桌面打包或线上服务器地址。
- 真实金属卡池与实验反击金属选项延期。
- 方程式、沉淀、完整金属反应、响应 DIY、通用反应链、多人和发布能力延期。

规则边界见 [`docs/MVP0_RULE_FREEZE.md`](docs/MVP0_RULE_FREEZE.md)、[`docs/PHASE8_CHARACTER_RULE_FREEZE.md`](docs/PHASE8_CHARACTER_RULE_FREEZE.md)、[`docs/PHASE9_DEBUG_UI_RULE_FREEZE.md`](docs/PHASE9_DEBUG_UI_RULE_FREEZE.md) 和 [`docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`](docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md)。开发阶段状态见 [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md)。
