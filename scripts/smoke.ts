import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit, type Page } from 'playwright'
import { verifyWebsiteExport, verifyShowcaseTemplates } from './verify-export.ts'
import { verifyRelease } from './verify-release.ts'

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4173/Scroll-Studio/'
const engine = process.env.SMOKE_BROWSER ?? 'chromium'
if (engine !== 'chromium' && engine !== 'firefox' && engine !== 'webkit')
  throw new Error(`Unsupported smoke browser: ${engine}`)
const output = `output/playwright/pages-smoke${engine === 'chromium' ? '' : `-${engine}`}`
await mkdir(output, { recursive: true })
const server = process.env.SMOKE_BASE_URL
  ? undefined
  : spawn(
      process.execPath,
      [
        fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        '4173',
        '--strictPort',
        '--base',
        '/Scroll-Studio/',
      ],
      { stdio: 'pipe' },
    )
let serverLog = ''
server?.stdout?.on('data', (data: Buffer) => {
  serverLog += data.toString()
})
server?.stderr?.on('data', (data: Buffer) => {
  serverLog += data.toString()
})
const errors: string[] = []
const browser = await { chromium, firefox, webkit }[engine].launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
page.setDefaultTimeout(15_000)
page.on('pageerror', (error) => errors.push(error.message))
page.on('response', (response) => {
  if (new URL(response.url()).origin === new URL(base).origin && response.status() >= 400)
    errors.push(`HTTP ${response.status()} ${response.url()}`)
})
// A blocked font provider must not prevent editing or change test timing.
await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort())

async function library(name: string) {
  await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('link', { name: '我的作品', exact: true }).click()
  await page.waitForURL(/#\/projects$/)
}
async function imagesLoaded(target: Page) {
  await target.waitForFunction(() =>
    [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  )
}
async function verifyV06() {
  const heading = page.getByRole('heading', { name: '公开体验版自动验收', exact: true })
  const wrapper = heading.locator('..')
  await heading.click()
  const size = page.getByRole('spinbutton', { name: '字号 · px', exact: true })
  await page.getByRole('button', { name: 'mobile画布', exact: true }).click()
  await size.fill('28')
  await size.press('Tab')
  await page.getByRole('spinbutton', { name: '边框宽度 · px', exact: true }).fill('2')
  await page.getByRole('spinbutton', { name: '边框宽度 · px', exact: true }).press('Tab')
  assert.equal(await wrapper.evaluate((element) => getComputedStyle(element).fontSize), '28px')
  await page.getByRole('button', { name: 'tablet画布', exact: true }).click()
  await size.fill('42')
  await size.press('Tab')
  await page.getByRole('button', { name: 'mobile画布', exact: true }).click()
  assert.equal(await size.inputValue(), '28')
  await page.getByRole('button', { name: '重置此断点，恢复继承', exact: true }).click()
  assert.equal(await size.inputValue(), '42')
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  assert.equal(await size.inputValue(), '28')
  await page.getByRole('button', { name: 'desktop画布', exact: true }).click()
  assert.equal(await size.inputValue(), '56')
  await page.screenshot({ path: `${output}/responsive-editor.png` })
  await page.locator('.canvas-page .page-node.image img').first().click()
  await page.getByRole('button', { name: '选择或上传本地图片', exact: true }).click()
  const picker = page.getByLabel('上传本地图片', { exact: true })
  await picker.setInputFiles({
    name: 'bad.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  })
  await page.getByRole('alert').filter({ hasText: '暂不接受 SVG' }).waitFor()
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 80
    const context = canvas.getContext('2d')!
    context.fillStyle = '#8ba879'
    context.fillRect(0, 0, 120, 80)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  const fixture = Buffer.from(data, 'base64')
  await picker.setInputFiles({ name: 'local-fixture.png', mimeType: 'image/png', buffer: fixture })
  await page.getByRole('button', { name: '使用素材 local-fixture.png', exact: true }).click()
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('.canvas-page img')].some(
      (image) => image.src.startsWith('data:image/webp;') && image.naturalWidth === 120,
    ),
  )
  assert.ok(
    await page
      .getByRole('button', { name: '删除素材 local-fixture.png', exact: true })
      .isDisabled(),
  )
  await page
    .getByRole('textbox', { name: '素材名称 local-fixture.png', exact: true })
    .fill('本地测试图片')
  await page.getByRole('textbox', { name: '素材名称 local-fixture.png', exact: true }).press('Tab')
  await picker.setInputFiles({ name: 'unused.png', mimeType: 'image/png', buffer: fixture })
  await page.getByRole('button', { name: '删除素材 unused.png', exact: true }).click()
  assert.equal(await page.locator('.media-card').count(), 1)
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  assert.equal(await page.locator('.media-card').count(), 2)
  await page.getByRole('button', { name: '重做', exact: true }).click()
  assert.equal(await page.locator('.media-card').count(), 1)
  await page.screenshot({ path: `${output}/media-editor.png` })
  await page.getByRole('button', { name: '组件', exact: true }).click()
  for (const name of ['首屏介绍', '三列特性', '图文介绍', '行动邀请'])
    await page.getByRole('button', { name: `插入区块 ${name}`, exact: true }).click()
  assert.equal(await page.locator('.canvas-page > .page-node').count(), 7)
  await page
    .getByRole('button', { name: '插入区块 首屏介绍', exact: true })
    .dragTo(page.locator('.canvas-page > .root-drop-slot').first())
  await page.waitForFunction(
    () => document.querySelectorAll('.canvas-page > .page-node').length === 8,
  )
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  assert.equal(await page.locator('.canvas-page > .page-node').count(), 7)
  await heading.click()
  await page.locator('.properties .panel-tabs button').filter({ hasText: '动画' }).click()
  for (const name of ['向上浮现', '柔和淡入', '旋入', '侧向滑入', '视差穿行', '缩放展开'])
    await page.getByRole('button', { name, exact: true }).click()
  await page.getByLabel('播放方式').selectOption('sequence')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '已保存到作品库' }).waitFor()
  await page.reload()
  await heading.waitFor()
  assert.equal(await page.locator('.canvas-page > .page-node').count(), 7)
  assert.ok(
    await page
      .locator('.canvas-page img')
      .first()
      .getAttribute('src')
      .then((src) => src?.startsWith('data:image/webp;')),
  )
}
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true
        break
      }
    } catch {
      /* Preview is still starting. */
    }
    if (server && server.exitCode !== null) throw new Error(`Preview exited: ${serverLog}`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.ok(ready, `Site did not respond: ${serverLog}`)
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page
    .getByRole('link', { name: /开始自由创作/ })
    .first()
    .waitFor()
  await imagesLoaded(page)
  await page.goto(`${base}#/projects`)
  await page.getByRole('dialog', { name: '从一个模板，开始你的创作。' }).waitFor()
  await page.screenshot({ path: `${output}/guide.png` })
  await page.getByRole('button', { name: '开始创作', exact: true }).click()
  await page.getByRole('button', { name: '新建作品', exact: true }).click()
  await page.getByRole('button', { name: /^个人作品集/ }).click()
  await page.getByRole('textbox', { name: '作品名称', exact: true }).fill('上线验收作品')
  await page.getByRole('button', { name: '创建并打开', exact: true }).click()
  await page.waitForURL(/#\/editor\/[^/]+$/)
  const projectUrl = page.url()
  await page.getByRole('heading', { name: /把细小的观察/ }).click()
  await page.getByRole('textbox', { name: '内容', exact: true }).fill('公开体验版自动验收')
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await page.getByRole('heading', { name: /把细小的观察/ }).waitFor()
  await page.getByRole('button', { name: '重做', exact: true }).click()
  await page.getByRole('heading', { name: '公开体验版自动验收', exact: true }).waitFor()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '已保存到作品库' }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: '公开体验版自动验收', exact: true }).waitFor()
  assert.equal(page.url(), projectUrl)
  assert.equal(
    await page.getByRole('dialog').count(),
    0,
    'Guide should not reappear after dismissal',
  )
  await imagesLoaded(page)
  await verifyV06()
  await verifyWebsiteExport(page, browser, output)
  await page.getByRole('button', { name: '预览', exact: true }).click()
  const frame = page.frameLocator('iframe[title="独立页面预览"]')
  await frame.getByRole('heading', { name: '公开体验版自动验收', exact: true }).waitFor()
  assert.equal(
    await page.locator('iframe').getAttribute('src'),
    `${new URL(base).pathname}#/render`,
  )
  await page.getByRole('button', { name: '预览mobile', exact: true }).click()
  await page.waitForFunction(() => {
    const view = document.querySelector<HTMLIFrameElement>('iframe')?.contentWindow
    const heading = [...(view?.document.querySelectorAll('h2') ?? [])].find(
      (element) => element.textContent === '公开体验版自动验收',
    )?.parentElement
    return view && heading && view.getComputedStyle(heading).fontSize === '28px'
  })
  await frame
    .locator('img')
    .evaluateAll((images) =>
      Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
    )
  await page.getByRole('button', { name: '时间轴试播', exact: true }).click()
  const progress = page.getByRole('slider', { name: '时间轴播放进度', exact: true })
  await progress.waitFor({ state: 'visible' })
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLInputElement>('[aria-label="时间轴播放进度"]')?.disabled === false,
  )
  await progress.focus()
  await progress.press('End')
  // postMessage transport is asynchronous; verify the rendered result after its acknowledgement.
  await page.waitForFunction(() => {
    const input = document.querySelector<HTMLInputElement>('[aria-label="时间轴播放进度"]')
    const preview = document.querySelector<HTMLIFrameElement>('iframe')?.contentWindow
    const node = [...(preview?.document.querySelectorAll('h2') ?? [])].find(
      (heading) => heading.textContent === '公开体验版自动验收',
    )?.parentElement
    return (
      input &&
      input.value === input.max &&
      node &&
      preview &&
      Number(preview.getComputedStyle(node).opacity) >= 0.99
    )
  })
  await page.getByRole('button', { name: '关闭预览', exact: true }).click()
  await page.getByRole('heading', { name: '公开体验版自动验收', exact: true }).click()
  await page.locator('.properties .panel-tabs button').filter({ hasText: '属性' }).click()
  await page.evaluate(() => {
    const state = window as Window & { smokeOriginalPut?: typeof IDBObjectStore.prototype.put }
    state.smokeOriginalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
  })
  await page.getByRole('textbox', { name: '内容', exact: true }).fill('保存失败时保留编辑')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '作品存储空间不足' }).waitFor()
  await page.getByRole('button', { name: '关闭错误提示', exact: true }).click()
  await page.getByRole('button', { name: '上线验收作品', exact: true }).click()
  await page.getByRole('link', { name: '我的作品', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '作品存储空间不足' }).waitFor()
  assert.equal(page.url(), projectUrl, 'Failed save must block navigation')
  await page.getByRole('heading', { name: '保存失败时保留编辑', exact: true }).waitFor()
  await page.evaluate(() => {
    const state = window as Window & { smokeOriginalPut?: typeof IDBObjectStore.prototype.put }
    if (state.smokeOriginalPut) IDBObjectStore.prototype.put = state.smokeOriginalPut
    delete state.smokeOriginalPut
  })
  await page.getByRole('textbox', { name: '内容', exact: true }).fill('公开体验版自动验收')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '已保存到作品库' }).waitFor()
  // The failed navigation left the document menu open.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出页面 JSON', exact: true }).click()
  const backup = `${output}/backup.json`
  await (await download).saveAs(backup)
  const saved = JSON.parse(await readFile(backup, 'utf8')) as {
    version: number
    assets: { dataUrl: string }[]
  }
  assert.equal(saved.version, 3)
  assert.equal(saved.assets.length, 1)
  assert.ok(saved.assets[0]!.dataUrl.startsWith('data:image/webp;'))
  await library('上线验收作品')
  await page.getByRole('button', { name: '重命名 上线验收作品', exact: true }).click()
  await page.getByRole('textbox', { name: '新的作品名称', exact: true }).fill('素材备份验收')
  await page.getByRole('button', { name: '保存名称', exact: true }).click()
  await page.waitForFunction(
    () => !document.querySelector<HTMLButtonElement>('.projects-heading .btn')?.disabled,
  )
  const libraryDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 素材备份验收', exact: true }).click()
  await (await libraryDownload).saveAs(`${output}/library-backup.json`)
  const libraryBackup = JSON.parse(
    await readFile(`${output}/library-backup.json`, 'utf8'),
  ) as typeof saved
  assert.deepEqual(libraryBackup.assets, saved.assets)
  await page.getByRole('button', { name: '重命名 素材备份验收', exact: true }).click()
  await page.getByRole('textbox', { name: '新的作品名称', exact: true }).fill('上线验收作品')
  await page.getByRole('button', { name: '保存名称', exact: true }).click()
  await page.waitForFunction(
    () => !document.querySelector<HTMLButtonElement>('.projects-heading .btn')?.disabled,
  )
  await page.locator('input[type="file"]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid'),
  })
  await page.getByRole('alert').waitFor()
  assert.equal(await page.locator('.project-card').count(), 1, 'Invalid import changed the library')
  await page.locator('input[type="file"]').setInputFiles(backup)
  await page.waitForFunction(() => document.querySelectorAll('.project-card').length === 2)
  await page.reload()
  await page.waitForFunction(() => document.querySelectorAll('.project-card').length === 2)
  await page.getByRole('link', { name: '打开 上线验收作品', exact: true }).first().click()
  await page.getByRole('heading', { name: '公开体验版自动验收', exact: true }).waitFor()
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('.canvas-page img')].some(
      (image) => image.src.startsWith('data:image/webp;') && image.naturalWidth === 120,
    ),
  )
  await library('上线验收作品')
  await imagesLoaded(page)
  await page.screenshot({ path: `${output}/projects-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Mobile library overflows',
  )
  await page.getByRole('button', { name: '使用指南', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  assert.ok(
    await page
      .getByRole('dialog')
      .evaluate((element) => element.getBoundingClientRect().width <= innerWidth),
    'Guide overflows mobile',
  )
  await page.screenshot({ path: `${output}/guide-mobile.png` })
  await page.keyboard.press('Escape')
  await page.screenshot({ path: `${output}/projects-mobile.png`, fullPage: true })
  await verifyShowcaseTemplates(browser, base, output)
  await verifyRelease(browser, base, output, backup)
  assert.deepEqual(errors, [], 'Runtime or local resource failures')
  console.log(
    `PASS [${engine}]: 1.0 modal keyboard/focus, background save, reduced-motion switch, exported responsive reset; ZIP file/offline/HTTP, animations, templates, responsive/media and project recovery: ${base}`,
  )
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {})
  console.error(serverLog, errors)
  throw error
} finally {
  await browser.close()
  server?.kill()
}
