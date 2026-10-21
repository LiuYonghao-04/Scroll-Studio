import { describe, expect, it, vi } from 'vitest'
import { strFromU8, strToU8, unzipSync } from 'fflate'
import { newDocument, createNode, parseDocument } from '../src/core/document'
import { compileHtml, cssText } from '../src/export/compiler'
import { preflight } from '../src/export/preflight'
import { buildArchive } from '../src/export/archive'
import { nodeStyle } from '../src/core/render-style'

const loader = async (url: string) =>
  strToU8(
    url.endsWith('.svg') ? '<svg xmlns="http://www.w3.org/2000/svg"/>' : '/* test resource */',
  )
describe('static site compiler', () => {
  it('renders text as HTML and retains the exact validated animation data', () => {
    const doc = newDocument(true)
    doc.name = 'Portfolio & story'
    const result = compileHtml(doc)
    const page = new DOMParser().parseFromString(result.html, 'text/html')
    expect(page.title).toBe(doc.name)
    expect(page.querySelectorAll('[data-node-id]')).toHaveLength(6)
    expect(parseDocument(page.getElementById('scroll-studio-document')!.textContent!)).toEqual(doc)
    expect(result.html).toContain('src="./runtime.js"')
  })
  it('escapes hostile text, attributes, CSS identifiers and embedded JSON script endings', () => {
    const doc = newDocument(),
      node = createNode('heading')
    doc.name = '</title><script>alert(1)</script>'
    node.id = 'x"]{color:red}/*'
    node.content = '</script><img src=x onerror=alert(1)>'
    doc.nodes = [node]
    const result = compileHtml(doc),
      page = new DOMParser().parseFromString(result.html, 'text/html')
    expect(page.querySelector('h2')!.textContent).toBe(node.content)
    expect(page.querySelectorAll('img')).toHaveLength(0)
    expect(page.querySelectorAll('script')).toHaveLength(2)
    expect(result.css).not.toContain('[data-node-id="x"]{color:red}')
    expect(parseDocument(page.getElementById('scroll-studio-document')!.textContent!)).toEqual(doc)
  })
  it('uses the same responsive style calculation as the editor at all breakpoints', () => {
    const doc = newDocument(),
      parent = createNode('section'),
      child = createNode('heading')
    parent.style.layout = 'row'
    parent.responsive.mobile.layout = 'column'
    child.responsive.tablet.fontSize = 42
    child.responsive.mobile.fontSize = 28
    parent.children = [child]
    doc.nodes = [parent]
    const result = compileHtml(doc)
    expect(result.css).toContain(cssText(nodeStyle(child, 'desktop', true)))
    expect(result.css).toContain(cssText(nodeStyle(child, 'mobile', false)))
    expect(result.css).toContain('@media(max-width:600px)')
    expect(result.css).not.toContain('fonts.googleapis.com')
  })
  it('creates ordinary anchors that work without the editor router and suppresses unsafe links', () => {
    const doc = newDocument(),
      target = createNode('heading'),
      button = createNode('button')
    button.href = `#${target.id}`
    doc.nodes = [target, button]
    expect(compileHtml(doc).html).toContain(`href="#node-${target.id}"`)
    button.href = 'javascript:alert(1)'
    expect(compileHtml(doc).html).not.toContain('href="javascript:')
  })
})
describe('preflight checks', () => {
  it('blocks empty or invalid documents but allows an ordinary text page', () => {
    expect(preflight(newDocument()).some((issue) => issue.level === 'error')).toBe(true)
    const doc = newDocument()
    doc.nodes = [createNode('text')]
    expect(preflight(doc).some((issue) => issue.level === 'error')).toBe(false)
    expect(preflight({ ...doc, version: 10 } as unknown as typeof doc)[0]!.level).toBe('error')
  })
  it('reports missing alt, unknown anchors, external images and fixed heights with node references', () => {
    const doc = newDocument(),
      image = createNode('image'),
      button = createNode('button')
    image.content = ''
    image.src = 'https://example.com/photo.jpg'
    button.href = '#missing'
    button.style.height = 40
    doc.nodes = [image, button]
    const issues = preflight(doc)
    expect(issues.filter((issue) => issue.level === 'warning')).toHaveLength(4)
    expect(
      issues
        .filter((issue) => issue.nodeId)
        .every((issue) => [image.id, button.id].includes(issue.nodeId!)),
    ).toBe(true)
  })
})
describe('ZIP package', () => {
  it('includes actual HTML, CSS, local animation resources, default images and a restorable project', async () => {
    const doc = newDocument(true),
      original = JSON.stringify(doc),
      load = vi.fn(loader)
    const files = unzipSync(await buildArchive(doc, load))
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        'index.html',
        'styles.css',
        'runtime.js',
        'images/landscape.svg',
        'project.json',
        'README.txt',
        'THIRD_PARTY_NOTICES.txt',
      ]),
    )
    expect(parseDocument(strFromU8(files['project.json']!))).toEqual(doc)
    expect(strFromU8(files['index.html']!)).not.toContain('127.0.0.1')
    expect(strFromU8(files['index.html']!)).not.toContain('src="https://')
    expect(JSON.stringify(doc)).toBe(original)
    expect(load).toHaveBeenCalledTimes(3)
  })
  it('packages referenced local image bytes and removes asset dependencies from the runtime document', async () => {
    const doc = newDocument(),
      image = createNode('image')
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='
    const asset = {
      id: 'photo-id',
      name: 'photo.png',
      mime: 'image/png' as const,
      bytes: atob(png).length,
      width: 1,
      height: 1,
      dataUrl: `data:image/png;base64,${png}`,
    }
    doc.assets = [asset]
    image.src = `asset:${asset.id}`
    doc.nodes = [image]
    const files = unzipSync(await buildArchive(doc, loader))
    expect(files['media/photo-id.png']!.length).toBe(asset.bytes)
    expect(strFromU8(files['index.html']!)).toContain('src="./media/photo-id.png"')
    expect(strFromU8(files['index.html']!)).not.toContain('asset:photo-id')
    expect(parseDocument(strFromU8(files['project.json']!)).assets[0]).toEqual(asset)
  })
  it('does not emit a partial site if an external image cannot be read', async () => {
    const doc = newDocument(),
      image = createNode('image')
    image.src = 'https://example.com/blocked.jpg'
    doc.nodes = [image]
    await expect(
      buildArchive(doc, async (url) => {
        if (url.startsWith('https:')) throw new Error('CORS')
        return loader(url)
      }),
    ).rejects.toThrow('请先在素材库上传')
  })
})
