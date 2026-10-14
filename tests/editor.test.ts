import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '../src/stores/editor'
import { createNode, newDocument, parseDocument, safeUrl } from '../src/core/document'
import { loadDocument, saveDocument, STORAGE_KEY } from '../src/services/storage'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.restoreAllMocks()
})
describe('document transactions', () => {
  it('coalesces a typing burst and resets grouping after undo', () => {
    const store = useEditorStore()
    store.create()
    store.add('heading')
    const id = store.selectedId!
    const previous = store.selected!.content
    store.update(id, { content: 'H' }, undefined, undefined, `${id}:content`)
    store.update(id, { content: 'Hello' }, undefined, undefined, `${id}:content`)
    store.undo()
    expect(store.selected!.content).toBe(previous)
    store.update(id, { content: 'World' }, undefined, undefined, `${id}:content`)
    store.undo()
    expect(store.selected!.content).toBe(previous)
    expect(store.canRedo).toBe(true)
  })
  it('moves a child between containers as a single undoable transaction', () => {
    const store = useEditorStore()
    store.create()
    store.add('section')
    const first = store.selectedId!
    store.add('section')
    const second = store.selectedId!
    store.add('heading', first)
    const heading = store.selectedId!
    store.move(heading, second)
    expect(store.document.nodes[0]!.children).toHaveLength(0)
    expect(store.document.nodes[1]!.children[0]!.id).toBe(heading)
    store.undo()
    expect(store.document.nodes[0]!.children[0]!.id).toBe(heading)
    store.redo()
    expect(store.document.nodes[1]!.children[0]!.id).toBe(heading)
  })
  it('rejects nesting a container into itself or a descendant without modifying history', () => {
    const store = useEditorStore()
    store.create()
    store.add('section')
    const parent = store.selectedId!
    store.add('section', parent)
    const child = store.selectedId!
    const before = JSON.stringify(store.document)
    const historyLength = store.past.length
    store.move(parent, child)
    store.move(parent, parent)
    expect(JSON.stringify(store.document)).toBe(before)
    expect(store.past).toHaveLength(historyLength)
  })
  it('accounts for index shifts when dragging downward in the same list', () => {
    const store = useEditorStore()
    store.create()
    store.add('heading')
    const first = store.selectedId!
    store.add('text')
    const second = store.selectedId!
    store.add('button')
    const third = store.selectedId!
    store.move(first, null, 3)
    expect(store.document.nodes.map((n) => n.id)).toEqual([second, third, first])
  })
  it('invalidates redo after a new edit and keeps earlier snapshots independent', () => {
    const store = useEditorStore()
    store.create()
    store.add('heading')
    const id = store.selectedId!
    store.update(id, { content: 'First' })
    store.update(id, { content: 'Second' })
    store.undo()
    expect(store.selected?.content).toBe('First')
    store.update(id, { content: 'Third' })
    expect(store.canRedo).toBe(false)
    store.undo()
    expect(store.selected?.content).toBe('First')
  })
  it('duplicates a nested subtree using new IDs and preserves animation settings', () => {
    const store = useEditorStore()
    const original = store.document.nodes[0]!
    store.update(original.id, {}, undefined, { enabled: true, y: 120 })
    store.duplicate(original.id)
    const copy = store.document.nodes[1]!
    expect(copy.id).not.toBe(original.id)
    expect(copy.children[0]!.id).not.toBe(original.children[0]!.id)
    expect(copy.animation.y).toBe(120)
  })
  it('clears a child selection when its ancestor is deleted', () => {
    const store = useEditorStore()
    const parent = store.document.nodes[0]!
    store.selectedId = parent.children[0]!.id
    store.remove(parent.id)
    expect(store.selectedId).toBeNull()
    store.undo()
    expect(store.document.nodes).toHaveLength(1)
  })
  it('can undo a new blank page and restore the previous document identity', () => {
    const store = useEditorStore()
    const previous = store.document.id
    store.create()
    expect(store.document.nodes).toHaveLength(0)
    store.undo()
    expect(store.document.id).toBe(previous)
    expect(store.document.nodes).toHaveLength(1)
  })
  it('bounds snapshot memory to sixty entries', () => {
    const store = useEditorStore()
    for (let i = 0; i < 70; i++)
      store.commit((doc) => {
        doc.name = `Page ${i}`
      })
    expect(store.past).toHaveLength(60)
  })
  it('ignores moving into a non-container', () => {
    const store = useEditorStore()
    const section = store.document.nodes[0]!
    const before = JSON.stringify(store.document)
    store.move(section.children[1]!.id, section.children[0]!.id)
    expect(JSON.stringify(store.document)).toBe(before)
  })
})
describe('persistence and hostile data', () => {
  it('roundtrips nested styles and animation settings', () => {
    const doc = newDocument(true)
    doc.nodes[0]!.children[1]!.animation = {
      enabled: true,
      x: 32,
      y: 70,
      scale: 0.8,
      rotation: -12,
      opacity: 0.1,
      duration: 1.2,
      trigger: 75,
      scrub: true,
    }
    saveDocument(doc)
    expect(loadDocument()).toEqual(doc)
  })
  it('does not overwrite a corrupt saved draft during restore', () => {
    localStorage.setItem(STORAGE_KEY, '{bad json')
    const store = useEditorStore()
    store.restore()
    expect(store.error).toContain('无法读取')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{bad json')
  })
  it('reports storage quota failure without claiming successful save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    const store = useEditorStore()
    store.create()
    expect(store.save()).toBe(false)
    expect(store.dirty).toBe(true)
    expect(store.error).toContain('保存失败')
  })
  it('rejects invalid versions, duplicates, numeric ranges and child-bearing leaf nodes', () => {
    expect(() => parseDocument({ version: 9 })).toThrow()
    const doc = newDocument(true)
    doc.nodes.push(doc.nodes[0]!)
    expect(() => parseDocument(doc)).toThrow()
    const ranged = newDocument(true)
    ranged.nodes[0]!.style.fontSize = -20
    expect(() => parseDocument(ranged)).toThrow()
    const leaf = newDocument()
    const heading = createNode('heading')
    heading.children.push(createNode('text'))
    leaf.nodes.push(heading)
    expect(() => parseDocument(leaf)).toThrow()
  })
  it('rejects excessive nesting before rendering', () => {
    const doc = newDocument()
    let node = createNode('section')
    doc.nodes.push(node)
    for (let i = 0; i < 15; i++) {
      const child = createNode('section')
      node.children.push(child)
      node = child
    }
    expect(() => parseDocument(doc)).toThrow()
  })
  it('blocks executable and protocol-relative URLs while keeping safe targets', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('')
    expect(safeUrl('data:text/html,hello')).toBe('')
    expect(safeUrl('//other.example')).toBe('')
    expect(safeUrl('/images/landscape.svg', true)).toBe('/images/landscape.svg')
    expect(safeUrl('https://example.com')).toBe('https://example.com')
    expect(safeUrl('mailto:hello@example.com')).toBe('mailto:hello@example.com')
  })
})
