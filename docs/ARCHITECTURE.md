# Scroll Studio 架构

## 数据流

组件库 / 属性面板 / 拖拽 → Pinia 事务 → `PageDocument` → `NodeRenderer`。

保存将同一 document 序列化到 localStorage；预览将同一 document 通过同源 postMessage 发给独立 iframe。iframe 再次做 schema 校验，用相同 `NodeRenderer` 渲染，随后挂载动画。编辑画布始终展示终态，预览才运行动画，因此隐藏、位移和拖拽状态互不干扰。

`PageNode` 的稳定 UUID 关联图层、选区、父子关系与动画目标。只有 section 可以包含 children，其他节点是叶节点。正文通过 Vue 插值渲染，不执行导入 HTML。链接和图片地址按协议白名单过滤。

## 状态与历史

- 事务先在副本执行，验证成功后整体替换 document；无变化的操作不会生成历史。
- 历史保留最近 60 个文档快照；撤销后新修改清空 redo 分支。
- 文本连续输入在 750ms 内按节点/字段合并为一条历史，停止输入后重新开始计组。属性即时反映到画布。
- 移动前检查目标是容器，且不位于被移动节点的后代中。列表内向后移动会修正删除带来的索引偏移。
- 创建新页面也是事务，可撤销返回原页面。当前不是多项目管理器。

## 持久化

localStorage key：`scroll-studio:document:v1`。修改后 900ms 防抖自动保存；手动保存和离开编辑器也会尝试保存。使用 Node schema version `1`。异常只显示错误，不伪造“已保存”。读取失败保留原始损坏数据；自动保存不会主动覆盖该错误状态下的草稿，手动保存表示用户选择保存当前画布。

损坏草稿的保护使用独立的 `recoveryRequired` 状态，关闭错误提示不会解除保护。普通导入失败不会暂停后续自动保存；退出、卸载和防抖保存都走 `autosave()`，只有显式保存或成功导入备份后才解除损坏草稿保护。手机端也可从页面菜单手动保存。

JSON 导入限 2MB、500 个节点、深度 0–12；校验重复 ID、组件类型、枚举、数值区间、颜色与动画参数。导入失败不会替换当前文档。图片采用 URL 引用，不把二进制图片塞进 localStorage。

## 预览与响应式

- 设计画布宽度：1120、768、390px；编辑区根据可用空间用 CSS zoom 适配显示。
- 预览 iframe 具有真实独立视口，不以缩小桌面 DOM 假冒手机页面。
- 渲染器使用容器查询：小于 600px 时容器改纵向、标题最大 36px、正文最大 18px、容器内边距最大 24px。
- 暂无每个断点独立的样式覆盖。手机可点击添加、通过按钮排序；精细拖拽以桌面鼠标为主。
- 预览消息同时校验 origin 和 source。关闭预览清理 message 监听，页面重建或卸载清理动画。

## 动画

首页：GSAP 进场 stagger、编辑器示意图视差、区块 reveal、滚动控制的旋转/缩放 timeline、画廊图像视差。原生滚动，不劫持滚轮。

编辑器：每节点可保存 enabled、x、y、scale、rotation、opacity、duration、trigger、scrub。参数表达“从起始状态进入设计终态”。`ScrollTrigger` 使用 clamp 约束触发边界，避免页面底部组件的触发位置不可达。开启 scrub 时动画进度由滚动距离决定，duration 对此模式不作时间控制。

两处动画均使用 GSAP matchMedia，在 `prefers-reduced-motion` 下保持内容可见、停止动效，并通过 revert 清理。第一版不含多关键帧、跨元素时间线、pin、复杂 easing 编辑器或生产发布编译器。
