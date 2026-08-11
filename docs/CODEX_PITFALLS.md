# Codex 踩坑与保护边界

本文件只记录可复核的信息。历史事故、根因和修复结果必须有代码、测试、日志、CI 或可复现步骤证据；推测只能放入“待验证候选”。最近核验日期：2026-08-11。

## A. 已确认踩坑

### PIT-001：从 Documents 启动时的仓库与 linked worktree 歧义

- ID：`PIT-001`
- 标题：父目录不是仓库，存在多个同项目 worktree
- 状态：已确认；本轮目标已由用户明确
- 适用范围：从仓库父目录或未明确的工作目录启动的任务
- 症状：`git rev-parse --show-toplevel` 失败，且同一父目录下有多个 Chemistry 项目 worktree
- 根因：启动目录是仓库父目录，而不是唯一 Git 根目录；目录名不足以自动表达用户意图
- 错误做法：直接选择任意带阶段后缀的副本，或读取/修改未获授权的 worktree
- 正确做法：先确认根目录、分支、HEAD、状态；若仍有歧义，停止并请求路径确认
- 验证方法：在用户指定路径执行 `git rev-parse --show-toplevel`、`git branch --show-current`、`git rev-parse HEAD` 和 `git status --short`
- 证据文件/测试/提交：2026-08-10 只读 Git 基线检查与用户路径确认；无专门测试；无新增提交
- 最近核验日期：2026-08-11

### PIT-002：alpha.2 本地标签与发布文档状态不一致

- ID：`PIT-002`
- 标题：本地 `web-playtest-v0.13.0-alpha.2` 已存在，但文档仍写“尚未创建”
- 状态：已确认；alpha.3 已成功公开发布，保留本历史记录
- 适用范围：本地 Git 发布核对、README/Phase 发布说明、候选版本判断
- 症状：2026-08-10，本地标签 `web-playtest-v0.13.0-alpha.2` 的提交目标是审计 HEAD；`README.md`、`docs/MVP_PLAN.md`、`docs/PHASE13_NEW_PLAYER_GUIDANCE_FREEZE.md` 当时仍描述该标签尚未创建
- 根因：本地 Git ref 与文档文本快照不一致；本轮只确认了本地状态和文档内容
- 错误做法：据此推断远端 Pages 已部署或未部署，或移动/重写标签来“修正文档”
- 正确做法：分别记录本地 tag、文档状态和远端部署证据；标签/部署动作必须获得明确授权。2026-08-11 已确认 alpha.2 Pages workflow 因 production E2E 的旧 commit 固定断言失败，alpha.2 未成功部署；改用不移动旧标签的 alpha.3 替代发布。alpha.3 已成功公开发布，对外阶段为 Reaction Field Alpha 2，技术版本为 `0.13.0-alpha.3`，规则版本为 `MVP0-P10`，标签 `web-playtest-v0.13.0-alpha.3` peeled 到 `0f50b2c8011ee108bc4b6ab3178ad4aa0acbe6cd`；GitHub Release 为 [web-playtest-v0.13.0-alpha.3](https://github.com/9947447-alt/Chemistry-online-Card-Game/releases/tag/web-playtest-v0.13.0-alpha.3)，公开试玩为 [https://9947447-alt.github.io/Chemistry-online-Card-Game/](https://9947447-alt.github.io/Chemistry-online-Card-Game/)。
- 验证方法：`git rev-parse web-playtest-v0.13.0-alpha.2^{commit}`、`git rev-parse HEAD`，并检索 `README.md`、`docs/MVP_PLAN.md`、`docs/PHASE13_NEW_PLAYER_GUIDANCE_FREEZE.md` 中的发布状态文字
- 证据文件/测试/提交：`README.md`、`docs/MVP_PLAN.md`、`docs/PHASE13_NEW_PLAYER_GUIDANCE_FREEZE.md`；本地 Git tag；当时审计 HEAD `57550f7`
- 最近核验日期：2026-08-11

本项中关于 alpha.2 的历史描述不用于推断 alpha.3 的当前状态；alpha.3 的公开发布、Pages 部署和 URL 事实见上文记录。

## B. 项目保护性不变量

这些是当前代码、测试或规则冻结已经确认的 guardrail，不是历史事故记录：

- 普通实体卡池保持 68 张；`event_lab_fire` 不进入普通卡池，也不应创建为普通 `CardInstance`。
- `src/game/engine/reducer.ts` 是正式 `GameAction` reducer 入口；UI 不应复制第二套引擎合法性规则。
- fatal 会话不得继续暴露旧的可交互 `GameState`；恢复必须创建匹配阵容的新状态，或返回角色选择。
- 响应、状态、DIY、角色技能和反应必须遵守相应 Phase 冻结文档，不得根据现实化学知识自行扩展规则。
- 未实际执行的测试、构建、审计、浏览器检查或部署验收不得报告为通过。
- 用户已有修改必须保留；不得修改其他 linked worktree、Git 标签或 GitHub 状态。
- 不得读取或输出 `.env`、密钥、令牌、凭据以及其他敏感内容。

## C. 待验证候选

### CAND-001：fixture 直接构造 `GameState` 可能漂移

- 状态：待验证
- 观察：部分测试和 E2E fixture 使用对象 spread 直接设置 phase、pending 或状态，再调用正式 reducer。
- 不能据此确认存在缺陷或历史事故；当前只是维护风险候选。
- 升级所需证据：逐个 fixture 对照正式状态转换路径，补充牌区/pending/日志/HP 不变量验证，并取得可复现失败或明确的规则偏差。
- 建议验证文件：`e2e/fixtureScenarios.ts`、`src/game/tests/*`、`src/game/engine/*`
- 最近核验日期：2026-08-10

### CAND-002：iOS 27 beta Firefox 的 modal/root failure

- 状态：待验证
- 观察：`README.md` 和 `docs/PHASE13_NEW_PLAYER_GUIDANCE_FREEZE.md` 记录过打开帮助或确认框可能进入 `ROOT_RUNTIME_FAILED`；本轮未运行 Firefox 或真实 iOS。
- 不能把文档记录直接当作当前版本可复现根因，也不能声称修复分支有效。
- 升级所需证据：指定浏览器/系统版本、最小复现步骤、console/pageerror 日志、焦点序列和对照浏览器结果。
- 建议验证文件：`src/features/local-game/components/ModalDialog.tsx`、`src/features/local-game/components/ConfirmationDialog.tsx`、`src/features/local-game/LocalGamePage.tsx`、`playwright.config.ts`、`playwright.production.config.ts`
- 最近核验日期：2026-08-10

### CAND-003：package.json 范围版本与锁文件精确版本的认知差异

- 状态：待验证
- 观察：`package.json` 使用部分 `^` 范围，而 `pnpm-lock.yaml` 记录了具体解析版本。
- 这本身不是依赖错误，也没有在本轮执行安装或升级。
- 升级所需证据：明确项目升级政策，并在隔离环境中用 frozen lockfile 验证解析结果、构建和安全影响。
- 建议验证文件：`package.json`、`pnpm-lock.yaml`、`.node-version`、`pnpm-workspace.yaml`
- 最近核验日期：2026-08-10
