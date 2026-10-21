import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { createPinia, setActivePinia } from 'pinia'
import { clone, newDocument } from '../src/core/document'
import { createTemplate, duplicateDocument, templates } from '../src/core/templates'
import { flattenNodes } from '../src/core/motion'
import { projectThumbnail } from '../src/core/thumbnail'
import * as storage from '../src/services/projects'
import { STORAGE_KEY } from '../src/services/storage'
import { useEditorStore } from '../src/stores/editor'
import { useProjectsStore } from '../src/stores/projects'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('indexedDB', new IDBFactory())
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(async () => {
  await storage.closeProjectDatabase()
  vi.unstubAllGlobals()
})
describe('project database and migration', () => {
  it('lists lightweight summaries without dropping embedded assets from storage', async () => {
    const doc = newDocument()
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='
    doc.assets = [
      {
        id: crypto.randomUUID(),
        name: 'image.png',
        mime: 'image/png',
        dataUrl: `data:image/png;base64,${png}`,
        bytes: atob(png).length,
        width: 1,
        height: 1,
      },
    ]
    const saved = await storage.createProject(doc)
    const summaries = await storage.listProjectSummaries()
    expect(summaries[0]!.document).toEqual({ name: doc.name })
    expect(JSON.stringify(summaries)).not.toContain(png)
    expect((await storage.getProject(saved.id)).document.assets).toEqual(doc.assets)
  })
  it('loads complete documents when renaming a summary and still rejects stale revisions', async () => {
    const doc = createTemplate('portfolio'),
      record = await storage.createProject(doc),
      store = useProjectsStore()
    await store.refresh()
    const summary = store.projects[0]!
    await store.rename(summary, 'renamed through summary')
    const saved = await storage.getProject(record.id)
    expect(saved.document.nodes).toEqual(doc.nodes)
    expect(saved.document.name).toBe('renamed through summary')
    await expect(store.rename(summary, 'stale rename')).rejects.toThrow()
    expect((await storage.getProject(record.id)).document.name).toBe('renamed through summary')
  })
  it('rolls back a quota failure without changing the saved project', async () => {
    const project = await storage.createProject(newDocument()),
      next = clone(project.document)
    next.name = 'must not commit'
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    await expect(storage.updateProject(project.id, next, project.revision)).rejects.toThrow(
      '存储空间不足',
    )
    expect(await storage.getProject(project.id)).toEqual(project)
  })
  it('retries migration after an aborted transaction without deleting the legacy backup', async () => {
    const raw = JSON.stringify(newDocument(true))
    localStorage.setItem(STORAGE_KEY, raw)
    const spy = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    await expect(storage.initializeProjects()).rejects.toThrow('存储空间不足')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    spy.mockRestore()
    await storage.initializeProjects()
    expect(await storage.listProjects()).toHaveLength(1)
  })
  it('migrates the original draft once, preserves raw data, and survives concurrent initialization', async () => {
    const doc = newDocument(true),
      raw = JSON.stringify(doc)
    localStorage.setItem(STORAGE_KEY, raw)
    await Promise.all([storage.initializeProjects(), storage.initializeProjects()])
    const projects = await storage.listProjects()
    expect(projects).toHaveLength(1)
    expect(projects[0]!.document).toEqual(doc)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    await storage.initializeProjects()
    expect(await storage.listProjects()).toHaveLength(1)
  })
  it('reads v1 backups and migrates them into the library', async () => {
    const doc = newDocument()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...doc, version: 1, timeline: undefined }))
    await storage.initializeProjects()
    expect((await storage.listProjects())[0]!.document.version).toBe(3)
  })
  it('preserves corrupt legacy data while allowing unrelated new projects', async () => {
    localStorage.setItem(STORAGE_KEY, '{corrupt')
    expect(await storage.initializeProjects()).toContain('旧草稿无法读取')
    await storage.createProject(createTemplate('portfolio'))
    expect(await storage.listProjects()).toHaveLength(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{corrupt')
  })
  it('creates independent records and rejects stale updates atomically', async () => {
    const first = await storage.createProject(newDocument(true))
    const doc = clone(first.document)
    doc.name = '新的名字'
    const saved = await storage.updateProject(first.id, doc, first.revision)
    expect(saved.revision).toBe(2)
    expect(saved.thumbnail).toContain('<svg')
    await expect(storage.updateProject(first.id, first.document, 1)).rejects.toThrow('其他标签页')
    expect((await storage.getProject(first.id)).document.name).toBe('新的名字')
  })
  it('never resurrects a deleted project from a delayed save', async () => {
    const project = await storage.createProject(newDocument())
    await storage.deleteProject(project.id, project.revision)
    await expect(
      storage.updateProject(project.id, project.document, project.revision),
    ).rejects.toThrow()
    expect(await storage.listProjects()).toHaveLength(0)
  })
  it('rejects deletion from a stale library list', async () => {
    const project = await storage.createProject(newDocument())
    await storage.updateProject(project.id, project.document, project.revision)
    await expect(storage.deleteProject(project.id, project.revision)).rejects.toThrow('刷新列表')
    expect(await storage.listProjects()).toHaveLength(1)
  })
})
describe('templates and project duplication', () => {
  it('keeps thumbnail URLs valid when titles contain surrogate pairs or malformed Unicode', () => {
    const doc = newDocument(true)
    doc.nodes[0]!.children[1]!.content = 'a'.repeat(20) + '\ud83c\udf3f'
    expect(() => encodeURIComponent(projectThumbnail(doc))).not.toThrow()
    doc.nodes[0]!.children[1]!.content = '\ud800invalid title'
    expect(() => encodeURIComponent(projectThumbnail(doc))).not.toThrow()
  })
  it.each(templates.map((t) => t.id))('creates fresh editable %s templates', async (id) => {
    const first = createTemplate(id),
      second = createTemplate(id)
    expect(first.id).not.toBe(second.id)
    const project = await storage.createProject(first)
    expect((await storage.getProject(project.id)).document).toEqual(first)
    expect(
      flattenNodes(first.nodes).every(
        (n) => !flattenNodes(second.nodes).some((other) => other.id === n.id),
      ),
    ).toBe(true)
  })
  it('duplicates node/frame identities and remaps internal links and timeline triggers', () => {
    const original = createTemplate('portfolio')
    original.timeline.triggerNodeId = original.nodes[1]!.id
    const copy = duplicateDocument(original)
    expect(copy.nodes[0]!.children[3]!.href).toBe(`#${copy.nodes[1]!.id}`)
    expect(copy.timeline.triggerNodeId).toBe(copy.nodes[1]!.id)
    expect(copy.id).not.toBe(original.id)
    expect(copy.nodes[0]!.children[1]!.animation.keyframes[0]!.id).not.toBe(
      original.nodes[0]!.children[1]!.animation.keyframes[0]!.id,
    )
    copy.nodes[0]!.children[1]!.content = '独立副本'
    expect(original.nodes[0]!.children[1]!.content).not.toBe('独立副本')
  })
  it('escapes user content in stored layout thumbnails', () => {
    const doc = newDocument(true)
    doc.nodes[0]!.children[1]!.content = '<script> & "test"'
    const thumbnail = projectThumbnail(doc)
    expect(thumbnail).toContain('&lt;script&gt;')
    expect(thumbnail).not.toContain('<script>')
  })
})
describe('editor project isolation and recovery', () => {
  it('preserves a protected corrupt journal if an explicit database save fails', async () => {
    const project = await storage.createProject(newDocument()),
      store = useEditorStore()
    localStorage.setItem(storage.journalKey(project.id), '{corrupt')
    await store.openProject(project.id)
    vi.spyOn(storage, 'updateProject').mockRejectedValue(new Error('存储空间不足'))
    expect(await store.save()).toBe(false)
    expect(localStorage.getItem(storage.journalKey(project.id))).toBe('{corrupt')
    expect(store.recoveryRequired).toBe(true)
  })
  it('flushes the old work before switching and resets undo and selection', async () => {
    const a = await storage.createProject(createTemplate('portfolio')),
      b = await storage.createProject(createTemplate('story'))
    const store = useEditorStore()
    await store.openProject(a.id)
    store.selectedId = store.document.nodes[0]!.id
    store.commit((doc) => {
      doc.name = '作品 A 的修改'
    })
    expect(await store.openProject(b.id)).toBe(true)
    expect((await storage.getProject(a.id)).document.name).toBe('作品 A 的修改')
    expect(store.document.name).toBe(b.document.name)
    expect(store.canUndo).toBe(false)
    expect(store.selectedId).toBeNull()
    store.undo()
    expect(store.document.name).toBe(b.document.name)
  })
  it('serializes saves so the latest edit wins without clearing newer dirty state', async () => {
    const project = await storage.createProject(newDocument()),
      store = useEditorStore()
    await store.openProject(project.id)
    store.commit((doc) => {
      doc.name = 'first'
    })
    const firstSave = store.save()
    store.commit((doc) => {
      doc.name = 'second'
    })
    await firstSave
    expect(store.dirty).toBe(true)
    expect(storage.readJournal(project.id)!.document.name).toBe('second')
    const secondSave = store.save()
    store.commit((doc) => {
      doc.name = 'third'
    })
    const thirdSave = store.save()
    expect(await Promise.all([secondSave, thirdSave])).toEqual([true, true])
    expect((await storage.getProject(project.id)).document.name).toBe('third')
    expect(store.dirty).toBe(false)
  })
  it('blocks switching if the current project cannot be saved', async () => {
    const a = await storage.createProject(newDocument()),
      b = await storage.createProject(newDocument())
    const store = useEditorStore()
    await store.openProject(a.id)
    store.commit((doc) => {
      doc.name = 'unsaved'
    })
    vi.spyOn(storage, 'updateProject').mockRejectedValue(new Error('存储空间不足'))
    expect(await store.openProject(b.id)).toBe(false)
    expect(store.projectId).toBe(a.id)
    expect(store.document.name).toBe('unsaved')
    expect(store.dirty).toBe(true)
  })
  it('restores a matching emergency journal then saves it to IndexedDB', async () => {
    const project = await storage.createProject(newDocument()),
      pending = clone(project.document)
    pending.name = '关闭前的最后一次输入'
    storage.writeJournal(project.id, pending, project.revision)
    const store = useEditorStore()
    await store.openProject(project.id)
    expect(store.document.name).toBe(pending.name)
    expect(store.dirty).toBe(true)
    expect(await store.autosave()).toBe(true)
    expect((await storage.getProject(project.id)).document.name).toBe(pending.name)
    expect(storage.readJournal(project.id)).toBeNull()
  })
  it('preserves conflicting and corrupt journals until an explicit save', async () => {
    const project = await storage.createProject(newDocument()),
      pending = clone(project.document)
    pending.name = 'older tab'
    storage.writeJournal(project.id, pending, 0)
    const store = useEditorStore()
    await store.openProject(project.id)
    expect(store.recoveryRequired).toBe(true)
    expect(store.document).toEqual(project.document)
    store.error = ''
    store.commit((doc) => {
      doc.name = 'current tab'
    })
    expect(await store.autosave()).toBe(false)
    expect(storage.readJournal(project.id)!.document.name).toBe('older tab')
    expect(await store.save()).toBe(true)
    localStorage.setItem(storage.journalKey(project.id), '{corrupt')
    await store.openProject(project.id)
    expect(store.recoveryRequired).toBe(true)
    expect(store.journal()).toBe(false)
    expect(localStorage.getItem(storage.journalKey(project.id))).toBe('{corrupt')
  })
  it('can persist to IndexedDB if the small localStorage journal is unavailable', async () => {
    const project = await storage.createProject(newDocument()),
      store = useEditorStore()
    await store.openProject(project.id)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota', 'QuotaExceededError')
    })
    store.commit((doc) => {
      doc.name = 'stored in database'
    })
    expect(store.journal()).toBe(false)
    expect(await store.save()).toBe(true)
    expect((await storage.getProject(project.id)).document.name).toBe('stored in database')
  })
})
