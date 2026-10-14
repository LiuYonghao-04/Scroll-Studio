# 开源底座审计

审计日期：2026-10-13。对象：[MyIssue Studio / vue-website-page-builder](https://github.com/myissue-studio/vue-website-page-builder)。

本次通过真实 `git clone --depth 1` 检查源码，不以 README 的功能描述代替实现证据。快照 commit：`390e8a9ca1ba5515b2ec9251fb42dee7e51c3eb6`；package version：`3.5.85`。未运行上游依赖安装、构建与端到端测试，以下结论属于源码与架构审计。

| 项目            | 核验结果                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 框架            | `peerDependencies.vue: ^3.3.0`，开发依赖 Vue `^3.5.40`，Vite `^6.2.4`。符合 Vue 3 方向。                                                                                                                                                                                                                                                                                  |
| TypeScript      | `src` 中 102 个 `.ts`、91 个 `.vue`；Vue SFC 的脚本声明为 `script setup lang="ts"`。`tsconfig.app.json` 明确 `allowJs: false`，继承 `@vue/tsconfig`，没有在该文件显式声明 strict。本次未安装上游依赖核验继承配置的最终展开值。                                                                                                                                            |
| JavaScript 源码 | `git ls-tree -r --name-only HEAD` 未发现 `.js/.jsx`；但 `PageBuilderPreview.vue` 中存在注入导出 HTML 的内联脚本字符串。不能把“没有 .js 文件”等同于“完全没有手写 JS 片段”。                                                                                                                                                                                                |
| 状态及依赖      | Pinia `~2.1.7`；TipTap 3、Tailwind 3、uuid、date-fns。属于 Vue 技术生态；未发现当前产品需要的 Vue Router 和 GSAP 配置。引入新依赖可行，但需要补齐。                                                                                                                                                                                                                       |
| 核心内容模型    | `src/types/index.ts` 的 `ComponentObject` 以 `id / html_code / title` 为核心；服务维护 DOM 引用、HTML、CSS class 和编辑工具状态。并非我们需要的递归强类型组件树。                                                                                                                                                                                                         |
| 添加与排序      | 添加组件使用 HTML 组件数组。`PageBuilderService.ts:3675` 的 `reorderComponent(direction)` 使用数组 `splice`、`nextTick` 和 DOM 高亮；工具栏调用上下移动。在本次快照搜索 `dragstart / dragover / ondrop / draggable / sortable`，只看到遗留 sortable 样式，没有核验到可直接复用的原生拖拽或 Sortable 运行时。不把 README 的 Drag & Drop 文案作为完整拖拽能力已验证的证据。 |
| 动画扩展        | 可以对 HTML 节点附加属性，但可视化参数类型、节点身份、历史记录、保存与预览执行的一致性需要重新建立。改造成 JSON 树会触及核心服务与渲染方式。                                                                                                                                                                                                                              |
| 结构与维护成本  | 主 `PageBuilder.vue` 2,177 行；`PageBuilderService.ts` 6,356 行。已有大量 HTML 编辑、SEO、电商和媒体相关逻辑，对当前求职作品 MVP 形成较大的理解与裁剪成本。规模本身不等于质量差，但与本项目目标不匹配。                                                                                                                                                                   |
| 许可证          | `LICENSE` 为 MIT，版权署名 `Copyright (c) 2024 MyISSUE Studio`；如复制其代码或实质部分，需要保留版权及许可声明。                                                                                                                                                                                                                                                          |

## 决策

**不采用、不 fork、不安装该底座，从零实现 Scroll Studio。** 原因是数据模型和扩展成本，而不是错误地认为它没有 TypeScript。

Scroll Studio 自行实现了 schema、Pinia 事务、递归渲染、原生拖拽、组件库、属性面板、历史记录、校验、存储和动画运行时。未复制上游源文件、模板、样式或图像，因而不存在基于上游文件的修改清单。

## 可复核证据

- [依赖声明](https://github.com/myissue-studio/vue-website-page-builder/blob/390e8a9ca1ba5515b2ec9251fb42dee7e51c3eb6/package.json)
- [类型定义](https://github.com/myissue-studio/vue-website-page-builder/blob/390e8a9ca1ba5515b2ec9251fb42dee7e51c3eb6/src/types/index.ts)
- [核心服务](https://github.com/myissue-studio/vue-website-page-builder/blob/390e8a9ca1ba5515b2ec9251fb42dee7e51c3eb6/src/services/PageBuilderService.ts)
- [TypeScript 配置](https://github.com/myissue-studio/vue-website-page-builder/blob/390e8a9ca1ba5515b2ec9251fb42dee7e51c3eb6/tsconfig.app.json)
- [原始 MIT 许可证](https://github.com/myissue-studio/vue-website-page-builder/blob/390e8a9ca1ba5515b2ec9251fb42dee7e51c3eb6/LICENSE)

## GSAP 的独立许可边界

GSAP 3.15.0 的 package 元数据指向 [Standard “No Charge” GSAP License](https://gsap.com/community/standard-license/)，**不是 MIT**。

本次核验的条款第 I 节定义了与 Webflow 可视化动画能力竞争的无代码动画工具限制，第 III 节要求该类用途事先取得书面同意；FAQ 说明一些不直接竞争的细分可视化工具可以使用，并建议有疑问时联系确认。

Scroll Studio 的长期“可视化滚动动画编辑器”方向与此限制可能相关，不能仅凭“免费”或“求职作品”推定已经获准。当前交付为本地原型，未公开发布或声称获得商业授权。公开分发或商业化前，应向许可方确认具体产品范围；首页使用 GSAP 的普通展示动画与编辑器产品用途应分别评估。动画执行逻辑集中在 `src/animation/runtime.ts`，便于在授权确认后继续扩展或由用户决定替换实现。此次没有擅自替换要求的 GSAP 技术栈。
