import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4173/Scroll-Studio/'
const output = 'output/playwright/pages-smoke'
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
const browser = await chromium.launch()
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
  await page.getByRole('button', { name: '预览', exact: true }).click()
  const frame = page.frameLocator('iframe[title="独立页面预览"]')
  await frame.getByRole('heading', { name: '公开体验版自动验收', exact: true }).waitFor()
  assert.equal(
    await page.locator('iframe').getAttribute('src'),
    `${new URL(base).pathname}#/render`,
  )
  await page.getByRole('button', { name: '预览mobile', exact: true }).click()
  await frame
    .locator('img')
    .evaluateAll((images) =>
      Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
    )
  await page.getByRole('button', { name: '时间轴试播', exact: true }).click()
  await page.getByRole('button', { name: '关闭预览', exact: true }).click()
  await page.getByRole('heading', { name: '公开体验版自动验收', exact: true }).click()
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
  await library('上线验收作品')
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
  assert.deepEqual(errors, [], 'Runtime or local resource failures')
  console.log(
    `PASS: guide, templates, edit, undo/redo, save/reload, subpath preview/images, quota/retry, invalid import, export/import, mobile: ${base}`,
  )
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {})
  console.error(serverLog, errors)
  throw error
} finally {
  await browser.close()
  server?.kill()
}
