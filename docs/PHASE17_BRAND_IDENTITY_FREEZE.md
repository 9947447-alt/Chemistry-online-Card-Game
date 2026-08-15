# Phase 17 反应域品牌与仓库身份迁移方案冻结

## 1. 结论、目标与明确非目标

本文件正式冻结 Reaction Field 品牌统一与仓库身份迁移方案（Phase 17），确立项目从代号 `Chemistry-online-Card-Game` 全面收敛至正式品牌 **反应域 / Reaction Field** 的规范与实施路线。

### 1.1 核心目标
1. 统一中英文正式品牌、UI 装饰徽标、仓库 slug、包名及发布元数据。
2. 将 GitHub 仓库 slug 迁移为 `reaction-field`（有效备用：`reaction-field-card-game`）。
3. 同步 `package.json` 中的 `"name": "reaction-field"`，保持包名与仓库 slug 100% 同构。
4. 同步应用内静态仓库链接 `src/app/projectRepository.tsx` 及关联测试契约。
5. 确立 GitHub Pages 目标 URL `https://9947447-alt.github.io/reaction-field/` 与验收标准。
6. 补齐 GitHub 仓库公开元数据（Description、Topics、基础社区规范指引）。
7. 明确外部授权边界、改名实施顺序、实测验证项与安全回滚策略。

### 1.2 明确非目标（边界红线）
1. **零游戏规则变化**：严格保持 `MVP0-P10` 规则版本、68 张普通实体卡池、7 位角色定义、统一伤害管线、主动 DIY 虚拟攻击与结构化反应事件，不新增、不改写任何游戏机制。
2. **禁止虚假化学表述**：不得将当前规则机制描述为未经规则书确认的“真实化学模拟”；正式定位统一定义为“基于化学主题的策略卡牌游戏”。
3. **禁止大范围 UI 重构与美术接入**：整套 UI 皮肤重设计、68 张卡牌独立插画、7 位角色高精度立绘、反应粒子与动画特效严格延期至 Phase 20–22（Visual Polish + Beta Hardening）。
4. **禁止修改历史冻结文档**：`docs/MVP0_RULE_FREEZE.md` 及 Phase 8 至 Phase 16 既有冻结文档保持不可变。
5. **禁止重写 Git 历史或既有 Release**：所有既有 Git Tags（如 `web-playtest-v0.12.0-alpha.1` ~ `web-playtest-v0.16.0-alpha.1`）与既有 GitHub Releases 保持不可变，严禁移动、删除或覆盖。
6. **README 聚焦必要修正**：Phase 17 README 仅做必要链接与基础结构对齐，不做过度营销重写。

---

## 2. 唯一品牌身份规范表

| 属性 | 规范定义 | 使用场景与说明 |
| :--- | :--- | :--- |
| **中文正式名** | `反应域` | 中文正文、中文界面主标题、中文元数据 |
| **英文正式名** | `Reaction Field` | 英文正文、英文界面主标题、英文文档正文（Title Case） |
| **UI 装饰大写** | `REACTION FIELD` | 页面 kicker、版本状态条、UI 徽标（Small-caps 风格） |
| **首次双语并列** | `Reaction Field / 反应域` (英为主)<br>`反应域（REACTION FIELD）` (中为主) | README 标题、版权声明（NOTICE）、对外公告首句 |
| **英文大小写规则** | 正文使用 `Reaction Field`；装饰使用 `REACTION FIELD` | 禁止使用 `Reaction field` 或小写（除包名/slug 外） |
| **GitHub 仓库 Slug** | `reaction-field` | 唯一首选 GitHub 仓库名（小写 kebab-case） |
| **有效备用 Slug** | `reaction-field-card-game` | 仅当首选 slug 在授权实施时发生冲突时启用 |
| **npm Package Name** | `reaction-field` | `package.json` 中的 `"name"` 字段 |
| **目标 Pages URL** | `https://9947447-alt.github.io/reaction-field/` | 生产 Web 试玩唯一目标地址 |
| **一句话英文定位** | `An open-source chemistry-themed local two-player card game with tactical reactions and emergent strategy.` | GitHub Repo Description、README 副标题 |
| **一句话中文定位** | `一款基于化学主题的开源本地同屏双人策略卡牌游戏。` | README.zh-CN 副标题、中文介绍 |
| **Release 标题模板** | `Reaction Field Alpha <N> — v<version>` | 例如：`Reaction Field Alpha 6 — v0.16.0-alpha.1` |
| **Release Tag 契约** | `web-playtest-v<version>` | 例如：`web-playtest-v0.16.0-alpha.1`（严格保持不变） |
| **Pages 浏览器标题** | `反应域 · REACTION FIELD · Web Playtest Alpha · <version> · <rulesVersion>` | 由 Vite 构建插件自动注入 HTML `<title>` |

---

## 3. 文件处理分类原则

### 3.1 活动文件（Active Files —— Phase 17C 允许修改）
- `package.json`：修改 `"name": "reaction-field"`。
- `src/app/projectRepository.tsx`：更新 `projectRepositoryUrl` 为 `https://github.com/9947447-alt/reaction-field`。
- `src/app/projectRepository.test.tsx`：更新测试断言中预期的仓库 URL。
- `e2e/production/reaction-field.spec.ts`：更新 E2E 生产测试中的仓库链接断言。
- `e2e/tests/debug-alpha.spec.ts`：更新 E2E 测试中的仓库链接断言。
- `README.md` & `README.zh-CN.md`：更新公开试玩 Pages URL 与仓库链接，精简首屏结构。
- `docs/MVP_PLAN.md`：更新公开试玩地址记录与 Phase 17 路线图进度。
- `docs/CODEX_CAPABILITIES.md`：增补 Phase 17 审计快照与最新能力，保留历史记录。

### 3.2 历史冻结与踩坑文件（Historical / Frozen Files —— 严格禁止修改）
- `docs/MVP0_RULE_FREEZE.md`
- `docs/PHASE8_CHARACTER_RULE_FREEZE.md`
- `docs/PHASE9_DEBUG_UI_RULE_FREEZE.md`
- `docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`
- `docs/PHASE11_DEBUG_ALPHA_STABILITY_PLAN.md`
- `docs/PHASE12_REACTION_FIELD_WEB_PLAYTEST_FREEZE.md`
- `docs/PHASE13_NEW_PLAYER_GUIDANCE_FREEZE.md`
- `docs/PHASE15_FIRST_GAME_CONVERSION_FREEZE.md`
- `docs/PHASE16_BILINGUAL_GAME_LOG_FREEZE.md`
- `docs/ALPHA4_INTERNATIONAL_PLAYTEST_FREEZE.md`
- `docs/CODEX_PITFALLS.md`（记录历史发生的真实事故与踩坑事实，严禁为统一搜索结果而重写）

---

## 4. Phase 17 实施拆分子阶段

### 4.1 Phase 17C：代码库内代码、测试与必要文档改名
- **执行范围**：
  1. 修改 `package.json` 中的 `"name"` 为 `"reaction-field"`。
  2. 修改 `src/app/projectRepository.tsx` 中的 `projectRepositoryUrl` 为 `"https://github.com/9947447-alt/reaction-field"`。
  3. 修改 `src/app/projectRepository.test.tsx`、`e2e/production/reaction-field.spec.ts`、`e2e/tests/debug-alpha.spec.ts` 对应断言。
  4. 修改 `README.md` 和 `README.zh-CN.md` 中的 Pages 链接与仓库链接。
  5. 修改 `docs/MVP_PLAN.md` 中对应的试玩 URL 记录。
- **禁止范围**：禁止修改游戏规则、引擎逻辑、组件结构；禁止修改历史冻结文档；禁止执行 GitHub 远端写操作。
- **本地完整验证门禁**：
  ```bash
  pnpm run build
  pnpm run test:run
  pnpm run test:shuffle
  pnpm run test:e2e
  pnpm run test:e2e:production
  pnpm run check:production
  pnpm run check:size
  git diff --check
  pnpm run check:tracked-clean
  ```

### 4.2 Phase 17D：GitHub 仓库设置与 Pages 迁移（独立外部授权边界）
> [!IMPORTANT]
> Phase 17D 涉及 GitHub 平台层面的全局修改，**必须作为单独授权边界**，未经用户显式授权不得执行。

- **前置依赖**：Phase 17C 代码变更已通过 PR 合并至 `main` 分支。
- **授权操作指令序列**：
  1. 重命名 GitHub 仓库：
     ```bash
     gh repo rename reaction-field -R 9947447-alt/Chemistry-online-Card-Game --yes
     ```
  2. 更新仓库 Description 与 Topics：
     ```bash
     gh repo edit 9947447-alt/reaction-field --description "An open-source chemistry-themed local two-player card game with tactical reactions and emergent strategy." --add-topic card-game --add-topic chemistry --add-topic react --add-topic typescript --add-topic board-game --add-topic playtest
     ```
  3. 更新本地主仓库 remote URL（所有 linked worktree 自动共享）：
     ```bash
     git remote set-url origin git@github.com:9947447-alt/reaction-field.git
     ```
  4. 触发新 Release Tag 构建或由 `main` 自动触发 GitHub Pages 重新部署。
- **停止条件**：
  - 若 `gh repo rename` 报错名称冲突（422 / Already exists），立即停止并向用户申请使用备用 slug `reaction-field-card-game`。
  - 若 Pages Actions 构建失败，立即停止，分析日志，禁止强行覆盖。

### 4.3 Phase 17E：公开 URL、静态资源与真实网页验收
- **验收清单**：
  1. **新 Pages 试玩 URL**：访问 `https://9947447-alt.github.io/reaction-field/`，确认 HTTP 200，页面正常渲染。
  2. **旧 Pages URL 实测**：访问 `https://9947447-alt.github.io/Chemistry-online-Card-Game/`，记录实际状态（不预设 100% 必然失效，真实记录是 404 还是被重定向）。
  3. **静态资源相对路径**：确认 CSS、JS、SVG 图标（`reaction-field-game-icon.svg`）正常加载，无 `/assets/` 根绝对路径 404。
  4. **HTML Title**：确认浏览器标签页标题精确为 `反应域 · REACTION FIELD · Web Playtest Alpha · <version> · MVP0-P10`。
  5. **仓库外链**：在 About 弹窗与结算页点击 GitHub 链接，确认直接打开 `https://github.com/9947447-alt/reaction-field`。
  6. **反馈入口**：点击 Microsoft Forms 链接，确认正常打开且无自动私密数据泄露。
  7. **双人对局 Smoke Test**：在真实浏览器中完成一次角色选择与开局出牌流程，确认功能完整。

---

## 5. 事实、推断与实测边界声明

1. **已验证事实（Verified Facts）**：
   - 目标基线 Commit `c3fe28bf2c40df4243d8c262ccfdc320c6224cee` 处于干净状态。
   - `9947447-alt` 账号下 `reaction-field` 与 `reaction-field-card-game` 目前均为空闲状态（HTTP 404）。
   - `vite.config.ts` 使用 `base: "./"`，构建产物天生适配任意子路径。
2. **合理推断（Logical Inferences）**：
   - GitHub 对重命名后的仓库 Web 页面（`github.com/...`）提供自动 301 重定向。
   - 统一 package name 与 repo slug 能彻底消除新贡献者与外部构建工具的认知混淆。
3. **待实测事项（Empirical Verification in Phase 17E）**：
   - GitHub Pages 改名后，旧子路径的具体表现（由实测网络请求确定）。
   - Social Preview 当前由 GitHub 动态生成，自定义预览大图的设计与接入需在 Phase 17E 验收后单独规划。
   - CI Secrets / Variables 当前在代码库中未配置自定义项，若未来引入需另行评估。

---

## 6. 回滚与异常应急方案

- **仓库改名回滚**：若改名后出现不可逆异常，在获得授权后执行：
  ```bash
  gh repo rename Chemistry-online-Card-Game -R 9947447-alt/reaction-field --yes
  git remote set-url origin git@github.com:9947447-alt/Chemistry-online-Card-Game.git
  ```
- **代码回滚**：通过 `git revert` 撤销 Phase 17C 相关修改。
- **红线警告**：**严禁删除、移动或覆盖已有 Git Tags**；回滚若需重新部署 Pages，必须发布符合 semver 的新递增版本标签。

---

## 7. 零规则变化与美术延期确认

- **零规则变化确认**：Phase 17 不涉及 `src/game/engine/`、`src/game/data/` 中的任何逻辑改动。
- **美术延期确认**：
  - 68 张实体卡牌独立插画 ➔ **Phase 20–22**
  - 7 位化学家高精全身立绘 ➔ **Phase 20–22**
  - 反应沉淀/气体/光效粒子动画 ➔ **Phase 20–22**
  - 高级暗色材质主题系统 ➔ **Phase 20–22**

---
*本方案作为 Phase 17 品牌与身份迁移的唯一权威依据，即刻冻结。*
