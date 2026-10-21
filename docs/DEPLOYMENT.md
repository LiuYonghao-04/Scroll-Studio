# GitHub Pages 部署

目标地址：<https://LiuYonghao-04.github.io/Scroll-Studio/>。

部署整个编辑器应用，无需云服务器、自购域名、后端或额外部署密钥。发布状态以 [Actions](https://github.com/LiuYonghao-04/Scroll-Studio/actions) 和实际网址为准。

## 构建与发布

1. 仓库 Settings → Pages → Source 选择 GitHub Actions（也可使用拥有管理权限的 API 设置 `build_type: workflow`）。
2. 推送 main，或在 Actions 手动运行 Verify and deploy GitHub Pages。
3. build job 顺序运行 `npm ci`、`npm test`、`npm run build:pages`、安装 Chromium / Firefox / WebKit、`npm run test:smoke:all`。每种引擎执行完整流程，其中任何一项失败都不部署。
4. 检查通过后上传 dist，deploy job 使用 Pages 和 OIDC 权限发布。PR 仅检查，不部署。

Actions 固定到已核验的官方 action commit；Node 使用 22 系列。CI 失败不会发布失败构建，原有线上版本仍保留。

0.7 构建先执行独立动画运行文件编译与版权说明生成，再构建编辑器。禁止跳过 `build:runtime` 直接将缺少 public/export-runtime 的产物发布。`test:smoke` 额外下载 ZIP，检查 file://、静态 HTTP 子目录、图片、响应式、动画、减弱动态效果、禁用 JavaScript、取消和失败，以及两个示例模板。

## 本地复现

```sh
npm ci
npm test
npm run build:pages
npx playwright install chromium firefox webkit
npm run test:smoke:all
npm run preview:pages
```

预览地址为 `http://127.0.0.1:4173/Scroll-Studio/`。冒烟脚本自行管理服务，不要同时占用 4173 端口。Linux 如缺浏览器系统库，使用 `npx playwright install --with-deps chromium firefox webkit`。单独检查某种引擎时设置 `SMOKE_BROWSER`（chromium / firefox / webkit）后运行 `npm run test:smoke`，默认 Chromium；输出目录按引擎区分。

使用 `SMOKE_BASE_URL` 可以对真实部署执行同一组检查；脚本使用全新的浏览器上下文，创建的数据仅存在该隔离上下文，不会改动其他访问者的作品。

```powershell
$env:SMOKE_BASE_URL = 'https://LiuYonghao-04.github.io/Scroll-Studio/'
npm run test:smoke:all
Remove-Item Env:SMOKE_BASE_URL
```

## 子目录与数据边界

`build:pages` 设置 base 为 `/Scroll-Studio/`；首页图片、节点默认图片、旧 JSON 默认图片和预览 iframe 都使用同一个 base。用户填写的外部 URL 不重写，内置图片的文档路径保持可迁移。Hash 路由允许直接访问及刷新 `#/editor/:projectId`。

作品存在访问者浏览器的 IndexedDB，恢复日志存在 localStorage。开发地址与正式域名的数据互不相通；需要导出 JSON，再到正式域名导入。浏览器清理存储会删除本地作品。本版不提供登录或云端同步。

同一 github.io 源下的其他 Pages 项目共享浏览器 origin；不要把同域下的其他应用视为存储隔离边界。未来切换独立域名时，仍需用户自行备份、迁移。

## 回滚与后续维护

出现发布问题时，恢复一个已验证提交的代码并正常推送 main（推荐 git revert，不强推历史），由工作流重新检查与发布。单纯重新运行旧工作流会与最新部署并发，需要确认最终线上提交。上线后检查 Actions 成功状态、首页、作品库、创建 / 保存 / 预览，并保留用户备份说明。

若改仓库名或绑定自定义域名，修改 `build:pages`、`preview:pages`、冒烟脚本默认路径和文档地址后重新验证。切勿将 token 或私有配置放入前端环境变量。

## 验证范围

自动检查使用 Playwright 的 Chromium / Firefox / WebKit，阻断 Google Fonts 请求以覆盖字体服务不可用的情况。手机检查是 390px 视口与界面溢出检查，不代表真实手机触摸拖拽或 Safari / iOS 已认证。许可说明保留在 README 与上游审计文档，部署成功不代表用途授权已获确认。1.0 完整验收范围见 [发布说明](RELEASE_1.0.md)。
