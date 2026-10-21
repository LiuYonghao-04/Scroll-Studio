# Scroll Studio

一个用于前端求职展示的可视化网页编辑器：**Vue 3 + TypeScript strict + Vite + Pinia + Vue Router + GSAP / ScrollTrigger**。从零构建，可本地运行，不需要后端或账号。

代码仓库：[LiuYonghao-04/Scroll-Studio](https://github.com/LiuYonghao-04/Scroll-Studio)。

公开体验地址：[Scroll Studio](https://LiuYonghao-04.github.io/Scroll-Studio/)。作品仅保存在访问者自己的浏览器里，不会上传云端；清理数据或换设备前请导出 JSON 备份。

## 运行

已在 Node.js `22.18.0` / npm `10.9.3` 下验证。建议使用 Node 22 LTS（>=22.12）。

```sh
npm ci
npm run dev
```

默认地址 `http://127.0.0.1:5173/`；首页 `/#/`，作品库 `/#/projects`，独立作品编辑器 `/#/editor/:projectId`，内部预览 `/#/render`。旧入口 `/#/editor` 会打开最近作品；没有作品时创建初始画布。如端口占用，以 Vite 输出地址为准。Hash 路由便于静态托管；资源与预览路径跟随 Vite BASE_URL，支持 GitHub Pages 子目录。

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

生产产物在 `dist/`。GitHub Pages 通过 Actions 部署公开体验版；无需账号或后端服务。使用 `npm ci` 保持 lockfile 对应版本；TypeScript 固定在 5.9 系列，避开本次发现的 TS 7 与 vue-tsc 内部入口兼容问题。

## 公开体验版部署 · 0.5

推送 `main` 后，GitHub Actions 自动安装锁定依赖、运行 70 项单元测试、严格类型检查、Pages 构建和 Chromium 核心流程检查；全部通过后才部署。PR 执行相同检查，但不发布网站。

```sh
npm run build:pages
npx playwright install chromium
npm run test:smoke
npm run preview:pages
```

`test:smoke` 自行启动并关闭本地生产预览服务，检查首页、首次使用指南、模板创建、编辑、撤销重做、保存与刷新恢复、子目录 iframe / 图片、存储失败阻止离开及重试、错误 JSON 导入、备份往返和手机作品库。截图与下载文件输出到 `output/playwright/pages-smoke/`（不提交）。

首次启用 Pages、回滚、自定义域名与本地数据迁移说明见 [部署指南](docs/DEPLOYMENT.md)。公开可访问不等于 GSAP 用途许可已获确认，许可边界仍见下文说明。

## 底座选型

优先审查了 [MyIssue Studio](https://github.com/myissue-studio/vue-website-page-builder)，快照 `390e8a9ca1ba5515b2ec9251fb42dee7e51c3eb6`。它确实使用 Vue 3 + TypeScript，原许可证为 MIT；没有因为错误的语言判断而排除它。

没有采用该底座：HTML 字符串 + DOM 编辑模型与本产品的递归节点树、动画参数持久化目标不匹配。主编辑器和服务规模较大，改造核心比独立实现小型 MVP 更昂贵。上游源码、样式、图片均未复制。具体依赖版本、源码统计、添加/排序实现和协议核验见 [完整审计](docs/UPSTREAM_AUDIT.md)。

**GSAP 许可说明：** GSAP 不是 MIT；现行许可对与 Webflow 竞争的可视化动画工具有专门限制。本地实现不代表已确认此产品对外分发的许可资格。正式发布动画搭建平台之前须确认适用范围。原文链接及分析见审计文档，其他依赖见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。

## 已实现

- 0.5 公开体验准备：GitHub Pages 自动检查与部署、子目录资源及预览兼容、首次使用指南、常驻本地存储与备份说明、生产浏览器流程检查。指南使用原生 dialog，支持键盘焦点约束、Esc 关闭和关闭后再次查看。
- 中文 SaaS 首页：非对称 Hero、原创编辑器示意图、创作流程、滚动动画实验、设计灵感画廊、行动入口及手机导航。画廊明确标注为灵感展示，不宣称可一键加载模板。
- GSAP 入场、文字淡入、视差、ScrollTrigger 时间线；响应 `prefers-reduced-motion`，切换路由清理动画。
- 三栏编辑器：组件库 / 图层树、画布、属性与动画面板；小屏侧栏可切换。
- 创建空白页、重命名；容器、标题、段落、图片、按钮五种基础组件。
- 鼠标原生拖拽添加，选区标签或图层树拖动已有组件；插入排序、跨容器移动、嵌套容器、防循环嵌套。
- 修改文字、图片 URL / alt、按钮文案 / 链接、文字与背景颜色、字体、字号、内外边距、圆角、容器间距、对齐、横向/纵向布局。
- 实时文本编辑、共享渲染器、桌面/平板/手机设计视口与独立 iframe 预览。
- 上移/下移、复制、删除、撤销/重做；Ctrl/Cmd+Z、Shift+Ctrl/Cmd+Z、Ctrl+Y、Ctrl/Cmd+S。表单输入中保留原生编辑快捷键。
- 900ms 自动保存、本机草稿恢复、显式存储失败提示；数据版本与完整结构校验。
- 超出第一阶段的小型动画闭环：配置位移、缩放、旋转、透明度、时长、触发线和 scrub；保存参数后在预览实际执行。
- 第二阶段动画编排：每个组件 2–12 个关键帧，编辑帧位置、位移、缩放、旋转、透明度及四种曲线；共享时间轴支持轨道开始时间、时长、鼠标拖动和方向键微调。
- 0.3 精确编排：直接拖动关键帧菱形、拉伸轨道两端、0.1s 吸附 / Alt 0.01s 精调、1–8× 缩放与水平滚动；拖动实时显示时间，松手提交一次历史，Esc / 取消手势放弃操作。
- 0.4 作品库：新建、搜索、重命名、复制、删除、独立作品地址、最后修改时间和布局缩略图；IndexedDB 保存文档与缩略图，自动迁移原有单页草稿并保留旧备份。
- 三个可编辑模板：个人作品集、产品介绍、滚动叙事；也可创建空白作品。模板生成真实组件树、链接和动画参数，复制时重建 ID 并修正内部引用。
- 保存队列、离开前写入、关闭页面恢复草稿，以及版本冲突检查；切换作品清空历史和选区，防止跨作品撤销或延迟保存写回已删除记录。
- 独立触发 / 共享时间轴两种播放方式；共享触发元素、触发线、滚动距离和 scrub 可持久化。预览支持滚动体验与时间轴试播，提供播放、暂停、进度定位和重播。
- schema v2 自动迁移 v1 本地草稿与 JSON 备份；迁移读取不会覆盖原始数据，保存后写入新格式。无滚动空间的页面仍保持内容可见。
- JSON 导出与校验导入：作品库导入生成独立作品；编辑器内导入替换当前作品内容并可撤销。对不合法 URL 不执行，对任意输入文字不使用 v-html。

快速体验：进入作品库 → 新建作品 → 选择模板 → 编辑文字与动画 → 保存 → 从页面菜单返回「我的作品」→ 复制或打开另一件作品。每件作品独立保存；布局缩略图是根据内容生成的 SVG 示意图，非像素截图。

详细使用方法、数据迁移与动画语义见 [动画编排说明](docs/ANIMATION_EDITOR.md)。
作品管理、恢复和存储边界见 [作品库说明](docs/PROJECT_LIBRARY.md)。

## 尚未实现及明确边界

- 每件作品目前是一张单页，没有单一作品内的多页面站点路由；作品库支持多件独立作品。删除需确认，删除后无法撤销，需长期留档时导出 JSON。
- 没有自由绝对坐标拖放、画布缩放手柄、网格吸附或任意组件尺寸编辑；位置由布局顺序、容器和间距决定。
- 没有富文本、文件上传、媒体管理、断点独立样式；图片目前编辑 URL。
- 没有 pin、多场景时间轴、循环/yoyo、贝塞尔自定义曲线、拖动时自动横向滚动或多个轨道同时选中；精确数值也可在右侧面板编辑。
- 没有 HTML 导出、用户作品的独立线上发布、账号、后端、多人协作、支付、订阅或云端同步。GitHub Pages 托管的是编辑器体验网站，不会自动托管访问者的作品。
- 桌面 HTML Drag and Drop 是首选；手机端使用点击添加与排序按钮，不承诺原生触摸拖拽兼容。
- 历史最多 60 步，仅在当前作品编辑会话保留；刷新或切换作品清空 undo 堆栈。
- 本地存储与浏览器/域名绑定，浏览器清理存储会删除草稿；存储故障时可导出 JSON 备份。

## 项目目录

完整手写源文件与配置如下（不展开依赖、构建产物及浏览器测试截图）：

```text
Scroll Studio/
├── .gitattributes
├── .gitignore
├── .prettierrc.json
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── THIRD_PARTY_NOTICES.md
├── 任务要求.md                    # 保留用户原始要求
├── docs/
│   ├── UPSTREAM_AUDIT.md
│   ├── ARCHITECTURE.md
│   ├── ANIMATION_EDITOR.md
│   ├── PROJECT_LIBRARY.md
│   └── VERIFICATION.md
├── public/
│   ├── favicon.svg
│   └── images/landscape.svg
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── router.ts
│   ├── animation/runtime.ts
│   ├── core/document.ts
│   ├── core/motion.ts
│   ├── core/timeline-edit.ts
│   ├── core/templates.ts
│   ├── core/thumbnail.ts
│   ├── composables/useDragDrop.ts
│   ├── composables/useTimelineDrag.ts
│   ├── services/storage.ts
│   ├── services/projects.ts
│   ├── stores/editor.ts
│   ├── stores/projects.ts
│   ├── types/editor.ts
│   ├── types/project.ts
│   ├── styles/global.css
│   ├── styles/editor-motion.css
│   ├── styles/projects.css
│   ├── components/
│   │   ├── ui/BrandMark.vue
│   │   ├── home/StudioPreview.vue
│   │   ├── projects/ProjectCreateDialog.vue
│   │   └── editor/
│   │       ├── ComponentLibrary.vue
│   │       ├── LayerTree.vue
│   │       ├── NodeRenderer.vue
│   │       ├── PropertyPanel.vue
│   │       ├── MotionPanel.vue
│   │       ├── TimelinePanel.vue
│   │       ├── TimelineTrack.vue
│   │       └── PreviewOverlay.vue
│   └── views/
│       ├── HomeView.vue
│       ├── EditorView.vue
│       ├── ProjectsView.vue
│       └── RenderView.vue
└── tests/
    ├── editor.test.ts
    ├── motion.test.ts
    ├── timeline-edit.test.ts
    └── projects.test.ts
```

业务源码仅 `.ts` / `.vue`，Vue SFC 均为 `<script setup lang="ts">`；没有自写 `.js` / `.jsx`。第三方依赖和构建输出的 JavaScript 不属于业务源文件。架构数据流和模块边界见 [ARCHITECTURE](docs/ARCHITECTURE.md)。

## 验证

类型检查、生产构建、Vitest 核心测试和浏览器验收结果见 [VERIFICATION](docs/VERIFICATION.md)。测试覆盖移动、循环嵌套、历史分支、复制、持久化、坏数据和 URL 协议边界。

## 下一阶段

1. 先确认可视化动画编辑产品的 GSAP 授权范围，再决定公开发布路线。
2. 在已完成的关键帧、共享时间轴和精确拖动基础上增加多场景编排、多选和自动横向滚动，补充持续执行的浏览器回归测试。
3. 在作品库和 IndexedDB 基础上，将布局属性扩展为按断点覆盖的 schema，增加作品内的多页面集合与资源管理。
4. 设计静态导出编译器和发布产物规范，验证“编辑 → 保存 → 导入 → 发布”渲染一致性，再接后端。
