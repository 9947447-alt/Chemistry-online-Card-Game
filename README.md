# 化学卡牌在线游戏

当前发布基线为 Debug Alpha `0.11.0-alpha.1`，规则版本为 `MVP0-P10`。这是一个基于 React、TypeScript、Vite、Vitest 与 Playwright 的本地双人公开调试版本，不是正式发行版。

## 当前能力

- 7 个正式角色及 49 种有序双人阵容，允许镜像角色；默认预选实验室老师与化工厂 CEO。
- 68 张普通实体卡池；`event_lab_fire` 初始普通 `CardInstance` 数量为 0。
- 本地开局、备课、周期、轮次、行动、响应、状态处理、牌堆重洗、淘汰、胜负和公开日志。
- 关联出牌与 `tableReference`，主动 DIY、角色技能、统一伤害管线和实验反击的已实现部分。
- 三类结构化成功反应事件：酸碱中和、酸与碳酸盐、SO2 碱性吸收；虚拟 H2O / CO2 不创建卡牌实例。
- fatal 会话边界：初始化、重开或引擎操作发生未处理异常时停止旧对局，移除旧 `GameState`，只允许全新恢复或返回角色选择。
- React ErrorBoundary、根级 React 回调与浏览器 `error` / `unhandledrejection` 最后保护。
- 对局进行中重开和返回角色选择使用可访问的页面内二次确认；`gameOver` 后直接执行。
- 角色选择、playing 和 `gameOver` 均可打开同一个“关于与帮助”界面，查看版本、能力、操作、安全和延期边界。

Debug Alpha 公开双方手牌、牌堆数量、状态与完整日志。没有联网、账号、房间、存档、遥测或远程错误上报；刷新会丢失当前对局并回到默认角色预选。

## 固定工具链

- Node.js `24.18.0`，见 `.node-version`。
- pnpm `11.9.0`，见 `package.json#packageManager`。
- 只为 E2E 安装 Playwright Chromium。

安装依赖：

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

## 本地运行与验证

开发服务器：

```bash
pnpm run dev
```

正式构建和 production preview：

```bash
pnpm run build
pnpm run preview
```

常规和固定 seed Vitest：

```bash
pnpm run test:run
pnpm run test:shuffle
```

production-mode 独立 fixture 构建和 Chromium E2E：

```bash
pnpm run test:e2e
```

产物与隔离门禁：

```bash
pnpm run check:production
pnpm run check:size
```

生产依赖审计：

```bash
pnpm audit --prod
```

`pnpm audit --prod` 会把公开依赖名称和版本发送给 npm advisory API；它在 Phase 11 实际执行并记录结果，但不是主 CI 强制门禁，避免外部 advisory 服务故障阻塞构建。

## 错误报告

fatal 页面可复制的本地安全诊断只包含：

```text
名称：化学卡牌在线游戏
应用版本：0.11.0-alpha.1
规则版本：MVP0-P10
Commit：<短 SHA 或 dev/unknown>
错误码：<稳定错误码>
运行环境：<非敏感概要>
```

诊断不包含原始 `Error.message`、异常堆栈、`GameState`、手牌、日志或用户状态，也不会上传到外部服务。

## 当前限制与发布状态

- 仅本地双人公开调试，无私密手牌和持久化；刷新即丢失进度。
- 真实金属卡池及实验反击金属选项、方程式、沉淀、响应 DIY、多人、联网、账号、存档和回放均延期。
- GitHub Pages 尚未启用，本轮不部署，也不宣称正式发布或任何地区的稳定网络可达性。
- Tauri、Electron、PWA、service worker、APP / DMG / EXE / MSI、签名、公证和自动更新均未实现；桌面封装留到 Phase 12 或后续阶段。

稳定性与发布准备见 [`docs/PHASE11_DEBUG_ALPHA_STABILITY_PLAN.md`](docs/PHASE11_DEBUG_ALPHA_STABILITY_PLAN.md)。规则边界继续由 [`docs/MVP0_RULE_FREEZE.md`](docs/MVP0_RULE_FREEZE.md)、[`docs/PHASE8_CHARACTER_RULE_FREEZE.md`](docs/PHASE8_CHARACTER_RULE_FREEZE.md)、[`docs/PHASE9_DEBUG_UI_RULE_FREEZE.md`](docs/PHASE9_DEBUG_UI_RULE_FREEZE.md) 和 [`docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`](docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md) 冻结；阶段总览见 [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md)。
