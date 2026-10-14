# Scroll Studio

一个用于前端求职展示的可视化网页编辑器：**Vue 3 + TypeScript strict + Vite + Pinia + Vue Router + GSAP / ScrollTrigger**。在当前目录从零构建，可本地运行，不需要后端或账号。

## 运行

已在 Node.js `22.18.0` / npm `10.9.3` 下验证。建议使用 Node 22 LTS（>=22.12）。

```sh
npm ci
npm run dev
```

默认地址 `http://127.0.0.1:5173/`；首页 `/#/`，编辑器 `/#/editor`，内部预览 `/#/render`。如端口占用，以 Vite 输出地址为准。Hash 路由便于静态托管；当前资源按域名根路径组织。

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

生产产物在 `dist/`。本轮仅本地交付，未部署网站、接入账号或开通外部服务。使用 `npm ci` 保持 lockfile 对应版本；TypeScript 固定在 5.9 系列，避开本次发现的 TS 7 与 vue-tsc 内部入口兼容问题。

## 底座选型

优先审查了 [MyIssue Studio](https://github.com/myissue-studio/vue-website-page-builder)，快照 `390e8a9ca1ba5515b2ec9251fb42dee7e51c3eb6`。它确实使用 Vue 3 + TypeScript，原许可证为 MIT；没有因为错误的语言判断而排除它。

没有采用该底座：HTML 字符串 + DOM 编辑模型与本产品的递归节点树、动画参数持久化目标不匹配。主编辑器和服务规模较大，改造核心比独立实现小型 MVP 更昂贵。上游源码、样式、图片均未复制。具体依赖版本、源码统计、添加/排序实现和协议核验见 [完整审计](docs/UPSTREAM_AUDIT.md)。

**GSAP 许可说明：** GSAP 不是 MIT；现行许可对与 Webflow 竞争的可视化动画工具有专门限制。本地实现不代表已确认此产品对外分发的许可资格。正式发布动画搭建平台之前须确认适用范围。原文链接及分析见审计文档，其他依赖见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。

## 已实现

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
- JSON 导出与校验导入，导入和新建可以撤销。对不合法 URL 不执行，对任意输入文字不使用 v-html。

快速体验：进入工作室 → 拖动「标题」到容器底部 → 修改右侧内容 → 「动画」开启入场 → 点击预览并滚动 → 切换手机视口 → 关闭预览并刷新，草稿仍在。

## 尚未实现及明确边界

- 无多项目/多页面列表；工作区保存一个当前文档，新建会替换它，需长期保留多个作品时使用 JSON 备份。
- 没有自由绝对坐标拖放、画布缩放手柄、网格吸附或任意组件尺寸编辑；位置由布局顺序、容器和间距决定。
- 没有富文本、文件上传、媒体管理、断点独立样式；图片目前编辑 URL。
- 没有多关键帧动画编排、时间轴、pin、跨节点协同时间线或自定义曲线。
- 没有 HTML 导出、线上页面发布、账号、后端、多人协作、支付、订阅或云端同步。
- 桌面 HTML Drag and Drop 是首选；手机端使用点击添加与排序按钮，不承诺原生触摸拖拽兼容。
- 历史最多 60 步，仅在当前编辑会话保留；刷新恢复文档，不恢复 undo 堆栈。
- 本地存储与浏览器/域名绑定，浏览器清理存储会删除草稿；存储故障时可导出 JSON 备份。

## 项目目录

完整手写源文件与配置如下（不展开依赖、构建产物及浏览器测试截图）：

```text
Scroll Studio/
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
│   ├── composables/useDragDrop.ts
│   ├── services/storage.ts
│   ├── stores/editor.ts
│   ├── types/editor.ts
│   ├── styles/global.css
│   ├── components/
│   │   ├── ui/BrandMark.vue
│   │   ├── home/StudioPreview.vue
│   │   └── editor/
│   │       ├── ComponentLibrary.vue
│   │       ├── LayerTree.vue
│   │       ├── NodeRenderer.vue
│   │       ├── PropertyPanel.vue
│   │       └── PreviewOverlay.vue
│   └── views/
│       ├── HomeView.vue
│       ├── EditorView.vue
│       └── RenderView.vue
└── tests/editor.test.ts
```

业务源码仅 `.ts` / `.vue`，Vue SFC 均为 `<script setup lang="ts">`；没有自写 `.js` / `.jsx`。第三方依赖和构建输出的 JavaScript 不属于业务源文件。架构数据流和模块边界见 [ARCHITECTURE](docs/ARCHITECTURE.md)。

## 验证

类型检查、生产构建、Vitest 核心测试和浏览器验收结果见 [VERIFICATION](docs/VERIFICATION.md)。测试覆盖移动、循环嵌套、历史分支、复制、持久化、坏数据和 URL 协议边界。

## 下一阶段

1. 先确认可视化动画编辑产品的 GSAP 授权范围，再决定公开发布路线。
2. 基于现有 `AnimationConfig` 增加动画轨道、关键帧、节点间顺序和时间轴预览，补齐执行器测试。
3. 将布局属性扩展为按断点覆盖的 schema，增加 schema migration、页面集合与 IndexedDB 持久化。
4. 设计静态导出编译器和发布产物规范，验证“编辑 → 保存 → 导入 → 发布”渲染一致性，再接后端。
