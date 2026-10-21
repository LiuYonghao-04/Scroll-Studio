import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname, sep, join, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { unzipSync } from 'fflate'
import type { Browser, Page } from 'playwright'

export async function verifyWebsiteExport(page: Page, browser: Browser, output: string) {
  await page.getByRole('button', { name: '导出网站 ZIP', exact: true }).click()
  await page.getByRole('dialog', { name: '把作品，带到更大的世界。' }).waitFor()
  await page.screenshot({ path: `${output}/export-dialog.png` })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载网站 ZIP', exact: true }).click()
  const zipPath = `${output}/website.zip`
  await (await download).saveAs(zipPath)
  await page.getByRole('status').filter({ hasText: 'ZIP 已生成' }).waitFor()
  await page.getByRole('button', { name: '返回编辑', exact: true }).click()
  const files = unzipSync(await readFile(zipPath))
  const directory = await mkdtemp(resolve(output, 'website-'))
  for (const [name, bytes] of Object.entries(files)) {
    const target = resolve(directory, name)
    assert.ok(target.startsWith(directory + sep), 'Unsafe archive path')
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
  }
  const external: string[] = [],
    errors: string[] = []
  const context = await browser.newContext({
    viewport: { width: 1120, height: 900 },
    reducedMotion: 'reduce',
  })
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (/^https?:$/.test(url.protocol) && url.hostname !== '127.0.0.1') {
      external.push(url.href)
      return route.abort()
    }
    return route.continue()
  })
  const exported = await context.newPage()
  exported.on('pageerror', (error) => errors.push(error.message))
  exported.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`)
  })
  const title = '公开体验版自动验收'
  const staticServer = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    const name = path.replace(/^\/nested\/site\//, '') || 'index.html'
    const bytes = files[name]
    if (!bytes) {
      response.writeHead(404)
      response.end()
      return
    }
    const mime: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.png': 'image/png',
    }
    response.setHeader('Content-Type', mime[extname(name)] ?? 'application/octet-stream')
    response.end(bytes)
  })
  try {
    await exported.goto(pathToFileURL(join(directory, 'index.html')).href)
    await exported.getByRole('heading', { name: title, exact: true }).waitFor()
    await exported.waitForFunction(() =>
      [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    )
    assert.equal(
      await exported
        .getByRole('heading', { name: title, exact: true })
        .locator('..')
        .evaluate((element) => getComputedStyle(element).fontSize),
      '56px',
    )
    assert.ok(
      await exported
        .locator('img')
        .first()
        .getAttribute('src')
        .then((src) => src?.startsWith('./media/')),
    )
    await exported.screenshot({ path: `${output}/export-desktop.png`, fullPage: true })
    await exported.setViewportSize({ width: 390, height: 844 })
    assert.equal(
      await exported
        .getByRole('heading', { name: title, exact: true })
        .locator('..')
        .evaluate((element) => getComputedStyle(element).fontSize),
      '28px',
    )
    assert.ok(
      await exported.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Export mobile overflows',
    )
    await exported.screenshot({ path: `${output}/export-mobile.png`, fullPage: true })
    await exported.getByRole('link', { name: '看看我的作品 ↓', exact: true }).click()
    assert.ok(
      new URL(exported.url()).hash.startsWith('#node-'),
      'Exported anchors do not resolve independently',
    )
    await new Promise<void>((resolveReady) => staticServer.listen(0, '127.0.0.1', resolveReady))
    const address = staticServer.address()
    assert.ok(address && typeof address !== 'string')
    const siteUrl = `http://127.0.0.1:${address.port}/nested/site/index.html`
    await exported.goto(siteUrl)
    await exported.getByRole('heading', { name: title, exact: true }).waitFor()
    await exported.waitForFunction(() =>
      [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    )
    assert.deepEqual(external, [], 'Export requested external resources')
    assert.equal(errors.length, 0, errors.join('\n'))
    const motionContext = await browser.newContext({
      viewport: { width: 1120, height: 900 },
      reducedMotion: 'no-preference',
    })
    const animated = await motionContext.newPage()
    animated.on('pageerror', (error) => errors.push(error.message))
    await animated.goto(siteUrl)
    await animated.waitForFunction(() => {
      const node = [...document.querySelectorAll('h2')].find(
        (heading) => heading.textContent === '公开体验版自动验收',
      )?.parentElement
      return node && Number(getComputedStyle(node).opacity) < 0.1
    })
    await animated.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await animated.waitForFunction(() => {
      const node = [...document.querySelectorAll('h2')].find(
        (heading) => heading.textContent === '公开体验版自动验收',
      )?.parentElement
      return node && Number(getComputedStyle(node).opacity) > 0.99
    })
    await motionContext.close()
    const noJs = await browser.newContext({ javaScriptEnabled: false })
    const staticPage = await noJs.newPage()
    await staticPage.goto(siteUrl)
    await staticPage.getByRole('heading', { name: title, exact: true }).waitFor()
    await noJs.close()
    assert.equal(errors.length, 0, errors.join('\n'))
  } catch (error) {
    await exported
      .screenshot({ path: `${output}/export-failure.png`, fullPage: true })
      .catch(() => {})
    throw error
  } finally {
    await context.close()
    await new Promise<void>((resolveClosed) => staticServer.close(() => resolveClosed()))
  }
}
