# 第三方与原创内容

Scroll Studio 的应用源码、布局、图形与示例文案为本次独立实现。没有复制 MyIssue Studio 源码。该仓库仅作技术审计参考，其 MIT 协议及 commit 记录见 `docs/UPSTREAM_AUDIT.md`。

| 运行时依赖           | 许可来源                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Vue 3                | MIT，保留包内 LICENSE                                                                                               |
| Pinia                | MIT，保留包内 LICENSE                                                                                               |
| Vue Router           | MIT，保留包内 LICENSE                                                                                               |
| @lucide/vue          | ISC，保留包内 LICENSE；图标设计归 Lucide 及贡献者                                                                   |
| GSAP / ScrollTrigger | [GSAP Standard License](https://gsap.com/community/standard-license/)，不是 MIT；可视化动画工具用途的限制见审计文档 |

构建与测试工具按各自包内许可使用，不将依赖的编译 JS 视为自行编写的业务 JS。

0.5 的 `playwright` 为开发测试依赖，使用包内 Apache-2.0 许可；只用于本地与 CI 浏览器检查，不进入网站运行时。

0.4 的 `fake-indexeddb` 为开发测试依赖，使用包内 Apache-2.0 许可；仅用于验证 IndexedDB 事务，不进入产品运行时。作品模板、SVG 布局缩略图与模板文案为本项目自行编写。

`public/images/landscape.svg`、favicon、品牌几何标志和首页 CSS 图形为本项目原创。DM Sans 与 Noto Sans SC 通过 Google Fonts CSS 加载；采用 Google Fonts 分发的开放字体，离线或网络不可用时回退系统字体。未从第三方图库复制图片，也未使用上游品牌素材。

此项目尚未为自行编写的源码选择对外开源许可证；不得把依赖的 MIT 许可或上游 MIT 许可当成整个产品已经获得的授权。
