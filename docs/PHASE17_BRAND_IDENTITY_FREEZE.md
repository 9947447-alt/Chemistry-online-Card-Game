# Phase 17 反应域品牌与仓库身份迁移方案冻结

## 1. 结论、目标与明确非目标

本文件正式冻结 Reaction Field 品牌统一与仓库身份迁移方案（Phase 17），确立项目从代号 `Chemistry-online-Card-Game` 全面收敛至正式品牌 **反应域 / Reaction Field** 的规范与实施路线。

### 1.1 核心目标
1. 统一中英文正式品牌、UI 装饰徽标、仓库 slug、包名及发布元数据。
2. 将 GitHub 仓库 slug 迁移为 `reaction-field`（有效备用：`reaction-field-card-game`）。
3. 同步 `package.json` 中的 `"name": "reaction-field"`，保持包名与仓库 slug 100% 同构。
4. 确立应用内静态仓库链接 `src/app/projectRepository.tsx` 及关联测试契约的迁移规范与 post-rename cutover 机制。
5. 确立 GitHub Pages 目标 URL `https://9947447-alt.github.io/reaction-field/` 与验收标准。
6. 补齐 GitHub 仓库公开元数据（Description、Topics）；社区规范指引文件与更广泛的仓库社区健康建设明确延期至未来独立阶段，不作为 Phase 17 完成准则（Community guidance files and broader repository community-health work are deferred to a later independently scoped phase and are not Phase 17 completion criteria）。
7. 明确外部授权边界、改名实施顺序、Post-rename 代码链接切换、Release 版本准备、实测验证项与安全回滚策略。

### 1.2 明确非目标（边界红线）
1. **零游戏规则变化**：严格保持 `MVP0-P10` 规则版本、68 张普通实体卡池、7 位角色定义、统一伤害管线、主动 DIY 虚拟攻击与结构化反应事件，不新增、不改写任何游戏机制。
2. **禁止虚假化学表述**：不得将当前规则机制描述为未经规则书确认的“真实化学模拟”；正式定位统一定义为“基于化学主题的策略卡牌游戏”。
3. **禁止大范围 UI 重构与美术接入**：整套 UI 皮肤重设计、68 张卡牌独立插画、7 位角色高精度立绘、反应粒子与动画特效严格延期至 Phase 20–22（Visual Polish + Beta Hardening）。
4. **禁止修改历史冻结文档**：`docs/MVP0_RULE_FREEZE.md` 及 Phase 8 至 Phase 16 既有冻结文档保持不可变。
5. **禁止重写 Git 历史或既有 Release**：所有既有 Git Tags（如 `web-playtest-v0.12.0-alpha.1` ~ `web-playtest-v0.16.0-alpha.1`）与既有 GitHub Releases 保持不可变，严禁移动、删除、覆盖、复用或重新推送。
6. **README 聚焦必要修正**：Phase 17 README 仅做必要中英文定位副标题对齐、已发布状态事实修正与基础结构对齐，不做过度营销重写。
7. **禁止新增社区规范文件**：不创建 CONTRIBUTING、SECURITY、CODE_OF_CONDUCT、SUPPORT 等社区文件，不修改 GitHub Community Profile 配置，社区健康建设延期至后续独立阶段。
8. **禁止提前制造失效链接（404 Window）**：在仓库 rename 真正完成前，严禁提前将生产代码与文档中的 live 仓库链接切换为新 slug；在 Pages 部署与验收完成前，严禁提前将公开试玩入口切换为新 Pages URL。

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
| **有效备用 Slug** | `reaction-field-card-game` | 仅当首选 slug 在授权实施时发生冲突，经用户明确批准并完成内部身份同步回退流程后启用 |
| **npm Package Name** | `reaction-field` | `package.json` 中的 `"name"` 字段 |
| **当前公开仓库 URL** | `https://github.com/9947447-alt/Chemistry-online-Card-Game` | 当前真实生效的 GitHub 仓库地址（在 Phase 17D 改名与 cutover 前保持不变） |
| **目标仓库 URL** | `https://github.com/9947447-alt/reaction-field` | 规划目标仓库地址（target / planned URL，改名与 cutover 前非 live 仓库链接） |
| **备用目标仓库 URL** | `https://github.com/9947447-alt/reaction-field-card-game` | 仅当首选 slug 冲突并完成回退流程后作为目标仓库地址 |
| **当前公开 Pages URL** | `https://9947447-alt.github.io/Chemistry-online-Card-Game/` | 当前真实可用的线上试玩入口（在 Phase 17D 改名、部署与 Phase 17E 验收完成前保持不变） |
| **目标 Pages URL** | `https://9947447-alt.github.io/reaction-field/` | 规划目标地址（target / planned URL，切流前非当前公开入口） |
| **一句话英文定位** | `An open-source chemistry-themed local two-player card game with tactical reactions and emergent strategy.` | GitHub Repo Description、README 英文副标题 / Introduction（Phase 17C 对齐） |
| **一句话中文定位** | `一款基于化学主题的开源本地同屏双人策略卡牌游戏。` | README.zh-CN 中文副标题 / 介绍（Phase 17C 对齐） |
| **Release 标题模板** | `Reaction Field Alpha <N> — v<version>` | 例如：`Reaction Field Alpha 6 — v0.16.0-alpha.1` |
| **Release Tag 契约** | `web-playtest-v<version>` | 例如：`web-playtest-v0.16.0-alpha.1`（严格保持不变，部署 Tag 必须与 `package.json.version` 一致） |
| **Pages 浏览器标题** | `反应域 · REACTION FIELD · Web Playtest Alpha · <version> · <rulesVersion>` | 由 Vite 构建插件自动注入 HTML `<title>` |

---

## 3. 文件处理分类原则

### 3.1 活动文件（Active Files）

#### A. Phase 17C（Pre-rename 内部身份与安全文档准备阶段）活动文件
- `package.json`：修改 `"name": "reaction-field"`（包名与目标 slug 内部对齐）。
- `README.md` & `README.zh-CN.md`：
  1. 对齐冻结的中英文 positioning 副标题（见第 2 节品牌规范表）；
  2. 修正已过时的 Alpha 6 预发布描述，对齐已在 GitHub 发布的真实事实；
  3. 进行必要品牌名称对齐，不做过度营销重写；
  4. **严格保护**：必须继续保留当前 live 仓库链接 `https://github.com/9947447-alt/Chemistry-online-Card-Game` 与 live Pages 链接 `https://9947447-alt.github.io/Chemistry-online-Card-Game/`。
- `docs/MVP_PLAN.md`：更新 Phase 17 路线图进度与目标仓库/Pages URL 规划记录，保留当前公开事实。
- `docs/CODEX_CAPABILITIES.md`：增补 Phase 17 审计快照与最新能力，保留历史记录。
- *明确保护*：Phase 17C **严禁**修改 `src/app/projectRepository.tsx`、`src/app/projectRepository.test.tsx`、`e2e/production/reaction-field.spec.ts`、`e2e/tests/debug-alpha.spec.ts` 中的 live 仓库 URL，必须继续指向 `Chemistry-online-Card-Game`。

#### B. Post-rename 阶段（仓库改名后 Link Cutover 阶段）活动文件
- `src/app/projectRepository.tsx`：更新 `projectRepositoryUrl` 为实际生效的新仓库 URL（`https://github.com/9947447-alt/reaction-field` 或 fallback URL）。
- `src/app/projectRepository.test.tsx`：更新测试断言中预期的仓库 URL。
- `e2e/production/reaction-field.spec.ts`：更新 E2E 生产测试中的仓库链接断言。
- `e2e/tests/debug-alpha.spec.ts`：更新 E2E 测试中的仓库链接断言。
- `README.md` & `README.zh-CN.md`：更新仓库外链为实际生效的新仓库 URL；公开 Pages 试玩入口严格保持当前真实可用地址 `https://9947447-alt.github.io/Chemistry-online-Card-Game/`，直至新 Pages 部署与公网验收完成。
- `docs/MVP_PLAN.md`：更新仓库 URL 状态为已生效。

#### C. Release Preparation 阶段（新版本部署前版本准备阶段）活动文件
- `package.json`：在获得独立发布授权后递增 `"version"` 字段，确保与后续部署 Tag 严格对齐。
- 精确版本测试断言文件清单（必须随版本号同步更新）：
  1. `e2e/production/reaction-field.spec.ts`（About 弹窗与生产页面版本号断言）
  2. `e2e/tests/debug-alpha.spec.ts`（状态条版本文本断言）
  3. `scripts/check-production.test.mjs`（构建产物 HTML `<title>` 预期版本断言）
  4. `scripts/check-web-playtest-tag.test.mjs`（Tag 校验逻辑与预期版本断言）
  5. `src/app/releaseMetadata.test.tsx`（应用内 package metadata 版本断言）

#### D. Post-deployment Acceptance 阶段（Pages 部署与验收后公开入口收口阶段）
- `README.md` & `README.zh-CN.md`：在 Phase 17D 仓库改名完成 + Release 版本准备合并 + Pages 部署成功 + Phase 17E 公网验收通过后，正式将公开试玩入口切换至生效的新 Pages URL。
- `docs/MVP_PLAN.md`：更新公开试玩入口记录为新 Pages URL。

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

## 4. Phase 17 实施拆分子阶段与时序模型

整体实施时序必须严格遵循 9 阶段确定性发布状态机：
`Phase 17C (Pre-rename 内部身份与安全文档准备)` → `Phase 17D (GitHub 仓库改名与设置)` → `Post-rename (代码库链接正式切换 Cutover)` → `Release Preparation (版本准备与测试断言同步)` → `Release-Source 严格校验与本地 Annotated Tag 创建` → `不可变 Tag 推送与 GitHub Actions Pages 部署工作流` → `Phase 17E (真实公网验收与烟测)` → `GitHub Release 独立创建与发布` → `README 公开试玩入口切流与收口`

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Phase 17C: Pre-rename 内部身份与安全文档准备                         │
│ - package.json name -> reaction-field                                  │
│ - README 中英文 subtitle 对齐与 Alpha 6 状态事实修正                    │
│ - live 仓库链接与 live Pages 链接保持 Chemistry-online-Card-Game            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ merge to integration branch
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Phase 17D: GitHub 仓库改名与设置 (独立外部授权边界)                 │
│ - gh repo rename reaction-field (冲突时进入闭环 Fallback 回退流程)     │
│ - 平台查询确认 active slug -> 执行对应分支 description / topics / remote│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ rename confirmed
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Post-rename: 代码库仓库链接正式切换 (Link Cutover)                  │
│ - src/app/projectRepository.tsx -> 生效新仓库 URL                       │
│ - 单元测试 / E2E / README 仓库链接对齐                                 │
│ - 独立 commit 授权 -> 独立 push 授权 -> CI -> merge                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ cutover merged
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Release Preparation: 版本准备与测试断言同步                         │
│ - 确定新版本号 -> package.json version 递增 -> 5 个版本测试断言文件同步 │
│ - 本地验证 -> 双重授权 -> CI -> merge 到集成分支                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ version bump merged
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. Release-Source 严格校验与本地 Annotated Tag 创建                    │
│ - git fetch origin <integration-branch>                                │
│ - 校验 cutover 与 bump commit 为集成分支 HEAD 祖先提交                 │
│ - 校验远端快照 package.json.version 与新 Tag 精确匹配                   │
│ - 显式绑定 target commit SHA 创建 annotated tag & 校验 peeled SHA      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ verified & push authorized
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 6. 不可变 Tag 推送与 GitHub Actions Pages 部署工作流                   │
│ - git push origin web-playtest-v<version> (不可变资产，严禁覆盖/删除)   │
│ - Actions 自动触发 check:web-playtest-tag 门禁、构建与 Pages 部署      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ pages deploy success
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 7. Phase 17E: 真实公网访问与烟测验收                                   │
│ - 真实浏览器访问目标 Pages URL / 资源路径 / Title / 外链 / 烟测对局    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ acceptance passed
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 8. GitHub Release 独立创建与发布 (独立外部授权边界)                    │
│ - gh release create web-playtest-v<version> (标题模板严格对齐规范)     │
│ - 声明：Pages workflow 仅部署站点不建 Release，需独立授权操作           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ release published
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 9. 公开入口切流收口 (Public Entrypoint Switch)                         │
│ - 四要素齐全后，提交 PR 将 README 公开试玩入口切至新 Pages URL          │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Phase 17C：代码库内 Pre-rename 内部身份与安全文档准备
- **前置本地基线与集成分支只读核验**：
  在开始 Phase 17C 之前，必须执行本地工作区与远端集成分支的双重只读检查（与 `AGENTS.md` 规则一致）：
  ```bash
  pwd
  git rev-parse --show-toplevel
  git branch --show-current
  git rev-parse HEAD
  git status --short
  git ls-remote origin refs/heads/release/phase15-alpha5-web-playtest-alpha1 refs/heads/main
  git rev-parse origin/release/phase15-alpha5-web-playtest-alpha1
  ```
  确认处于正确的仓库根目录、正确的集成分支、HEAD 匹配且工作区干净。若活动集成分支发生变化，必须停止并向用户报告，严禁擅自改用 `main` 或在 dirty 工作区直接修改。
- **执行范围**：
  1. 修改 `package.json` 中的 `"name"` 为 `"reaction-field"`。
  2. 修改 `README.md` 和 `README.zh-CN.md`：
     - 对齐第 2 节规范表中的中英文一句话定位副标题；
     - 修正已过时的 Alpha 6 预发布描述（明确 Alpha 6 已发布事实）；
     - 保留所有 live 仓库链接与 live Pages 链接。
  3. 修改 `docs/MVP_PLAN.md` 中对应的目标 Pages/仓库 URL 规划与 Phase 17 路线图记录。
  4. 修改 `docs/CODEX_CAPABILITIES.md` 增补审计快照。
- **Live Link 保护与禁止范围**：
  1. **严禁提前修改 live 仓库链接**：`src/app/projectRepository.tsx`、`src/app/projectRepository.test.tsx`、`e2e/production/reaction-field.spec.ts`、`e2e/tests/debug-alpha.spec.ts` 中的 live 仓库链接必须继续保留当前真实生效地址 `https://github.com/9947447-alt/Chemistry-online-Card-Game`，严禁在仓库改名完成前提前修改为新 slug。
  2. **严禁提前修改 live Pages 链接**：公开 Pages 试玩入口严格保留当前真实可用地址 `https://9947447-alt.github.io/Chemistry-online-Card-Game/`。
  3. 禁止修改游戏规则、引擎逻辑、组件结构；禁止修改历史冻结文档；禁止执行 GitHub 远端写操作；禁止创建社区规范文件。
- **本地完整验证与双重授权门禁**：

  **阶段 A：修改完成、Commit 之前（Pre-commit 内容与格式验证）**
  ```bash
  pnpm run build
  pnpm run test:run
  pnpm run test:shuffle
  pnpm run test:e2e
  pnpm run test:e2e:production
  pnpm run check:production
  pnpm run check:size
  git diff --check
  ```
  执行变更文件白名单核对、保护/规则文件零 diff 核对及人工 diff review。此阶段工作区存在本轮修改，**不得**执行 `pnpm run check:tracked-clean`，严禁为了让 clean 检查通过而 stash、reset、checkout 或隐藏本轮修改。

  **阶段 B：停止并获取 Commit 明确授权 ➔ 本地 Commit ➔ Post-commit 干净度验证**
  - **STOP & Report**：向用户报告验证结果与 diff，获取明确的 Commit 授权（实施授权不等于 Commit 授权）；
  - 执行 `git add` 与 `git commit`；
  - 运行 Post-commit 门禁：
    ```bash
    pnpm run check:tracked-clean
    ```
    确认 commit 完成后 tracked working tree 处于干净状态。

  **阶段 C：停止并获取 Push 明确授权 ➔ Push ➔ CI ➔ Merge**
  - **STOP & Report**：向用户报告 commit SHA，获取明确的 Push 授权（Commit 授权不等于 Push 授权）；
  - 执行普通 push；
  - 验证 CI 全绿后，提交 PR 并合并至集成分支。

### 4.2 Phase 17D：GitHub 仓库设置与改名实施（独立外部授权边界）
> [!IMPORTANT]
> Phase 17D 涉及 GitHub 平台层面的全局修改，**必须作为单独授权边界**，未经用户显式授权不得执行。

- **前置依赖与集成分支验证**：
  1. Phase 17C 代码变更必须先合并到当时明确指定的活动发布集成分支（当前冻结时为 `release/phase15-alpha5-web-playtest-alpha1`）。
  2. 在执行 Phase 17D 前，必须通过 `git ls-remote origin refs/heads/release/phase15-alpha5-web-playtest-alpha1` 重新只读确认集成分支状态。若后续正式切换到新的集成分支，必须在执行 Phase 17D 前重新只读确认并取得授权。不得预设 `main` 分支已包含当前 Alpha 6 发布基线。
- **改名与参数化 Post-rename 指令序列**：
  1. **执行仓库重命名（首选 Slug）**：
     ```bash
     gh repo rename reaction-field -R 9947447-alt/Chemistry-online-Card-Game --yes
     ```
  2. **通过 GitHub 平台查询核实生效的 active slug**：
     在重命名完成后，由于本地 `origin` 尚未配置，**必须通过平台查询**（如 `gh repo view --json name -q .name`）确认当前实际生效的远端仓库 slug（`reaction-field` 或 `reaction-field-card-game`），严禁依赖尚未更新的本地 `git remote -v`。
  3. **执行对应分支的 Description / Topics / Remote 更新**：
     - **Primary branch（若 active slug 为 `reaction-field`）**：
       ```bash
       gh repo edit 9947447-alt/reaction-field --description "An open-source chemistry-themed local two-player card game with tactical reactions and emergent strategy." --add-topic card-game --add-topic chemistry --add-topic react --add-topic typescript --add-topic board-game --add-topic playtest
       git remote set-url origin git@github.com:9947447-alt/reaction-field.git
       ```
     - **Fallback branch（若 active slug 为 `reaction-field-card-game`）**：
       ```bash
       gh repo edit 9947447-alt/reaction-field-card-game --description "An open-source chemistry-themed local two-player card game with tactical reactions and emergent strategy." --add-topic card-game --add-topic chemistry --add-topic react --add-topic typescript --add-topic board-game --add-topic playtest
       git remote set-url origin git@github.com:9947447-alt/reaction-field-card-game.git
       ```
     *(严禁同时执行两套指令；必须先验证 active slug 后选择唯一定向分支。更新后可通过 `git remote -v` 验证本地 remote)*
- **停止条件与备用 Slug 回退流程（Fallback Procedure）**：
  若在执行 `gh repo rename reaction-field ...` 时发生名称冲突（422 / Already exists），必须严格按以下完整流程回退，严禁直接在远端改用备用 slug 而导致本地代码与远端 slug 产生 package/repository/Pages slug 不一致：

  - **Step 1（立即停止）**：Phase 17D 立即停止，不得继续执行后续 GitHub 设置、Pages 或 remote 修改。
  - **Step 2（报告冲突）**：向用户明确报告首选 slug `reaction-field` 存在冲突。
  - **Step 3（获得明确授权）**：必须获得用户明确批准将 `reaction-field-card-game` 作为正式备用 slug。
  - **Step 4（返回内部身份同步阶段）**：获得批准后**不得**直接继续 Phase 17D，必须返回代码库内部身份同步阶段，重新同步由 slug 派生的活动身份：
    1. `package.json` 中的 `"name": "reaction-field-card-game"`
    2. 目标 Pages/仓库 URL 规划值（`https://9947447-alt.github.io/reaction-field-card-game/` 及对应仓库 target）
    3. `docs/MVP_PLAN.md` 中的相关身份与目标 URL 记录
    4. *重要*：在 fallback 仓库实际改名成功前，**live 仓库链接与 live Pages 链接仍继续保持 `Chemistry-online-Card-Game`**，不得提前切换。
  - **Step 5（重新完成本地验证与双重授权合并边界）**：重新完成本地全量验证（阶段 A 构建、测试、diff 核对）→ 获取 Commit 授权 → 本地 commit → 阶段 B clean 验证 → 获取 Push 授权 → push → CI 门禁通过 → PR review & merge 到集成分支。
  - **Step 6（重新进入 Phase 17D 执行备用 Slug 远端改名）**：只有在备用 slug 的内部身份同步已全部合并至集成分支后，才重新进入 Phase 17D，经授权后使用显式备用 slug 执行重命名指令：
    ```bash
    gh repo rename reaction-field-card-game -R 9947447-alt/Chemistry-online-Card-Game --yes
    ```
    随后通过平台查询确认 active slug 为 `reaction-field-card-game`，并执行对应的 Fallback branch 配置更新。

  完整闭环流程：`primary slug collision` → **STOP** → **report** → **explicit fallback approval** → **return to repository identity sync** → **update all slug-derived values** → **validate** → **commit auth** → **commit** → **clean** → **push auth** → **push** → **CI** → **merge** → **re-enter Phase 17D** → **rename repository using fallback slug**。严格防止产生 `package name != repository slug`、`repository slug != Pages slug` 或 `app link != repository slug` 的身份分裂。

### 4.3 Post-rename 阶段：代码库仓库链接正式切换（Repository-Link Cutover）
- **定位**：发生在 GitHub 仓库改名成功**之后**、新版本 Pages 部署**之前**的独立代码修改边界。
- **执行范围**：
  1. 修改 `src/app/projectRepository.tsx` 中的 `projectRepositoryUrl` 为实际生效的新仓库 URL：
     - 若首选 slug 生效：`https://github.com/9947447-alt/reaction-field`
     - 若 fallback slug 生效：`https://github.com/9947447-alt/reaction-field-card-game`
  2. 修改 `src/app/projectRepository.test.tsx` 单元测试断言。
  3. 修改 `e2e/production/reaction-field.spec.ts` 与 `e2e/tests/debug-alpha.spec.ts` 中的 E2E 仓库链接断言。
  4. 修改 `README.md` 与 `README.zh-CN.md` 中的仓库外链为实际生效的新仓库 URL（公开 Pages 试玩入口继续保留 live 地址 `https://9947447-alt.github.io/Chemistry-online-Card-Game/` 直至 Pages 部署与公网验收完成）。
  5. 修改 `docs/MVP_PLAN.md` 中对应仓库 URL 记录为已生效。
- **代码库正常修改与合并流程**：
  必须经过标准工作流：只读基线核对 → 白名单文件修改 → 本地全量验证（阶段 A 构建、测试、E2E、diff 核对）→ 获取 Commit 授权 → 本地 commit → 阶段 B clean 验证 → 获取 Push 授权 → push → CI 门禁通过 → PR review & merge 到集成分支。
- **部署前置要求**：新的 Pages 部署产物**必须**来自已经合并了 post-rename link cutover 的 commit，严禁在 cutover 合并前提前触发 Pages 部署，否则线上产物仍将携带旧仓库链接。

### 4.4 Release Preparation、Tag 创建、Pages 部署、Phase 17E 验收与 GitHub Release

#### 4.4.1 Release Preparation（发布与版本准备阶段）
- **契约约束**：`.github/workflows/phase12-web-playtest-pages.yml` 中的 `check:web-playtest-tag` 门禁强制要求 Tag 必须精确等于 `web-playtest-v${package.json.version}`。鉴于 `web-playtest-v0.16.0-alpha.1` 已随 Alpha 6 发布并作为不可变历史资产保护，若迁移后需创建新 Tag 部署 Pages，**必须先完成版本准备并合并**：
  1. **版本号确定与授权**：在独立发布授权边界下确定新的单调递增版本号（具体版本由发布边界决定，本冻结文档不预设具体值）；
  2. **代码库版本与测试断言同步**：修改 `package.json` 中的 `"version"` 字段，并同步更新 5 个关联的精确版本测试断言文件：
     - `e2e/production/reaction-field.spec.ts`
     - `e2e/tests/debug-alpha.spec.ts`
     - `scripts/check-production.test.mjs`
     - `scripts/check-web-playtest-tag.test.mjs`
     - `src/app/releaseMetadata.test.tsx`
  3. **本地验证**：执行全量构建与测试验证（`pnpm run build`、`pnpm run test:run`、`pnpm run test:e2e` 等）；
  4. **双重授权合并**：获取 Commit 授权 ➔ Commit ➔ 阶段 B clean 验证 ➔ 获取 Push 授权 ➔ Push ➔ CI 通过 ➔ PR 合并至活动集成分支（当前为 `release/phase15-alpha5-web-playtest-alpha1`）。

#### 4.4.2 Release-Source 严格校验与本地 Annotated Tag 创建
> [!IMPORTANT]
> 在创建不可变发布 Tag 前，必须执行严格的 Release-Source 校验契约，严禁在未经验证的 commit 或脏本地直接创建/推送 Tag。

- **Release-Source 校验契约（6 步执行序列）**：
  1. **Fetch 集成分支**：
     ```bash
     git fetch origin <integration-branch>
     ```
  2. **获取远端目标 Commit SHA**：
     ```bash
     TARGET_SHA=$(git rev-parse origin/<integration-branch>)
     ```
  3. **祖先关系校验（Ancestry Verification）**：
     验证 Post-rename link cutover commit 与 Release Preparation bump commit 确为远端目标 commit 的祖先提交：
     ```bash
     git merge-base --is-ancestor <cutover_commit_sha> ${TARGET_SHA}
     git merge-base --is-ancestor <version_bump_commit_sha> ${TARGET_SHA}
     ```
  4. **远端快照版本校验（Remote Snapshot Version Check）**：
     直接从远端目标 commit 读取 `package.json` 快照，确认版本号与待发布的 `<version>` 精确匹配：
     ```bash
     git show ${TARGET_SHA}:package.json | grep '"version"'
     ```
  5. **显式绑定 Target SHA 创建本地 Annotated Tag**：
     ```bash
     git tag -a web-playtest-v<version> ${TARGET_SHA} -m "Release Reaction Field Alpha <N> — v<version>"
     ```
  6. **Tag Peeled Commit SHA 校验**：
     ```bash
     TAG_PEELED_SHA=$(git rev-parse "web-playtest-v<version>^{commit}")
     ```
     验证 `${TAG_PEELED_SHA}` 严格等于 `${TARGET_SHA}`。
- **Tag Push 独立授权门禁**：
  校验完成后，向用户报告 `${TARGET_SHA}`、Tag 名称及 Tag message，申请独立 Tag Push 明确授权。

#### 4.4.3 不可变 Tag 推送与 GitHub Actions Pages 部署工作流
- **Tag 推送**：
  获取用户显式授权后，推送新 Tag：
  ```bash
  git push origin web-playtest-v<version>
  ```
- **不可变资产红线**：
  Tag 一旦推送到远端即成为不可变发布凭证，严禁移动、覆盖、删除、复用或重新推送 `web-playtest-v0.16.0-alpha.1` 及后续任意版本标签。
- **GitHub Actions 触发与门禁**：
  推送将自动触发 `.github/workflows/phase12-web-playtest-pages.yml`，执行 `check:web-playtest-tag` 门禁核验、生产构建与 Pages 静态站点部署。
- **独立性声明**：
  GitHub Actions Pages workflow 仅负责构建并部署 Pages 静态站点，**不会也不会替代 GitHub Release 的创建**。

#### 4.4.4 Phase 17E：真实公网验收（Acceptance Checklist）
只有在 GitHub Actions Pages 部署成功且 Phase 17E 公网页面实测通过后，才能宣称 Pages 迁移完成。
- **验收清单（7 项）**：
  1. **新 Pages 试玩 URL**：访问目标 Pages URL（`https://9947447-alt.github.io/reaction-field/`，若启用备用 slug 则为对应 fallback URL），确认 HTTP 200，页面正常渲染。
  2. **旧 Pages URL 实测**：访问 `https://9947447-alt.github.io/Chemistry-online-Card-Game/`，记录实际状态（不预设 100% 必然失效，真实记录是 404 还是被重定向）。
  3. **静态资源相对路径**：确认 CSS、JS、SVG 图标（`reaction-field-game-icon.svg`）正常加载，无 `/assets/` 根绝对路径 404。
  4. **HTML Title**：确认浏览器标签页标题精确为 `反应域 · REACTION FIELD · Web Playtest Alpha · <version> · MVP0-P10`。
  5. **仓库外链**：在 About 弹窗与结算页点击 GitHub 链接，确认直接打开实际生效的新仓库 URL（`https://github.com/9947447-alt/reaction-field` 或 fallback URL），无 404。
  6. **反馈入口**：点击 Microsoft Forms 链接，确认正常打开且无自动私密数据泄露。
  7. **双人对局 Smoke Test**：在真实浏览器中完成一次角色选择与开局出牌流程，确认功能完整。

#### 4.4.5 GitHub Release 独立创建与发布（独立外部授权边界）
- **独立授权契约**：
  在 Pages 部署成功且 Phase 17E 公网验收全部通过后，向用户申请独立的 GitHub Release 创建授权。
- **Release 创建指令与参数契约**：
  ```bash
  gh release create web-playtest-v<version> \
    --title "Reaction Field Alpha <N> — v<version>" \
    --notes "<release_notes_markdown>" \
    --target <target_commit_sha> \
    --prerelease
  ```
- **契约要求**：
  1. 标题模板必须精确匹配第 2 节规范表：`Reaction Field Alpha <N> — v<version>`；
  2. Tag 严格使用已推送到远端的 `web-playtest-v<version>`；
  3. 目标 commit 显式指定经过验证的 `<target_commit_sha>`；
  4. 正式完成 GitHub 平台 Release 资产发布。

#### 4.4.6 公开入口切流收口（Public Entrypoint Switch）
- **切流前置四要素（全部满足后方可切流）**：
  1. Phase 17D GitHub 仓库改名与设置已完成；
  2. GitHub Actions Pages 工作流部署成功；
  3. Phase 17E 真实公网 7 项验收全部通过；
  4. 对应版本的 GitHub Release 已正式创建并发布。
- **切流执行**：
  在四要素全部齐备后，提交独立收口 PR，将 `README.md`、`README.zh-CN.md` 及 `docs/MVP_PLAN.md` 中的公开试玩入口切换至新 Pages URL。

---

## 5. 事实、推断与实测边界声明

1. **已验证事实（Verified Facts）**：
   - **集成分支与基线**：当前 Phase 17 活动发布集成分支为 `release/phase15-alpha5-web-playtest-alpha1`，其 Alpha 6 目标基线 Commit 为 `c3fe28bf2c40df4243d8c262ccfdc320c6224cee`（`chore(release): prepare Alpha 6 pre-release`），处于干净状态。
   - **main 分支状态**：当前 `main` 分支 HEAD 为 `c889ffa761089684414b3e0cf0456a7b4744e238`，不是当前 Alpha 6 发布集成分支的 source of truth。
   - **已发布 Release 与 Tag 事实**：`web-playtest-v0.16.0-alpha.1` 标签与 `Reaction Field Alpha 6` 预发布版本已于 2026-08-15T04:34:15Z 在 GitHub 平台真实发布。README / MVP_PLAN 中保留的“尚未创建该标签”字样属于发布前的过时文档状态，不改变平台真实发布事实。该标签严格作为不可变历史资产保护，严禁移动、覆盖或复用。
   - **远端 Slug 状态**：`9947447-alt` 账号下 `reaction-field` 与 `reaction-field-card-game` 目前均为空闲状态（HTTP 404）。
   - **产物相对路径构建**：`vite.config.ts` 使用 `base: "./"`，构建产物天生适配任意子路径。
2. **合理推断（Logical Inferences）**：
   - GitHub 对重命名后的仓库 Web 页面（`github.com/...`）提供自动 301 重定向。
   - 统一 package name 与 repo slug 能彻底消除新贡献者与外部构建工具的认知混淆。
3. **待实测与平台配置确认事项（Empirical Verification & Platform Checks）**：
   - GitHub Pages 改名后，旧子路径的具体表现（由实测网络请求确定，不预设 100% 必然失效）。
   - 当前是否配置了自定义 GitHub Social Preview，无法仅凭仓库源码和普通只读仓库 API 完全证明；Phase 17D 前必须在 GitHub Settings 中人工或通过可靠接口确认。
   - 仓库源码不能证明 GitHub Actions Secrets/Variables 的完整平台配置状态。Secrets 的值不得读取、输出或记录；Phase 17D 只需确认相关 Secret/Variable 名称及工作流引用是否会受到仓库改名影响。不得把源码状态等同于平台状态。

---

## 6. 回滚与异常应急方案

### 6.1 仓库改名回滚（Repository Rename Rollback）
若仓库改名后出现不可逆异常需要回滚，必须按以下**严格顺序**执行，严禁猜测或硬编码 primary slug：

1. **Step 1（通过平台查询核实当前实际生效的 active slug）**：
   在执行回滚前，必须先通过平台只读命令（如 `gh repo view --json name -q .name`）确认当前实际生效的远端仓库 slug，只能是 `reaction-field` 或 `reaction-field-card-game` 之一。
2. **Step 2（执行授权改名回滚指令）**：
   - 若当前 active slug 为 `reaction-field`：
     ```bash
     gh repo rename Chemistry-online-Card-Game -R 9947447-alt/reaction-field --yes
     ```
   - 若当前 active slug 为 `reaction-field-card-game`：
     ```bash
     gh repo rename Chemistry-online-Card-Game -R 9947447-alt/reaction-field-card-game --yes
     ```
   *(不得同时执行两条指令)*
3. **Step 3（核实远端仓库名恢复）**：
   只读确认远端仓库名已成功恢复为 `Chemistry-online-Card-Game`。
4. **Step 4（恢复本地 remote URL）**：
   远端改名回滚成功后，再更新本地主仓库 remote URL（所有 linked worktree 自动共享）：
   ```bash
   git remote set-url origin git@github.com:9947447-alt/Chemistry-online-Card-Game.git
   ```
5. **Step 5（验证 remote 状态）**：
   只读验证 `git remote -v` 与 `git ls-remote` 正确指向 `Chemistry-online-Card-Game`。严禁在远端改名回滚成功前提前修改 local remote，防止产生 local/remote 分裂。

### 6.2 代码与身份回滚规范（Code & Identity Rollback）
- 仓库改名回滚不会自动撤销代码与文档变更。
- **完整回滚集合发现**：回滚前必须先通过实际 Phase 17 merge diff 与 commit 历史发现完整变更集合，不得仅依赖手工枚举。
- **包名与代码身份恢复范围**：若此前已合并了 post-rename link cutover 或 Phase 17C 代码，必须通过独立代码回滚边界（`git revert` 或经审阅的回滚 commit）完整恢复所有已切换的代码、测试、README、规划文档及公开 URL 元数据：
  1. `src/app/projectRepository.tsx` 中的仓库链接恢复为 `https://github.com/9947447-alt/Chemistry-online-Card-Game`
  2. `src/app/projectRepository.test.tsx` 单元测试断言恢复
  3. `e2e/production/reaction-field.spec.ts` 与 `e2e/tests/debug-alpha.spec.ts` 中的 E2E 仓库链接断言恢复
  4. `package.json` 中的 `"name"` 恢复为 `"Chemistry-online-Card-Game"`
  5. `README.md` 与 `README.zh-CN.md` 中的仓库外链与 Pages 入口恢复（严禁出现仓库已退回旧名但文档仍指向新 slug 的半回滚状态）
  6. `docs/MVP_PLAN.md` 中的仓库 URL 与 Pages URL 记录恢复
  7. 经 merge diff 发现的其他所有 slug 派生活动值恢复
  - 严禁 hard reset，严禁历史重写；必须重新完成本地构建与测试验证、获取 Commit 授权、获取 Push 授权、PR review 和 merge 流程。

- **版本号回滚边界与单调性保护（Version Rollback Boundaries）**：
  > [!IMPORTANT]
  > 必须显式区分 Pre-tag 回滚与 Post-tag/Post-release 回滚，严禁破坏 SemVer 版本号的不可变性与单调递增性。
  - **Pre-tag 回滚（未打 Tag 前）**：若仅处于 Release Preparation 阶段，代码修改尚未创建或推送 Tag，在发现问题时可通过 `git revert` 或重新提交将 `package.json.version` 调整或复原为准备前的版本号。
  - **Post-tag / Post-release 回滚（Tag 已推送或 Release 已发布后）**：**一旦不可变 Tag 推送至远端或 Release 已在平台发布，该版本号永久消耗**。严禁在回滚中使用 `git revert` 将 `package.json.version` 倒退回历史旧版本号（例如严禁将版本号从 `0.17.0-alpha.1` 倒退为 `0.16.0-alpha.1`，这会破坏单调性并引发下游构建缓存与 Tag 冲突）。若回滚需要重新构建并部署 Pages，**必须分配一个全新的、单调递增的 SemVer 版本号**（例如新 patch 版本 `v0.16.1-alpha.1` 或 `v0.17.1-alpha.1`），走完整的 Release Preparation 流程并打新 Tag 部署。
  - **发布与 Tag 红线**：**严禁删除、移动、覆盖或复用已有 Git Tags**。

### 6.3 5 大标准故障恢复分支规约（Five Standard Failure Recovery Branches）

| 故障分支 | 触发阶段与典型场景 | 标准化处理规约 |
| :--- | :--- | :--- |
| **Branch 1: Failure before tag creation / push**<br>(Tag 创建或推送前失败) | Release Preparation 本地/CI 验证失败，或 Release-Source 校验失败（如 ancestry 校验不通过、远端快照版本与 Tag 不匹配）。 | 1. 立即终止发版流程，不创建/不推送 Tag；<br>2. 在集成分支或本地修正代码，或提交 `git revert` 撤销版本 bump commit；<br>3. 在未打 Tag 推送前，版本号允许复用或重新递增；<br>4. 重新完成全量构建测试与 PR 合并门禁。 |
| **Branch 2: Failure after tag push, before deploy completes**<br>(Tag 已推送但 Actions 未触发或排队阻塞) | Tag 已推送到远端，但 GitHub Actions 平台未触发工作流、webhook 丢失或 runner 队列发生死锁。 | 1. **严禁删除、移动或重新推送同名 Tag**（已推送 Tag 为不可变发布凭据）；<br>2. 通过平台命令（`gh run list --workflow=phase12-web-playtest-pages.yml`）排查运行状态；<br>3. 若属 GitHub 平台临时抖动，通过 `gh run rerun <run_id>` 重新运行工作流；<br>4. 若属工作流配置自身缺陷需要改动代码，必须在集成分支提交修复、递增全新版本号走新发版流程，严禁复用当前 Tag。 |
| **Branch 3: Pages deployment workflow failure**<br>(Pages 构建或部署流水线报错失败) | GitHub Actions 运行中 `check:web-playtest-tag` 门禁报错、`pnpm run build` 失败、E2E 测试失败或 Pages 部署步骤异常退出。 | 1. **已推送 Tag 永久保留作为失败构建记录，严禁删除/覆盖**；<br>2. 分析 Actions 构建日志定位报错根因；<br>3. 在集成分支提交修复 PR 并合并；<br>4. 分配全新的单调递增版本号，重新走完整 Release 流程打新 Tag 重新部署。 |
| **Branch 4: Deployment success but Phase 17E acceptance failure**<br>(部署成功但公网验收未通过) | GitHub Actions 部署成功，但在 Phase 17E 真实公网验收中发现静态资源 404、About/结算页仓库外链失效、JS 报错或 smoke test 失败。 | 1. **绝对禁止执行 README 公开入口切流**（确保用户继续访问稳定可用的旧 Pages 入口）；<br>2. 已推送 Tag 永久保留；<br>3. 排查公网环境特异性失效根因并在集成分支提交修复 PR；<br>4. 分配新的单调递增版本号，重新走发版与 Tag 部署流程；<br>5. 只有新版本公网验收 100% 全部通过后，才允许进行公开入口切流。 |
| **Branch 5: Release published & traffic switched, then critical defect discovered**<br>(全量发布切流后发现致命缺陷紧急回滚) | GitHub Release 已发布且公开入口已切流，随后在生产环境发现规则破坏、重大数据异常或严重安全/运行时崩溃缺陷。 | 1. 评估是否需要仓库改名回滚（如涉及 slug 冲突/合规）或仅需代码回滚；<br>2. 提交代码回滚 PR；<br>3. **严禁在 `package.json` 中将版本号回退为历史旧版本**，必须分配全新的单调递增 patch 版本号（例如 `v0.17.1-alpha.1`）；<br>4. 完成验证并合并回滚代码；<br>5. 经 Release-Source 校验创建新 Tag 并推送，完成 Pages 部署与公网验收；<br>6. 在 GitHub 平台将有缺陷的旧 Release 编辑标记为 `[Deprecated / Superseded]`，并发布新的 patch Release；<br>7. 提交 PR 将 README 公开试玩入口指向新的可用状态。 |

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
