# Phase 13 新玩家首局引导冻结与实现边界

## 结论

Phase 13 采用一个独立、非模态的阶段引导面板，集中解释既有 MVP0-P10 的当前阶段、当前参与者、阶段目标与已有操作入口。它是纯展示层，不改变规则、合法性、发布身份或任何游戏状态。实现已经完成并合并；`0.13.0-alpha.3` 已公开发布，对外阶段名为 Reaction Field Alpha 2。

## 权威来源与范围

规则解释以 `docs/MVP0_RULE_FREEZE.md` 为第一权威；角色与会话边界以 `docs/PHASE8_CHARACTER_RULE_FREEZE.md`、`docs/PHASE9_DEBUG_UI_RULE_FREEZE.md` 为准；成功反应事实以 `docs/PHASE10_REACTION_EVENT_RULE_FREEZE.md` 为准；发布边界以 `docs/PHASE12_REACTION_FIELD_WEB_PLAYTEST_FREEZE.md` 为准。

本阶段只覆盖现有本地同屏双人公开试玩：配置、备课、主行动、响应、状态处理、实验反击、对局结束，以及 About 中的首局速查。文案只指向现有 UI 入口和冻结概念；完整规则继续由“关于与帮助”和上述冻结文档承载。

## 方案比较与最终选择

| 方向 | 结果 | 理由 |
| --- | --- | --- |
| 在每个操作面板内散落提示 | 不采用 | 重复跨组件文案，窄屏位置和焦点行为不稳定，容易形成规则漂移。 |
| 独立阶段引导面板 | 采用 | 一个默认可见、可折叠、可跳过的位置可覆盖配置与所有 playing 阶段，并保持 390×844 的正常文档流。 |

配置时，引导位于角色选择操作之前；playing 时，引导位于操作 sidebar 顶部，之后才是备课、主行动、响应、状态与实验反击面板。窄屏不使用浮层、覆盖层、sticky coach mark 或 modal。

## 教学与可访问性合同

- 默认可见；可折叠；可跳过；刷新后重置。跳过只影响当前 React 页面生命周期，不写入 localStorage、sessionStorage、IndexedDB 或网络。
- 跳过后保留同一稳定位置的“重新显示新手引导”普通按钮；折叠、跳过和重新显示均不抢占初始焦点。跳过或重新显示由用户触发后，焦点保留在相应稳定控制上。
- 引导不使用 ModalDialog、自动 focus、coach mark、连续弹窗或 `aria-live`。所有控制均是正常可键盘操作的按钮。
- 文案由现有 `LocalGameSessionState` 与公开 `GameState` 字段派生。允许静态的 phase-to-copy 映射；禁止包含 `canX`、合法性、卡牌匹配、damage/reaction 计算或第二套规则表。

## 冻结阶段文案

| 阶段 | 当前参与者 | 目标与已有入口 | 直接相关概念 |
| --- | --- | --- | --- |
| 配置 | 双方玩家 | 选择“玩家 A”“玩家 B”角色并“开始游戏” | 本地同屏双人、公开手牌、刷新重置；不推荐阵容。 |
| 备课 | 现有 pending 中的选择者 | 在“实验室老师 · 备课”面板选择并“确认备课选择” | 不复制选择数量或合法性。 |
| 主行动 | `activePlayerId` 对应行动者 | 使用“主行动”“主动 DIY”、角色技能或“结束本次行动” | `tableReference` 只说明当前场面基准；不计算关联。 |
| 响应 | `pendingResponse.responderId` 对应响应者 | 使用“响应窗口”显示的入口或“放弃响应” | 响应 DIY 关闭；不列具体卡牌合法性。 |
| 状态处理 | `pendingStatusHandling.playerId` 对应处理者 | 使用“状态处理窗口”显示的入口或“放弃处理” | 不判断可用处理牌。 |
| 实验反击 | `pendingExperimentCounterattack.responderPlayerId` 对应反击者 | 使用“实验反击选择”当前显示的已实现选项 | 真实金属选项延期；不创建选项。 |
| 对局结束 | 既有胜者或平局事实 | 查看公开日志，使用顶部“按当前阵容重开”或“返回角色选择” | 不改变既有结果、重开或返回配置语义。 |

About 首局速查固定说明：响应 DIY 关闭；虚拟 H2O / CO2 不创建 CardInstance；普通实体卡池为 68 张；真实金属、方程式、沉淀与通用反应链延期。

## 不变量、测试与发布边界

- 不修改 `GameState`、`GameAction`、reducer、引擎、数据、starter deck、CardInstance 数量或实例化规则；引导控件仅更新 React 本地可见/折叠状态，且不 dispatch `GameAction`。
- 规则版本严格保持 `MVP0-P10`；应用版本由 `package.json` 唯一提供，当前 Alpha 5 候选为 `0.15.0-alpha.1`，`releaseMetadata` 继续从构建注入值读取版本。Phase 13 引导已在 alpha.1 基线实现并合并，`web-playtest-v0.13.0-alpha.1` 标签永久保持不变。`web-playtest-v0.13.0-alpha.2` 已存在并保持不变，指向 `57550f70856d5d5e27ac3fcb0fa508cd698d3be6`；其 Pages workflow 因 production E2E 对旧 commit 的固定断言失败，alpha.2 未成功部署，也未完成公开 URL 验收。alpha.3 已公开发布，不增加游戏功能或规则；对外阶段名为 Reaction Field Alpha 2，标签 `web-playtest-v0.13.0-alpha.3` 精确 peeled 到 `0f50b2c8011ee108bc4b6ab3178ad4aa0acbe6cd`。当前公开版本为 Reaction Field Alpha 4 / `0.14.0-alpha.1`，标签为 `web-playtest-v0.14.0-alpha.1`；公开试玩地址为 [https://9947447-alt.github.io/Chemistry-online-Card-Game/](https://9947447-alt.github.io/Chemistry-online-Card-Game/)。Alpha 5 预定标签 `web-playtest-v0.15.0-alpha.1` 尚未创建或部署，也未执行公开 URL 验收或创建 GitHub Release。
- 组件测试覆盖七类阶段文案、默认可见、折叠、跳过、重新显示与焦点稳定；Chromium E2E 覆盖配置和真实 reducer 可到达的引导，并以 fixture 覆盖难稳定进入的窗口。桌面与 390×844 均检查无水平溢出、console error、pageerror 与本地静态资源失败。

## 已知兼容性边界

- 在 iOS 27 beta 的 Firefox 中，打开帮助或重开确认框可能进入 `ROOT_RUNTIME_FAILED`。
- 先前的 `requestAnimationFrame` 聚焦实验未解决该问题，未进入稳定分支；失败热修复分支 `fix/ios-firefox-modal-focus-alpha2` 不复制、不合并、不修改。
- Safari 与已测试的 Edge 路径正常属于已有真机/浏览器记录，不代表所有版本的普遍保证。
- 本次 alpha.3 发布不修复也不声称修复 iOS Firefox beta。
