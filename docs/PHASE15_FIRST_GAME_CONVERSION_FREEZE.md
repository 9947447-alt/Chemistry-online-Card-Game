# Phase 15 首局转化与玩法可理解性冻结

## 结论与范围

Phase 15 只调整展示层信息层级、静态玩法示例、成功反应即时提示和 GitHub 公共入口。该实现已通过 PR #7 合入 `main`；当前分支只准备 Reaction Field Alpha 5 / `0.15.0-alpha.1` 的版本身份、发布文档和精确测试契约。规则版本继续为 `MVP0-P10`；本轮不修改 Phase 15 产品实现、游戏规则、引擎、数据、卡池、默认阵容或发布基础设施。

Phase 15 实现已经合并，但 Alpha 5 尚未发布或部署。预定标签 `web-playtest-v0.15.0-alpha.1` 尚未创建，Pages 部署、公开 URL 验收和 GitHub Release 均未发生；在新标签部署前，公开 Pages 继续运行 Reaction Field Alpha 4 / `0.14.0-alpha.1`。当前 Web Playtest 的规则权威继续是 `docs/MVP0_RULE_FREEZE.md` 及 Phase 8–13 冻结文档。

## 配置页与引导

配置页顺序冻结为：release bar；品牌与一句话玩法说明；玩家 A/B 角色选择、阵容摘要和开始按钮；一句话当前目标；默认折叠的详细引导；默认折叠的三步玩法示例；七角色资料。

- `guidance.goal` 始终可见；actor、操作入口、相关概念和完整帮助入口默认折叠。
- 折叠、展开、隐藏和重新显示继续使用普通按钮，保留 `aria-expanded`、`aria-controls` 与用户触发后的稳定焦点。
- 引导不自动聚焦，不使用 modal、coach mark、storage、网络或 `GameAction`。
- playing sidebar 仍先显示当前目标，再显示既有阶段操作面板；不改变面板顺序或合法性。
- 三步示例只说明“出牌、响应、反应与记录”的界面流程，不判断卡牌合法性，不承诺每次出牌产生反应，不 dispatch action，也不提供策略建议。

## 成功反应提示

即时提示的唯一数据路径为：`GameState.log[]` → `GameLogEntry.reaction` → `SuccessfulReactionEvent` → `getPublicReactionLogView(...)`。

- 只显示最新且尚未展示的结构化成功反应；不解析普通日志 `message`。
- 覆盖 `acid_base_neutralization`、`acid_carbonate_co2` 和 `so2_alkaline_absorption`，包括 SO2 的即时多目标响应与状态处理两条正式 trigger。
- `FIRE`、普通日志、pass、非法 action 和没有结构化事件的行为不触发。
- 提示约 2000ms 后由 timer 清除；新事件重置 timer；卸载或没有 reaction 的新会话清理提示。
- 提示使用 `role="status"` 与 polite announcement，不获取焦点、不遮挡控件、不阻断输入。永久记录仍保留在公开日志。
- `prefers-reduced-motion: reduce` 下关闭非必要动画；内容和 timer 生命周期不依赖动画。

## 公共入口与隐私

- About 与 `gameOver` 各提供一个指向 `https://github.com/9947447-alt/Chemistry-online-Card-Game` 的普通 `<a>`，使用 `target="_blank" rel="noopener noreferrer"`。
- 不使用 iframe、预取、preconnect、fetch、XHR、sendBeacon、`window.open`、跟踪参数或运行时数据拼接。
- Microsoft Forms endpoint、页头入口、隐私说明和零自动数据传递边界保持不变；GitHub 与 Forms 不合并为数据组件。

## 规则手册与默认阵容

- Core Rulebook 只能作为 Extended tabletop reference；本阶段不接入页面。
- Ion Reactions & DIY Manual 与当前 Web 规则冲突过多；本阶段不得公开链接。
- 不宣称 OneDrive 在线内容已经验证。
- 默认阵容保持玩家 A“实验室老师”、玩家 B“化工厂 CEO”；初始化、备课、HP、手牌、deck 和角色规则不变。

## 媒体、体积与发布边界

本阶段只使用 HTML/CSS 文本示例，不新增图片、GIF、MP4、WebM、poster 或字幕文件，不增加外部请求，不提高任何 size limit。

Phase 15 产品实现不得修改 `src/game/engine/**`、`src/game/data/**`、`src/game/tests/**`、`ModalDialog.tsx`、Forms endpoint、依赖和锁文件、品牌资源、Vite/Playwright 配置、CI、标签、Release、Pages 或 iOS Firefox 热修复。Alpha 5 候选准备仅更新 `package.json.version`、发布文档及必要的精确版本测试；`releaseMetadata.ts` 继续从 `package.json` 读取版本。iOS 27 beta Firefox 的已知问题仍未验证修复。
