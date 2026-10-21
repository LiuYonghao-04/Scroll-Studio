import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { unzipSync } from 'fflate'
import type { Browser, Page } from 'playwright'
import type { PageDocument } from '../src/types/editor'

async function focusStaysInside(page: Page) {
  for (let index = 0; index < 16; index++) {
    await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => {
      const dialog = document.querySelector('dialog[open]')
      return {
        inside: !!(
          dialog &&
          (dialog === document.activeElement || dialog.contains(document.activeElement))
        ),
        active: document.activeElement?.outerHTML.slice(0, 220),
      }
    })
    assert.ok(focus.inside, `Tab escaped the modal dialog at ${index}: ${focus.active}`)
  }
}

export async function verifyRelease(
  browser: Browser,
  base: string,
  output: string,
  backup: string,
) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort())
  const page = await context.newPage(),
    errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto(`${base}#/projects`)
    await page.getByRole('button', { name: '开始创作', exact: true }).click()
    await page.getByRole('button', { name: '新建作品', exact: true }).click()
    await focusStaysInside(page)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    assert.equal(
      await page
        .getByRole('button', { name: '新建作品', exact: true })
        .evaluate((element) => element === document.activeElement),
      true,
      'Create dialog lost return focus',
    )

    const doc = JSON.parse(await readFile(backup, 'utf8')) as PageDocument
    doc.name = '1.0 发布验收'
    doc.nodes[0]!.style.minHeight = 640
    doc.nodes[0]!.responsive.tablet.minHeight = 320
    doc.nodes[0]!.responsive.mobile.minHeight = 0
    const heading = doc.nodes[0]!.children.find((node) => node.kind === 'heading')!
    heading.style.fontWeight = 800
    heading.style.lineHeight = 1.8
    const image = doc.nodes[1]!.children.find((node) => node.kind === 'image')!
    image.style.height = 130
    image.style.objectFit = 'contain'
    await page.locator('input[type="file"]').setInputFiles({
      name: 'release.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(doc)),
    })
    await page.getByRole('link', { name: `打开 ${doc.name}`, exact: true }).waitFor()
    const remove = page.getByRole('button', { name: `删除 ${doc.name}`, exact: true })
    await remove.click()
    await focusStaysInside(page)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    assert.equal(await remove.evaluate((element) => element === document.activeElement), true)
    await page.getByRole('link', { name: `打开 ${doc.name}`, exact: true }).click()
    await page.getByRole('heading', { name: '公开体验版自动验收', exact: true }).click()
    const content = page.getByRole('textbox', { name: '内容', exact: true })
    const title = '弹窗快捷键不会改变画布'
    await content.fill(title)
    await page.getByRole('button', { name: '导出网站 ZIP', exact: true }).click()
    await page.keyboard.press('ControlOrMeta+z')
    await page.keyboard.press('Delete')
    await page.keyboard.press('Escape')
    await page.getByRole('heading', { name: title, exact: true }).waitFor()
    await page.getByRole('button', { name: '预览', exact: true }).click()
    await page.frameLocator('iframe').getByRole('heading', { name: title, exact: true }).waitFor()
    await focusStaysInside(page)
    await page.getByRole('button', { name: '预览mobile', exact: true }).click()
    await page.waitForFunction(() => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe')?.contentWindow
      const first = frame?.document.querySelector('.page-node.section')
      return (
        first &&
        frame &&
        frame.innerWidth === 390 &&
        frame.getComputedStyle(first).minHeight === '0px'
      )
    })
    await page.getByRole('button', { name: '时间轴试播', exact: true }).click()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('status').filter({ hasText: '系统已减弱动态效果' }).waitFor()
    assert.equal(
      await page.getByRole('slider', { name: '时间轴播放进度', exact: true }).isDisabled(),
      true,
    )
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLInputElement>('[aria-label="时间轴播放进度"]')?.disabled ===
        false,
    )
    await page.keyboard.press('Escape')
    await page.getByRole('heading', { name: title, exact: true }).waitFor()
    await content.fill('切换后台后仍保留的修改')
    await page.getByRole('heading', { name: '切换后台后仍保留的修改', exact: true }).waitFor()
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    await page.getByRole('status').filter({ hasText: '已保存到作品库' }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: '切换后台后仍保留的修改', exact: true }).waitFor()
    await page.getByRole('button', { name: '导出网站 ZIP', exact: true }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: '下载网站 ZIP', exact: true }).click()
    const path = `${output}/release.zip`
    await (await download).saveAs(path)
    const root = await mkdtemp(resolve(output, 'release-'))
    for (const [name, bytes] of Object.entries(unzipSync(await readFile(path)))) {
      const destination = resolve(root, name)
      assert.ok(destination.startsWith(`${root}${sep}`))
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, bytes)
    }
    const exported = await context.newPage()
    await exported.setViewportSize({ width: 390, height: 844 })
    await exported.goto(pathToFileURL(join(root, 'index.html')).href)
    const exportedHeading = exported.locator('.page-node.heading').first()
    assert.equal(await exportedHeading.evaluate((node) => getComputedStyle(node).fontWeight), '800')
    assert.equal(
      await exported
        .locator('.page-node.image > img')
        .first()
        .evaluate((node) => getComputedStyle(node).height),
      '130px',
    )
    assert.equal(
      await exported
        .locator('.page-node.image > img')
        .first()
        .evaluate((node) => getComputedStyle(node).objectFit),
      'contain',
    )
    assert.equal(
      await exported
        .locator('main > .section')
        .first()
        .evaluate((node) => getComputedStyle(node).minHeight),
      '0px',
      'Export retained the desktop minimum height',
    )
    await exported.setViewportSize({ width: 768, height: 1000 })
    assert.equal(
      await exported
        .locator('main > .section')
        .first()
        .evaluate((node) => getComputedStyle(node).minHeight),
      '320px',
    )
    await exported.setViewportSize({ width: 1120, height: 1000 })
    assert.equal(
      await exported
        .locator('main > .section')
        .first()
        .evaluate((node) => getComputedStyle(node).minHeight),
      '640px',
    )
    assert.deepEqual(errors, [])
  } catch (error) {
    await page.screenshot({ path: `${output}/release-failure.png`, fullPage: true }).catch(() => {})
    throw error
  } finally {
    await context.close()
  }
}
