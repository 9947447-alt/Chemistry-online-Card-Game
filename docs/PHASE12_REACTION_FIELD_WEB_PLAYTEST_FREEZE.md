# Phase 12 反应域 Web 公开试玩发布冻结

## 结论与范围

Phase 12 只建立 **反应域（REACTION FIELD）** `0.12.0-alpha.1` 的静态 Web Playtest Alpha 发布闭环；`MVP0-P10` 化学规则、引擎与数据不新增、不改写。

- 试玩为本地同屏双人，双方手牌公开；无账号、存档、回放、遥测、远程错误上报、联网对局或桌面封装。
- 刷新页面会丢失本局；fatal 和全新恢复语义沿用 Phase 11。
- GitHub Pages 是首个静态目标。该 workflow 只在 `web-playtest-v*` 标签 push 时运行；本文件和代码不代为启用 Pages、创建标签或部署。
- 中文品牌“反应域”为主；`REACTION FIELD` 只在配置页品牌区、About、HTML 标题和发布元数据作克制的次级标识。

## 发布前置条件

1. 在仓库 Settings → Pages 将 Source 设为 **GitHub Actions**；此步骤必须由拥有仓库设置权限的人确认。
2. 复核工作区、`pnpm run build`、`pnpm run test:run`、`pnpm run test:shuffle`、`pnpm run test:e2e`、`pnpm run test:e2e:production`、`pnpm run check:production` 和 `pnpm run check:size`。
3. 确认 `package.json` 版本为待发布版本，并执行 `GITHUB_REF_NAME=web-playtest-v<version> pnpm run check:web-playtest-tag`。
4. 经最终公开批准后，创建并 push 精确标签 `web-playtest-v0.12.0-alpha.1`。工作流会先校验标签与 package 版本一致，再构建、测试、上传 `dist` 并部署到 `github-pages` environment。
5. 在 Actions 和 Pages deployment 均成功后，从 deployment 的 `page_url` 取得公开 URL；不要预先承诺地区可达性。

## 回滚与停止公开试玩

- 回滚：选择已验证的上一版本提交，将 `package.json` 版本与新标签严格一致，经相同审批后 push 一个新的 `web-playtest-v<version>` 标签；Pages 只指向最近一次成功部署，不能重写既有标签来伪造回滚。
- 停止公开试玩：先在仓库 Settings → Pages 停用 GitHub Pages 或其发布来源；这才会停止 `github.io` 发布。移除 custom domain 或 DNS 只可作为可选清理，不能替代停止发布；随后在 README/公开入口标注试玩已停止。
- 若发布门禁、标签一致性、产物隔离或浏览器测试失败，停止公开；不得跳过测试、改用浮动 Action 版本、加入秘密变量或扩大权限来强行部署。

## 发布不变量

- 保留 Phase 11 作为历史稳定性与安全恢复基线；Phase 12 不修改其 CI 工作流。
- `dist` 必须无 source map、fixture/private marker 和 root-absolute `/assets`，且相对资源必须同时适用于根路径和 Pages 子路径。
- Pages workflow 使用精确 Node `24.18.0`、pnpm `11.9.0`、锁文件安装和固定 commit SHA 的官方 Actions；不需要任何 secrets。
