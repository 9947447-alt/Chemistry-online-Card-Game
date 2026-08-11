# 反应域 / REACTION FIELD 品牌资产说明

本说明仅记录已冻结品牌资产的网页接入用途，不构成新的规则或发布冻结文档。

## 0.13.0-alpha.3 已公开发布范围

alpha.2 的品牌资产更新包含 01-B 游戏图标、favicon、Apple Touch Icon 与 11-C RF 品牌资产。`web-playtest-v0.13.0-alpha.2` 已存在并保持不变，指向 `57550f70856d5d5e27ac3fcb0fa508cd698d3be6`；其 Pages workflow 因 production E2E 对旧 commit 的固定断言失败，alpha.2 未成功部署，也未完成公开 URL 验收。`0.13.0-alpha.3` 已公开发布，技术版本为 `0.13.0-alpha.3`，规则版本为 `MVP0-P10`，对外阶段名为 Reaction Field Alpha 2；标签 `web-playtest-v0.13.0-alpha.3` 精确 peeled 到 `0f50b2c8011ee108bc4b6ab3178ad4aa0acbe6cd`。公开试玩地址为 [https://9947447-alt.github.io/Chemistry-online-Card-Game/](https://9947447-alt.github.io/Chemistry-online-Card-Game/)，GitHub Release 为 [web-playtest-v0.13.0-alpha.3](https://github.com/9947447-alt/Chemistry-online-Card-Game/releases/tag/web-playtest-v0.13.0-alpha.3)。Pages workflow、部署和简略公开页面验收已成功；不宣称广泛跨浏览器兼容性验收。alpha.1 与 alpha.2 标签永久保持不变，iOS 27 beta Firefox 已知问题仍未修复，本次发布不作修复声明。

## 许可证与品牌资产边界

- 源代码以 Apache License 2.0 发布；`public/brand/**` 不属于 Apache-2.0 源代码授权范围。
- Reaction Field、反应域、REACTION FIELD 名称及官方 Logo 和视觉标识由项目维护者保留；本说明不声称这些名称或标识已经注册为商标。
- 可以为运行未修改的 Reaction Field、引用官方项目、新闻报道、评论或链接而合理展示未修改的品牌资产。
- 不得利用这些资产冒充官方版本、制造认可或背书关系，或使衍生项目与官方项目混淆。
- 不将 “Apache” 用作项目或品牌名称的一部分。

## 资产与用途

- 01-B（`reaction-field-game-icon.svg`）用于游戏图标、SVG favicon、ICO/PNG fallback、Apple Touch Icon 以及配置页主品牌区域的小型装饰图。
- 01-B 单色版（`reaction-field-game-icon-monochrome.svg`）用于单色印刷或高对比环境。
- 11-C（`reaction-field-rf-mark.svg`）保存为未来厂商、官网署名和更新日志的正式品牌资产；本轮不为展示它新增页脚或厂商信息层级。
- 11-C 单色版（`reaction-field-rf-mark-monochrome.svg`）用于单色印刷或高对比署名场景。

## 固定颜色

- 深海军蓝：`#0B1B2B`
- 反应场青绿：`#0F8B83`
- RF 青绿：`#0F7F78`
- 反应高光琥珀：`#F6B73C`
- 浅色卡面：`#F7FAFC`

正式 SVG 是几何源文件。不得拉伸、旋转、重新着色、添加渐变、阴影、动画或额外化学图案；单色版本只能在对应的单色或高对比场景使用。
