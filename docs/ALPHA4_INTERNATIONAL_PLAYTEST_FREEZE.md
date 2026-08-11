# Alpha 4 国际试玩展示层冻结

本文件仅冻结 Reaction Field Alpha 4 的展示层与反馈入口边界；不修改 MVP0–P10、Phase 8–13 的游戏规则、引擎、数据、卡池或发布身份。

## 展示语言

- 既有完整简体中文界面继续保留。
- React 页面生命周期内可手动切换简体中文和 English；初始建议只读取 `navigator.languages` / `navigator.language`，任一首选语言以 `en` 开头时建议 English，否则建议简体中文。
- 手动选择不使用浏览器存储、URL、cookie、网络 API 或遥测；刷新后重新采用浏览器语言建议。
- `<html lang>` 随当前展示语言更新为 `zh-CN` 或 `en`。
- 英文名称只能由稳定角色、卡牌定义、技能、DIY、状态或 reaction ID，以及既有结构化展示模型导出；不得解析中文字符串、普通日志或 `rulesText`，也不得复制 reducer 逻辑。
- 普通 engine 正式日志、debug `rulesText`、技术 ID、错误码、应用版本和规则版本继续保持原有合同。英文模式必须明确普通正式日志目前仍为简体中文。

## Forms 反馈入口

- 唯一 Forms 配置位于 `src/app/feedback.tsx`；它只渲染静态普通 `<a>`，并以 `target="_blank" rel="noopener noreferrer"` 打开。
- 入口位于全局页头，README 也提供同一填写者链接。不会使用 `window.open`、fetch、XHR、sendBeacon、自动提交、预填 query 参数、运行时数据拼接或遥测。
- 游戏不向 Forms 传递手牌、日志、角色、浏览器信息、错误诊断、语言偏好或任何 `GameState` 内容；About 仅保留双语隐私说明，不重复反馈链接。
- 缺少配置时不渲染可点击入口；不得使用 `#` 或备用站点。

## 保留边界

- 不修改 `src/game/engine/**`、`src/game/data/**`、`src/game/tests/**`、`ModalDialog` 焦点逻辑、版本、锁文件、发布元数据、Vite/Playwright 配置、品牌资源、CI、标签、Release、Pages 或 GitHub 设置。
- 不声称已修复 iOS 27 beta Firefox 的已知 modal/root failure；该问题不在 Alpha 4 范围。
