[English](./README.md) | 简体中文

# 反应域

**反应域（REACTION FIELD）** 已公开发布 Web Playtest Alpha，技术版本为 `0.13.0-alpha.3`，规则版本严格为 `MVP0-P10`，对外阶段名为 Reaction Field Alpha 2。本次发布不增加任何游戏功能或规则。这是一个基于 React、TypeScript、Vite、Vitest 与 Playwright 的本地同屏双人公开试玩版本，不是正式发行版。

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

Web Playtest Alpha 公开双方手牌、牌堆数量、状态与完整日志。没有联网、账号、房间、存档、遥测或远程错误上报；刷新会丢失当前对局并回到默认角色预选。

## 公开试玩地址与本轮状态

公开试玩入口为 [https://9947447-alt.github.io/Chemistry-online-Card-Game/](https://9947447-alt.github.io/Chemistry-online-Card-Game/)，GitHub Release 为 [web-playtest-v0.13.0-alpha.3](https://github.com/9947447-alt/Chemistry-online-Card-Game/releases/tag/web-playtest-v0.13.0-alpha.3)。当前公开发布事实为：对外阶段 Reaction Field Alpha 2，技术版本 `0.13.0-alpha.3`，规则版本 `MVP0-P10`，标签 `web-playtest-v0.13.0-alpha.3`，peeled commit `0f50b2c8011ee108bc4b6ab3178ad4aa0acbe6cd`。`main` 已包含完整稳定历史；Pages workflow、部署和简略公开页面验收均已成功，但这不等同于广泛跨浏览器兼容性验收。`web-playtest-v0.13.0-alpha.2` 已存在并保持不变，指向 `57550f70856d5d5e27ac3fcb0fa508cd698d3be6`；其 Pages workflow 因 production E2E 对旧 commit 的固定断言失败，alpha.2 未成功部署。`web-playtest-v0.13.0-alpha.1` 与 alpha.2 标签均保持不可变。

## Alpha 4 国际试玩状态

Alpha 4 国际试玩功能已在当前分支实现，但尚未合并、发布或部署。Alpha 4 提供简体中文和英文展示层，不改变游戏状态或规则。

- 展示语言根据浏览器语言偏好给出建议，也可以在页面内切换。
- 语言选择仅保存在当前 React 页面生命周期，不做持久化；刷新后会重新根据浏览器语言建议。
- 英文模式下，普通正式游戏日志仍保持简体中文。部分结构化反应展示已本地化，但不能据此宣称游戏已有完整英文日志。

## Feedback / 反馈

<a href="https://forms.cloud.microsoft/r/QG8PACUnsa" target="_blank" rel="noopener noreferrer">Feedback / 反馈 — opens Microsoft Forms in a new tab / 将在新标签页打开 Microsoft Forms</a>

点击反馈会离开游戏，提交内容由 Microsoft Forms 处理。游戏不会向该表单传递手牌、日志、角色、浏览器信息、错误诊断、语言偏好或任何 `GameState` 内容。 / Clicking Feedback leaves the game and Microsoft Forms handles submitted content. The game sends the form no hand, log, character, browser information, error diagnostic, language preference, or `GameState` content.

游戏不会在用户点击反馈链接前访问 Microsoft Forms。点击后由 Microsoft Forms 处理用户填写的内容。本项目不声称该表单匿名、无需登录或不收集身份信息。

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

正式 `src/main.tsx` / `dist/index.html` 试玩路径（同时覆盖根路径和 GitHub Pages 子路径）：

```bash
pnpm run test:e2e:production
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
名称：反应域
应用版本：0.13.0-alpha.3
规则版本：MVP0-P10
Commit：<短 SHA 或 dev/unknown>
错误码：<稳定错误码>
运行环境：<非敏感概要>
```

诊断不包含原始 `Error.message`、异常堆栈、`GameState`、手牌、日志或用户状态，也不会上传到外部服务。

## 当前限制与发布状态

- 仅本地同屏双人公开试玩，无私密手牌和持久化；刷新即丢失进度。
- 真实金属卡池及实验反击金属选项、方程式、沉淀、响应 DIY、多人、联网、账号、存档和回放均延期。
- 当前公开发布使用 GitHub Pages；本地开发与验证不执行部署。
- Tauri、Electron、PWA、service worker、APP / DMG / EXE / MSI、签名、公证和自动更新均未实现，也不在本阶段范围。
- 已知兼容性边界：在 iOS 27 beta 的 Firefox 中，打开帮助或重开确认框可能进入 `ROOT_RUNTIME_FAILED`。此前的 `requestAnimationFrame` 聚焦实验未解决该问题，未进入稳定分支；Safari 与已测试的 Edge 路径正常只是已有真机/浏览器记录，不构成所有版本的普遍保证。本次 alpha.3 发布不修复也不声称修复 iOS Firefox beta；失败热修复分支 `fix/ios-firefox-modal-focus-alpha2` 不复制、不合并、不修改。

发布、标签、回滚与停止公开试玩说明见 [`docs/PHASE12_REACTION_FIELD_WEB_PLAYTEST_FREEZE.md`](docs/PHASE12_REACTION_FIELD_WEB_PLAYTEST_FREEZE.md)。Phase 11 是历史稳定性基线；规则边界继续由 [`docs/MVP0_RULE_FREEZE.md`](docs/MVP0_RULE_FREEZE.md)、[`docs/PHASE8_CHARACTER_RULE_FREEZE.md`](docs/PHASE8_CHARACTER_RULE_FREEZE.md)、[`docs/PHASE9_DEBUG_UI_RULE_FREEZE.md`](docs/PHASE9_DEBUG_UI_RULE_FREEZE.md) 和 [`docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`](docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md) 冻结；阶段总览见 [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md)。

## 许可证

- Source code: [Apache-2.0](LICENSE)，版权归 `Copyright 2026 Nulledge and Reaction Field contributors` 所有；归属说明见 [NOTICE](NOTICE)。
- Brand assets: `public/brand/**` 由 [品牌资产说明](docs/REACTION_FIELD_BRAND_ASSETS.md) 单独管理，不属于 Apache-2.0 源代码授权范围。
- Third-party dependencies and assets: 继续受各自许可证约束。
