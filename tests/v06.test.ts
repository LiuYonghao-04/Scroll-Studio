import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { clone, createNode, equal, newDocument, parseDocument } from '../src/core/document'
import { deviceForWidth, resolveStyle, validStyle } from '../src/core/responsive'
import { assetReferences, validAsset } from '../src/core/media'
import { imageSrc } from '../src/core/assets'
import { createBlock, blockPresets, motionPresets, presetFrames } from '../src/core/presets'
import { flattenNodes, validAnimation } from '../src/core/motion'
import { duplicateDocument } from '../src/core/templates'
import { useEditorStore } from '../src/stores/editor'
import type { MediaAsset } from '../src/types/editor'

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='
const asset = (): MediaAsset => ({
  id: crypto.randomUUID(),
  name: 'sample.png',
  mime: 'image/png',
  dataUrl: `data:image/png;base64,${png}`,
  bytes: atob(png).length,
  width: 1,
  height: 1,
})
beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('v3 migration and responsive styles', () => {
  it('migrates actual v2 style shapes without mutating raw input or IDs', () => {
    const doc = newDocument(true)
    const legacy = {
      ...doc,
      version: 2,
      assets: undefined,
      nodes: doc.nodes.map((node) => ({
        ...node,
        responsive: undefined,
        style: Object.fromEntries(
          Object.entries(node.style).filter(([key]) =>
            [
              'color',
              'background',
              'fontSize',
              'fontFamily',
              'padding',
              'margin',
              'radius',
              'gap',
              'align',
              'layout',
            ].includes(key),
          ),
        ),
        children: [],
      })),
    }
    const raw = JSON.stringify(legacy)
    const migrated = parseDocument(raw)
    expect(migrated.version).toBe(3)
    expect(migrated.nodes[0]!.id).toBe(doc.nodes[0]!.id)
    expect(resolveStyle(migrated.nodes[0]!, 'mobile').padding).toBe(24)
    expect(migrated.assets).toEqual([])
    expect(parseDocument(migrated)).toEqual(migrated)
    expect(JSON.stringify(legacy)).toBe(raw)
  })
  it('rejects string versions and malformed override fields or values', () => {
    expect(() => parseDocument({ ...newDocument(), version: '3' })).toThrow()
    const doc = newDocument(true)
    expect(() =>
      parseDocument({
        ...doc,
        nodes: [{ ...doc.nodes[0], responsive: { tablet: {}, mobile: { position: 'fixed' } } }],
      }),
    ).toThrow()
    expect(validStyle({ fontSize: NaN }, true)).toBe(false)
    expect(validStyle({ borderColor: 'url(https://example.com)' }, true)).toBe(false)
  })
  it('inherits tablet from desktop, mobile from tablet, with explicit mobile overrides', () => {
    const node = createNode('text')
    node.style.fontSize = 32
    node.responsive.tablet = { fontSize: 24, borderWidth: 2 }
    node.responsive.mobile = { fontSize: 18 }
    expect(resolveStyle(node, 'desktop').fontSize).toBe(32)
    expect(resolveStyle(node, 'tablet').fontSize).toBe(24)
    expect(resolveStyle(node, 'mobile')).toMatchObject({ fontSize: 18, borderWidth: 2 })
    expect(node.style.fontSize).toBe(32)
  })
  it('edits and resets a breakpoint in single undoable transactions', () => {
    const store = useEditorStore()
    store.create()
    store.add('text')
    const id = store.selectedId!
    store.device = 'tablet'
    store.updateStyle(id, { width: 75, widthUnit: '%', borderWidth: 2 })
    expect(store.selected!.style.width).toBe(0)
    store.device = 'mobile'
    store.updateStyle(id, { width: 90 })
    expect(resolveStyle(store.selected!, 'mobile').width).toBe(90)
    store.resetStyle(id)
    expect(resolveStyle(store.selected!, 'mobile').width).toBe(75)
    store.undo()
    expect(resolveStyle(store.selected!, 'mobile').width).toBe(90)
    store.redo()
    expect(store.selected!.responsive.mobile).toEqual({})
  })
  it('rejects a cascading invalid percent width without adding history', () => {
    const store = useEditorStore()
    store.add('image')
    const id = store.selectedId!
    store.updateStyle(id, { width: 500 })
    const before = clone(store.document),
      steps = store.past.length
    store.device = 'tablet'
    expect(store.updateStyle(id, { widthUnit: '%' })).toBe(false)
    expect(store.document).toEqual(before)
    expect(store.past).toHaveLength(steps)
  })
  it('maps actual viewport widths to editor breakpoints', () => {
    expect([390, 600, 601, 768, 900, 901, 1120].map(deviceForWidth)).toEqual([
      'mobile',
      'mobile',
      'tablet',
      'tablet',
      'tablet',
      'desktop',
      'desktop',
    ])
  })
})

describe('portable local media', () => {
  it('validates MIME, signature, base64 byte length and image dimensions', () => {
    const image = asset()
    expect(validAsset(image)).toBe(true)
    for (const patch of [
      { mime: 'image/svg+xml' },
      { bytes: image.bytes + 1 },
      { width: 0 },
      { height: 10000 },
      { dataUrl: 'data:image/png;base64,PHN2Zz48L3N2Zz4=' },
    ])
      expect(validAsset({ ...image, ...patch })).toBe(false)
  })
  it('roundtrips embedded media, responsive styles and animation through JSON', () => {
    const doc = newDocument(),
      image = asset(),
      node = createNode('image')
    node.src = `asset:${image.id}`
    node.responsive.mobile = { height: 100, objectFit: 'contain' }
    node.animation.keyframes = presetFrames('zoom')
    doc.assets = [image]
    doc.nodes = [node]
    const restored = parseDocument(JSON.stringify(doc))
    expect(restored).toEqual(doc)
    expect(imageSrc(node.src, restored.assets)).toBe(image.dataUrl)
    expect(assetReferences(doc, image.id)).toBe(1)
  })
  it('rejects missing references, duplicate IDs, invalid responsive maps and excess media', () => {
    const doc = newDocument(),
      image = asset(),
      node = createNode('image')
    node.src = `asset:${image.id}`
    doc.nodes = [node]
    expect(() => parseDocument(doc)).toThrow()
    doc.assets = [image, image]
    expect(() => parseDocument(doc)).toThrow()
    doc.assets = Array.from({ length: 21 }, asset)
    expect(() => parseDocument(doc)).toThrow()
  })
  it('keeps asset references intact when duplicating a complete document', () => {
    const doc = newDocument(),
      image = asset(),
      node = createNode('image')
    doc.assets.push(image)
    node.src = `asset:${image.id}`
    doc.nodes.push(node)
    const copy = duplicateDocument(doc)
    expect(copy.id).not.toBe(doc.id)
    expect(copy.nodes[0]!.id).not.toBe(node.id)
    expect(copy.assets).toEqual(doc.assets)
    expect(imageSrc(copy.nodes[0]!.src, copy.assets)).toBe(image.dataUrl)
    copy.assets[0]!.name = 'copy'
    expect(doc.assets[0]!.name).toBe('sample.png')
  })
  it('rejects deleting a referenced asset and restores unused deletion through undo', () => {
    const store = useEditorStore(),
      image = asset(),
      doc = newDocument(),
      node = createNode('image')
    node.src = `asset:${image.id}`
    doc.assets = [image]
    doc.nodes = [node]
    store.replace(doc)
    expect(
      store.commit((draft) => {
        draft.assets = []
      }),
    ).toBe(false)
    expect(store.document.assets).toHaveLength(1)
    store.remove(node.id)
    expect(
      store.commit((draft) => {
        draft.assets = []
      }),
    ).toBe(true)
    store.undo()
    expect(store.document.assets).toHaveLength(1)
    store.undo()
    expect(store.document.nodes[0]!.src).toBe(`asset:${image.id}`)
  })
  it('retains immutable image contents while copying mutable structure', () => {
    const doc = newDocument()
    doc.assets = [asset()]
    const copy = clone(doc)
    expect(equal(copy, doc)).toBe(true)
    copy.assets[0]!.name = 'changed'
    expect(equal(copy, doc)).toBe(false)
    expect(doc.assets[0]!.name).toBe('sample.png')
  })
})

describe('editable presets', () => {
  it.each(blockPresets)(
    'creates valid, independently editable $name blocks with unique IDs',
    (preset) => {
      const first = createBlock(preset.id),
        second = createBlock(preset.id),
        doc = newDocument()
      doc.nodes = [first, second]
      expect(parseDocument(doc)).toEqual(doc)
      const ids = flattenNodes(doc.nodes).map((node) => node.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(first.responsive.mobile.layout).toBe('column')
    },
  )
  it.each(motionPresets)('produces valid $name keyframes with fresh IDs', (preset) => {
    const node = createNode('heading')
    node.animation.keyframes = presetFrames(preset.id)
    expect(validAnimation(node.animation, false)).toBe(true)
    expect(node.animation.keyframes[0]!.id).not.toBe(presetFrames(preset.id)[0]!.id)
  })
  it('inserts a block into a container and undoes the complete block at once', () => {
    const store = useEditorStore()
    store.create()
    store.add('section')
    const parent = store.selectedId!
    store.insertBlock(createBlock('features'), parent)
    expect(store.document.nodes[0]!.children[0]!.children).toHaveLength(3)
    store.undo()
    expect(store.document.nodes[0]!.children).toEqual([])
    store.redo()
    expect(parseDocument(store.document)).toEqual(store.document)
  })
})
