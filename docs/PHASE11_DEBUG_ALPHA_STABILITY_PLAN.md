# Phase 11 Debug Alpha 稳定性与发布准备计划

## 文档定位

本文记录 `0.11.0-alpha.1` 的稳定性、错误恢复、浏览器验证和静态发布技术基线，不新增或解释化学规则。规则版本保持 `MVP0-P10`；MVP 0、Phase 8、Phase 9 与 Phase 10 的冻结文档继续是规则权威来源。

## 发布身份

- 当前 Debug Alpha 临时显示名称：化学卡牌在线游戏。
- 后续正式品牌名称：反应域。本阶段只记录该名称，不在 UI、诊断或 production bundle 中展示。
- 发布渠道：Debug Alpha。
- 应用版本：`package.json` 中的 `0.11.0-alpha.1`。
- 规则版本：`MVP0-P10`。
- Commit：构建时从当前 Git HEAD 注入短 SHA；无法读取时显示 `dev/unknown`，不伪造值。
- 不嵌入构建日期。

`src/app/releaseMetadata.ts` 是 UI 使用的强类型发布元数据模块。应用版本直接读取 `package.json`，Vite 只负责安全序列化 commit。

## 会话错误边界

`LocalGameSessionState` 是严格判别联合：

- `configuring`：只保存角色选择、revision 和非致命配置错误。
- `playing`：保存当前角色选择、revision、真实 `GameState` 和安全操作提示。
- `fatal`：只保存角色 ID 快照、revision、稳定错误码、脱敏用户说明和安全诊断，不保存旧 `GameState`。

引擎内部继续 fail-fast。会话控制器在以下边界捕获未处理异常并进入 fatal：

- 会话初始化；
- 首次创建游戏；
- 按当前阵容重开；
- `engineReducer` 操作；
- fatal 后创建全新对局。

fatal 后旧 action、旧 revision 的创建结果和角色修改均返回原状态。恢复必须再次调用正式游戏工厂并创建全新 `GameState`；失败时仍停留在 fatal，不自动循环。React StrictMode 测试验证每次用户开始、重开或恢复只调用一次游戏工厂。

## React 与浏览器最后保护

- `RootErrorBoundary` 捕获 React 渲染异常，只显示 `UI_RENDER_FAILED` 安全兜底。
- React 19 `createRoot` 配置 `onCaughtError`、`onUncaughtError` 和 `onRecoverableError`；不把原始异常写入页面或远端。
- 浏览器 `error` 与 `unhandledrejection` 监听器按模块单例安装、可清理，并对同一根级故障只切换一次 `ROOT_RUNTIME_FAILED` 兜底。
- 根级兜底只提供重新加载；会话 fatal 页提供全新恢复与返回角色选择。
- 页面和可复制诊断不包含原始错误文本、堆栈、GameState、手牌或日志。

## 确认与恢复交互

在 `playing` 且未 `gameOver` 时，“按当前阵容重开”和“返回角色选择”只打开页面内 `alertdialog`。两个确认共享单一判别状态，不会同时活动；取消不改变会话、GameState、阵容或 revision。对话框进入后明确聚焦“取消”，Escape 取消并把焦点还给触发按钮。

确认后才执行真正命令。模式切换、重开、fatal 或 `gameOver` 会卸载或清理确认状态。`gameOver` 后两个入口不再二次确认。

## About 与公开边界

角色选择页、playing 和 `gameOver` 共用同一 About/帮助界面。内容包括发布身份、基本操作、酸碱响应、状态、DIY、角色技能、成功反应事件、七角色正式定义及实现状态、68 张普通卡池与虚拟结果边界、安全错误格式和延期能力。

Debug Alpha 明确公开双方手牌和调试状态。项目无联网、账号、存档、遥测和远程错误上报；刷新会丢失当前对局并回到默认角色预选。

## 静态构建与产物门槛

- Node `24.18.0`，pnpm `11.9.0`。
- Vite `base` 为 `./`，适配根目录、子目录和未来 WebView。
- production build 不生成 source map。
- JS gzip 不超过 100 KiB；CSS gzip 不超过 10 KiB；`dist` 总大小不超过 500 KiB。
- 正式 Vite production 模块图使用 denylist，导入 E2E 目录、fixture、专用入口、E2E 配置或测试私密状态模块时立即失败；独立 E2E 构建不加载该门禁。
- `check:production` 递归按原始字节扫描 `dist` 的全部普通文件，并检查相对资源、source map、E2E fixture、专用入口和私密模块标识；目录、`index.html` 或文件不可读时均失败且不修改产物。
- `.env*` 默认忽略，仅允许明确跟踪 `.env.example`。
- React 与 React DOM 是生产依赖；Vite、TypeScript、Vitest、React 插件、Happy DOM 和 Playwright 是开发依赖。

## E2E fixture 隔离

正式入口仍是根目录 `index.html` 与 `src/main.tsx`。确定性 E2E 使用独立的 `e2e/index.html`、`vite.e2e.config.ts` 和 `dist-e2e`：

- 只在 E2E production build 中定义 `__PHASE11_E2E_FIXTURE__`；
- fixture 复用正式初始化器、68 张真实 CardInstance、正式 reducer 和强类型会话；
- 不创建 production route，不挂载 `window` 调试 API，不提供正式用户入口；
- 普通 `pnpm run build` 不引用 E2E 入口；自动门禁扫描 `dist`，发现 fixture 模块名或标识即失败。

Playwright 只使用 Chromium，并在 production build + preview 上覆盖默认配置、默认老师/CEO、双老师备课、无老师主行动、两种确认、`gameOver` 直达、fatal 恢复、ErrorBoundary、H2O、CO2、两种 SO2 文案、键盘焦点、About 和 390×844 无水平溢出。每项测试同时收集未预期 `pageerror` 与 `console.error`。

## CI 与统一命令

GitHub Actions 在 Ubuntu 上固定 Node `24.18.0` 与 pnpm `11.9.0`，第三方 action 固定完整 commit SHA 并邻近注明版本标签。CI 执行：

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm run test:run
pnpm run test:shuffle
pnpm exec playwright install --with-deps chromium
pnpm run test:e2e
pnpm run check:size
git diff --check
pnpm run check:tracked-clean
```

依赖审计单独执行：

```bash
pnpm audit --prod
```

审计会向 npm advisory API 发送公开依赖名称和版本。本阶段记录实际结果，但不设为主 CI 门禁。

## 发布前检查清单

- production build、两轮 Vitest、Chromium E2E、产物大小和隔离检查通过。
- `dist` 使用相对路径，不含 source map、fixture 标识或私密环境数据。
- starter deck 仍为 68，初始 `event_lab_fire` CardInstance 仍为 0。
- 未修改卡牌、DIY、状态、角色技能、反应和伤害规则。
- 无 `window.confirm`、生产调试后门、网络请求、遥测、存档或 service worker。
- 桌面与 390×844 浏览器验收无水平溢出，无未预期错误。
- `git diff --check` 通过，构建和测试不改写 tracked 文件。

## 尚未启用

Phase 11 只达到静态测试发布的技术门槛，不实际部署 GitHub Pages，不宣称正式发布或任何地区的稳定网络可达性。Tauri、Electron、PWA、service worker、APP / DMG / EXE / MSI、签名、公证、商店发布和自动更新均留到 Phase 12 或后续阶段。
