# Codex 能力地图与审计基线

## 审计基线

- 审计日期：2026-08-10
- 审计分支：`feat/debug-ui-alpha`
- 审计 HEAD：`57550f70856d5d5e27ac3fcb0fa508cd698d3be6`
- 本文是基于该提交的仓库快照；后续架构、分支或发布状态变化后必须重新核验。
- 本轮文档写入和验证仅针对当前主工作树；其他 linked worktree 不在本文件操作范围。
- 本轮未安装依赖、未运行测试/构建/审计、未联网验证 GitHub Pages，也未创建或修改发布状态。

## 项目目标与范围

项目是 React/TypeScript/Vite 的本地同屏双人化学卡牌 Web Playtest Alpha。当前代码支持 7 个角色、68 张普通实体卡、备课/周期/轮次/行动/响应/状态处理、主动 DIY、角色技能、伤害与淘汰、公开日志、三类结构化成功反应、fatal 会话保护、About/帮助和非模态新玩家引导。

明确不支持或延期：联网、账号、房间、正式多人、私密手牌、存档、回放、后端权威引擎、真实金属卡池、方程式、沉淀、通用反应链、响应 DIY、桌面安装包、签名、公证和自动更新。

## 技术栈与入口

- Node `24.18.0`，pnpm `11.9.0`
- React `19.x`、TypeScript、Vite、Vitest、Happy DOM、Playwright Chromium
- 正式入口：`index.html` → `src/main.tsx` → `src/app/App.tsx` → `src/features/local-game/LocalGamePage.tsx`
- 会话边界：`src/features/local-game/localGameSession.ts` 和 `src/features/local-game/hooks/useLocalGameDebug.ts`
- 正式 reducer：`src/game/engine/reducer.ts`
- 初始化器：`src/game/engine/createInitialGame.ts`
- 核心数据：`src/game/data/cardDefinitions.ts`、`src/game/data/characterDefinitions.ts`、`src/game/data/starterDeck.ts`、`src/game/data/diyRecipes.ts`、`src/game/data/reactions.ts`
- E2E 独立入口：`e2e/index.html`、`e2e/fixtureApp.tsx`、`vite.e2e.config.ts`

## 核心模块关系

```text
src/main.tsx
  └─ src/app/App.tsx / src/features/local-game/LocalGamePage.tsx
      ├─ src/features/local-game/localGameSession.ts
      │   ├─ src/game/engine/createInitialGame.ts
      │   └─ src/game/engine/reducer.ts
      └─ src/features/local-game/components/* + src/features/local-game/localGameView.ts

src/game/engine/reducer.ts
  ├─ src/game/engine/turnFlow.ts
  ├─ src/game/engine/resolution.ts
  ├─ src/game/engine/diy.ts
  ├─ src/game/engine/characterSkills.ts
  ├─ src/game/engine/damage.ts / src/game/engine/damageContext.ts / src/game/engine/damageModifiers.ts
  ├─ src/game/engine/multiTargetResponse.ts / src/game/engine/responseContinuation.ts
  └─ src/game/engine/experimentCounterattack.ts

engine modules → game/data definitions → typed GameState / GameAction
```

## 仓库真实存在的命令

| 命令 | 用途 | 备注 |
|---|---|---|
| `pnpm run dev` | Vite 开发服务器 | 本地交互 |
| `pnpm run build` | `tsc -b`、正式 Vite 构建、production 隔离检查 | 可能写入构建产物 |
| `pnpm run preview` | 正式产物预览 | 本地服务器 |
| `pnpm run test` | Vitest 监听模式 | 交互式 |
| `pnpm run test:run` | Vitest 全量运行 | 结果需实际执行后报告 |
| `pnpm run test:shuffle` | 固定 seed 的随机顺序 Vitest | seed 为 `20260723` |
| `pnpm run test:e2e` | 独立 fixture 构建和 Chromium E2E | 需要 Playwright Chromium |
| `pnpm run test:e2e:production` | 正式产物 Chromium E2E | 覆盖根路径和子路径 |
| `pnpm run check:production` | source map、fixture、私密 marker、相对资源检查 | 读取 `dist` |
| `pnpm run check:size` | JS/CSS gzip 与总产物大小检查 | 读取 `dist` |
| `pnpm run check:tracked-clean` | 检查 tracked worktree 是否干净 | 不适用于保留中的修改 |
| `pnpm audit --prod` | 生产依赖 advisory 查询 | 审计快照中记录为非主 CI 强制门禁；使用前重新核验 |

截至本审计日期，未发现 ESLint、独立 typecheck 或 coverage 阈值配置；这是审计时状态，不是永久规则。

## 已确认事实

- 68 张普通实体卡由 `src/game/data/starterDeck.ts` 生成；`event_lab_fire` 不进入普通卡池。
- `src/game/engine/reducer.ts` 是正式 `GameAction` 入口；UI 对局操作经会话层转发。
- fatal 会话从本地状态移除旧 `GameState`，旧 action 被拒绝；恢复需要重新创建匹配阵容的状态。
- 测试文件分布在 `src` 和 `scripts`，覆盖引擎规则、会话边界、UI 组件、产物扫描、标签检查和静态服务器。
- E2E 配置当前只声明 Chromium；本轮没有取得 Firefox、Safari、真实 iOS 或 Pages 运行结果。
- 本地 Git 已确认 `web-playtest-v0.13.0-alpha.2` 指向 `57550f70856d5d5e27ac3fcb0fa508cd698d3be6`；其 Pages workflow 因 production E2E 的旧 commit 固定断言失败，未成功部署。alpha.3 是替代候选；这不证明公开站点当前运行的版本。

## Codex 可协助的工作矩阵

以下是可协助事项，不是当前强制门禁；每项实施前仍需读取相关规则文档和 `CODEX_PITFALLS.md`。

| 类别 | 可协助事项 | 关键文件 | 风险 | 推荐验证方式 |
|---|---|---|---|---|
| 功能开发 | 在规则冻结后补齐真实金属卡池和实验反击金属选项 | `src/game/data/*`、`src/game/engine/experimentCounterattack.ts`、`docs/PHASE8_CHARACTER_RULE_FREEZE.md` | 高 | reducer/不变量测试、E2E、卡池计数复核 |
| Bug 修复 | 修复 production E2E 的旧 commit 断言并准备 alpha.3 替代候选 | `e2e/production/reaction-field.spec.ts`、`README.md`、`docs/MVP_PLAN.md`、`docs/PHASE13_NEW_PLAYER_GUIDANCE_FREEZE.md`、`scripts/check-web-playtest-tag.mjs` | 低 | 本地 tag 目标、当前 HEAD、package 版本、文档交叉检查 |
| 测试与质量 | 增加覆盖率和浏览器矩阵（需单独批准后形成门禁） | `vite.config.ts`、`package.json`、`playwright.config.ts`、`playwright.production.config.ts`、`.github/workflows/phase11-debug-alpha.yml` | 中 | 实际执行测试、覆盖率报告、浏览器 E2E |
| 架构和重构 | 抽取正式 fixture builder，减少直接拼装 `GameState`；清理未使用脚手架 | `e2e/fixtureScenarios.ts`、`src/game/tests/*`、`src/game/data/debugScenarios.ts`、`src/game/data/statusDefinitions.ts`、`src/app/routes.tsx`、`src/game/engine/statuses.ts`、`src/shared/ids.ts` | 中 | 牌区/pending 不变量、全量 Vitest |
| 性能 | 评估长日志和大牌区的渲染成本，必要时优化 | `src/features/local-game/components/GameLog.tsx`、`src/features/local-game/local-game.css`、`scripts/check-size.mjs` | 中 | 长日志场景、浏览器 profile、体积检查 |
| UI/UX | 复现并修复 iOS Firefox modal focus/root failure 候选问题 | `src/features/local-game/components/ModalDialog.tsx`、`src/features/local-game/components/ConfirmationDialog.tsx`、`src/features/local-game/LocalGamePage.tsx` | 中 | 实际 Firefox/iOS 复现、焦点/Escape/pageerror 断言 |
| 文档 | 维护能力地图、踩坑日志、规则边界和验证记录 | `AGENTS.md`、`docs/CODEX_CAPABILITIES.md`、`docs/CODEX_PITFALLS.md` | 低 | 链接、命令和当前 Git 状态交叉检查 |
| CI/CD | 增加发布前 dry-run 和人工批准后的部署验收记录 | `.github/workflows/phase11-debug-alpha.yml`、`.github/workflows/phase12-web-playtest-pages.yml`、`scripts/check-web-playtest-tag.mjs` | 中 | 候选 tag 演练、产物门禁、人工 Pages 验收 |
| 安全检查 | 进行依赖、密钥、产物 marker 和 CI 权限审查 | `pnpm-lock.yaml`、`.github/workflows/phase11-debug-alpha.yml`、`.github/workflows/phase12-web-playtest-pages.yml`、`scripts/check-production.mjs`、`.gitignore` | 中 | 经授权后运行 audit/secret scanner，并复核产物边界 |

## 仍未取得的证据

本快照不包含当前测试/构建通过结论、漏洞扫描结果、Firefox 结果、远端标签状态或 GitHub Pages 部署状态。后续报告必须逐项标记实际执行与未验证项。
