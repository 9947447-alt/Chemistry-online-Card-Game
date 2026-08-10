# 仓库协作规则

本文件适用于本仓库根目录的当前主工作树。开始任务前先确认边界：

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
```

若根目录不是本仓库，或状态与任务假设不符，应先停止并报告。保护用户已有改动：不得覆盖、清理、回滚或重置无关内容，也不得读取或修改其他 linked worktree。

## 查找顺序

1. 先查本任务相关的 `docs/CODEX_PITFALLS.md`。
2. 规则问题先查 `docs/MVP0_RULE_FREEZE.md`，再查适用的 `docs/PHASE8_CHARACTER_RULE_FREEZE.md`、`docs/PHASE9_DEBUG_UI_RULE_FREEZE.md`、`docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md`、`docs/PHASE12_REACTION_FIELD_WEB_PLAYTEST_FREEZE.md`、`docs/PHASE13_NEW_PLAYER_GUIDANCE_FREEZE.md`，最后参考 `docs/MVP_PLAN.md`。
3. 代码问题从 `src/game/engine/types.ts` 和 `src/game/engine/reducer.ts` 开始，再查 `src/game/data`、`src/features/local-game` 及对应测试。
4. 入口依赖从 `src/main.tsx`、`src/app` 和 `src/features/local-game/LocalGamePage.tsx` 追踪。

## 已确认的保护不变量

- 普通实体卡池为 68 张。
- `event_lab_fire` 不进入普通卡池，也不应被创建为普通 `CardInstance`。
- `src/game/engine/reducer.ts` 是正式游戏 action reducer 入口。
- fatal 会话不得继续暴露旧的可交互 `GameState`；恢复必须创建匹配阵容的新状态，或返回角色选择。

不要绕过正式 reducer、会话边界或既有规则冻结来“修复”测试夹具或 UI。

## 命令与验证

命令和质量能力以当前 `package.json`、锁文件和适用 CI 配置为准，使用前重新核验。不得虚构不存在的 script、测试、审计或 CI 门禁。当前审计快照中的命令和能力见 [`docs/CODEX_CAPABILITIES.md`](docs/CODEX_CAPABILITIES.md)。

修改后按范围运行相关验证；无法运行时明确列出未验证项。不得把未实际运行的测试、构建、审计或部署报告为通过。

只有经过代码、测试、日志、CI 或可复现步骤验证的项目特异性问题，才能加入 `docs/CODEX_PITFALLS.md`；推测应留在“待验证候选”。

不得自动提交、推送、创建或移动 Git 标签、部署，除非用户明确要求。不得安装依赖或联网扩大任务范围。不得读取、复制或输出 `.env`、密钥、令牌、凭据及其他敏感内容；跳过 `node_modules`、构建产物、测试产物和 `.git` 内部对象。

详细能力矩阵见 [`docs/CODEX_CAPABILITIES.md`](docs/CODEX_CAPABILITIES.md)，踩坑与验证边界见 [`docs/CODEX_PITFALLS.md`](docs/CODEX_PITFALLS.md)。
