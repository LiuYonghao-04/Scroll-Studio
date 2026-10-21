import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createNode, newDocument, safeUrl } from '../src/core/document'
import { nodeStyle } from '../src/core/render-style'
import { compileHtml, cssText } from '../src/export/compiler'
import { preflight } from '../src/export/preflight'
import { useEditorStore } from '../src/stores/editor'
import { useDragDrop } from '../src/composables/useDragDrop'

beforeEach(() => setActivePinia(createPinia()))

describe('1.0 regression coverage', () => {
  it('preserves native dragging when a browser strips custom MIME, and ignores foreign text', () => {
    const store = useEditorStore()
    store.create()
    const data = new Map<string, string>()
    const transfer = {
      setData: (type: string, value: string) => {
        data.set(type, value)
      },
      getData: (type: string) => data.get(type) ?? '',
      effectAllowed: 'none',
    } as unknown as DataTransfer
    const event = new Event('drop', { cancelable: true }) as DragEvent
    Object.defineProperty(event, 'dataTransfer', { value: transfer })
    const { start, drop } = useDragDrop()
    start(event, { kind: 'new', value: 'heading' })
    data.delete('application/x-scroll-studio')
    drop(event, null)
    expect(store.document.nodes).toHaveLength(1)
    expect(store.document.nodes[0]!.kind).toBe('heading')
    data.set('text/plain', '{"kind":"new","value":"heading"}')
    drop(event, null)
    expect(store.document.nodes).toHaveLength(1)
  })
  it('explicitly clears a desktop minimum height in the exported mobile cascade', () => {
    const doc = newDocument(),
      parent = createNode('section')
    parent.style.minHeight = 640
    parent.responsive.tablet.minHeight = 320
    parent.responsive.mobile.minHeight = 0
    doc.nodes = [parent]
    expect(nodeStyle(parent, 'mobile').minHeight).toBe('0px')
    const css = compileHtml(doc).css
    expect(css.split('@media(max-width:600px)')[1]).toContain(cssText(nodeStyle(parent, 'mobile')))
    expect(css).toContain('min-height:640px')
    expect(css).toContain('min-height:320px')
  })

  it('remaps links inside a duplicated subtree while retaining its external targets and undo', () => {
    const doc = newDocument(),
      section = createNode('section'),
      target = createNode('heading'),
      internal = createNode('button'),
      external = createNode('button'),
      outside = createNode('heading')
    internal.href = `  #${target.id}  `
    external.href = `#${outside.id}`
    section.children = [target, internal, external]
    doc.nodes = [section, outside]
    const store = useEditorStore()
    store.replace(doc)
    store.duplicate(section.id)
    const copy = store.document.nodes[1]!
    expect(copy.children[1]!.href).toBe(`#${copy.children[0]!.id}`)
    expect(copy.children[0]!.id).not.toBe(target.id)
    expect(copy.children[2]!.href).toBe(`#${outside.id}`)
    expect(store.document.nodes[0]!.children[1]!.href).toBe(internal.href)
    expect(copy.children[0]!.animation.keyframes[0]!.id).not.toBe(target.animation.keyframes[0]!.id)
    store.undo()
    expect(store.document.nodes).toEqual(doc.nodes)
    store.redo()
    expect(store.document.nodes[1]!.children[1]!.href).toBe(`#${copy.children[0]!.id}`)
  })

  it.each([
    '/\t/evil.test',
    '/\n\\evil.test',
    'java\nscript:alert(1)',
    'https://exam\tple.com',
    '/a\u0000b',
  ])('rejects embedded URL control characters: %j', (url) => {
    expect(safeUrl(url)).toBe('')
    expect(safeUrl(url, true)).toBe('')
  })

  it('checks the same normalized anchors and placeholders that preview and export use', () => {
    const doc = newDocument(),
      button = createNode('button'),
      target = createNode('heading')
    doc.nodes = [target, button]
    button.href = `  #${target.id}  `
    expect(preflight(doc).filter((issue) => issue.level === 'warning')).toEqual([])
    expect(compileHtml(doc).html).toContain(`href="#node-${target.id}"`)
    button.href = '  #  '
    expect(preflight(doc).some((issue) => issue.message.includes('尚未设置有效链接'))).toBe(true)
    expect(safeUrl(' https://example.com/my page ')).toBe('https://example.com/my page')
  })
})
