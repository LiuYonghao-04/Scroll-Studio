import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  clone,
  createNode,
  findLocation,
  findNode,
  newDocument,
  parseDocument,
} from '../core/document'
import { loadDocument, saveDocument } from '../services/storage'
import type { AnimationKeyframe, NodeKind, PageDocument, PageNode } from '../types/editor'
import { insertKeyframe } from '../core/motion'
import {
  ACTIVE_PROJECT_KEY,
  getProject,
  journalKey,
  readJournal,
  updateProject,
  writeJournal,
} from '../services/projects'

export const useEditorStore = defineStore('editor', () => {
  const document = ref<PageDocument>(newDocument(true))
  const selectedId = ref<string | null>(null)
  const inspectorTab = ref<'style' | 'motion'>('style')
  const selectedKeyframeId = ref<string | null>(null)
  const past = ref<PageDocument[]>([])
  const future = ref<PageDocument[]>([])
  const status = ref('尚未保存')
  const error = ref('')
  // A corrupt on-disk draft must survive background saves, even if its banner is dismissed.
  const recoveryRequired = ref(false)
  const dirty = ref(false)
  const projectId = ref<string | null>(null)
  const projectRevision = ref(0)
  let saveQueue: Promise<boolean> = Promise.resolve(true)
  let openVersion = 0
  const selected = computed(() =>
    selectedId.value ? findNode(document.value.nodes, selectedId.value) : undefined,
  )
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  let lastGroup: string | undefined
  let lastEdit = 0
  function commit(mutate: (doc: PageDocument) => void, group?: string) {
    const before = clone(document.value)
    const next = clone(before)
    mutate(next)
    if (JSON.stringify(before) === JSON.stringify(next)) return false
    // Validate before committing so invalid input can never poison history or persistence.
    try {
      parseDocument(next)
    } catch {
      error.value = '操作未应用：请检查动画参数、关键帧顺序及页面限制（500 个组件、13 层嵌套）。'
      return false
    }
    if (!group || group !== lastGroup || Date.now() - lastEdit > 750) past.value.push(before)
    lastGroup = group
    lastEdit = Date.now()
    if (past.value.length > 60) past.value.shift()
    future.value = []
    next.updatedAt = new Date().toISOString()
    document.value = next
    dirty.value = true
    status.value = '有未保存的修改'
    return true
  }
  function add(kind: NodeKind, parentId: string | null = null, index?: number) {
    const node = createNode(kind)
    const added = commit((doc) => {
      const parent = parentId ? findNode(doc.nodes, parentId) : undefined
      if (parentId && parent?.kind !== 'section') return
      const siblings = parent?.children ?? doc.nodes
      siblings.splice(index ?? siblings.length, 0, node)
    })
    if (added) selectedId.value = node.id
  }
  function update(
    id: string,
    patch: Partial<Pick<PageNode, 'name' | 'content' | 'src' | 'href'>>,
    style?: Partial<PageNode['style']>,
    animation?: Partial<PageNode['animation']>,
    group?: string,
  ) {
    commit((doc) => {
      const node = findNode(doc.nodes, id)
      if (!node) return
      Object.assign(node, patch)
      if (style) Object.assign(node.style, style)
      if (animation) Object.assign(node.animation, animation)
    }, group)
  }
  function move(id: string, parentId: string | null, index?: number) {
    commit((doc) => {
      const node = findNode(doc.nodes, id)
      if (!node || id === parentId || (parentId && findNode(node.children, parentId))) return
      const parent = parentId ? findNode(doc.nodes, parentId) : undefined
      if (parentId && parent?.kind !== 'section') return
      const location = findLocation(doc.nodes, id)
      if (!location) return
      const target = parent?.children ?? doc.nodes
      let position = index ?? target.length
      if (location.siblings === target && location.index < position) position--
      location.siblings.splice(location.index, 1)
      target.splice(Math.max(0, Math.min(position, target.length)), 0, node)
    })
  }
  function reorder(id: string, direction: -1 | 1) {
    commit((doc) => {
      const loc = findLocation(doc.nodes, id)
      if (!loc) return
      const target = loc.index + direction
      if (target < 0 || target >= loc.siblings.length) return
      const [node] = loc.siblings.splice(loc.index, 1)
      if (node) loc.siblings.splice(target, 0, node)
    })
  }
  function remove(id: string) {
    commit((doc) => {
      const loc = findLocation(doc.nodes, id)
      if (loc) loc.siblings.splice(loc.index, 1)
      if (doc.timeline.triggerNodeId && !findNode(doc.nodes, doc.timeline.triggerNodeId))
        doc.timeline.triggerNodeId = null
    })
    if (!selected.value) selectedId.value = null
  }
  function duplicate(id: string) {
    let duplicatedId: string | undefined
    const duplicated = commit((doc) => {
      const loc = findLocation(doc.nodes, id)
      if (!loc) return
      const node = clone(loc.siblings[loc.index]!)
      const rekey = (n: PageNode) => {
        n.id = crypto.randomUUID()
        n.animation.keyframes.forEach((frame) => {
          frame.id = crypto.randomUUID()
        })
        n.children.forEach(rekey)
      }
      rekey(node)
      node.name += ' 副本'
      loc.siblings.splice(loc.index + 1, 0, node)
      duplicatedId = node.id
    })
    if (duplicated && duplicatedId) selectedId.value = duplicatedId
  }
  function undo() {
    lastGroup = undefined
    const previous = past.value.pop()
    if (!previous) return
    future.value.push(clone(document.value))
    document.value = previous
    dirty.value = true
    status.value = '已撤销 · 待保存'
    if (!selected.value) selectedId.value = null
  }
  function redo() {
    lastGroup = undefined
    const next = future.value.pop()
    if (!next) return
    past.value.push(clone(document.value))
    document.value = next
    dirty.value = true
    status.value = '已重做 · 待保存'
    if (!selected.value) selectedId.value = null
  }
  async function save(): Promise<boolean> {
    if (projectId.value) {
      const id = projectId.value,
        snapshot = clone(document.value)
      const operation = async () => {
        if (projectId.value !== id) return false
        try {
          try {
            if (!recoveryRequired.value) writeJournal(id, document.value, projectRevision.value)
          } catch {
            /* IndexedDB remains the primary store. */
          }
          const saved = await updateProject(id, snapshot, projectRevision.value)
          if (projectId.value !== id) return true
          projectRevision.value = saved.revision
          const unchanged = JSON.stringify(document.value) === JSON.stringify(snapshot)
          dirty.value = !unchanged
          recoveryRequired.value = false
          error.value = ''
          status.value = unchanged ? '已保存到作品库' : '有未保存的修改'
          try {
            if (unchanged) localStorage.removeItem(journalKey(id))
            else writeJournal(id, document.value, saved.revision)
          } catch {
            /* A successful database transaction is already durable. */
          }
          return true
        } catch (reason) {
          error.value =
            reason instanceof Error ? reason.message : '作品保存失败，请导出 JSON 备份。'
          return false
        }
      }
      saveQueue = saveQueue.then(operation, operation)
      return saveQueue
    }
    try {
      saveDocument(document.value)
      dirty.value = false
      recoveryRequired.value = false
      error.value = ''
      status.value = '已保存到本机'
      return true
    } catch {
      error.value = '保存失败：浏览器存储不可用或已满。请导出 JSON 备份。'
      return false
    }
  }
  async function autosave() {
    if (recoveryRequired.value) return false
    return save()
  }
  function journal() {
    if (recoveryRequired.value) return false
    try {
      if (projectId.value) writeJournal(projectId.value, document.value, projectRevision.value)
      else saveDocument(document.value)
      return true
    } catch {
      return false
    }
  }
  async function openProject(id: string): Promise<boolean> {
    const version = ++openVersion
    if (dirty.value && projectId.value && !(await autosave())) return false
    await saveQueue
    const saved = await getProject(id)
    if (version !== openVersion) return false
    let next = saved.document,
      recovered = false,
      warning = ''
    try {
      const pending = readJournal(id)
      if (pending && JSON.stringify(pending.document) !== JSON.stringify(saved.document)) {
        if (pending.revision !== saved.revision)
          warning = '待保存草稿与作品版本不一致，原草稿已保留。请先下载恢复备份，再决定是否导入。'
        else {
          next = pending.document
          recovered = true
        }
      }
    } catch {
      warning = '待保存草稿无法读取，原数据已保留。请先下载恢复备份，再手动保存当前画布。'
    }
    document.value = clone(next)
    projectId.value = id
    projectRevision.value = saved.revision
    selectedId.value = null
    selectedKeyframeId.value = null
    past.value = []
    future.value = []
    lastGroup = undefined
    dirty.value = recovered
    recoveryRequired.value = !!warning
    error.value = warning
    status.value = warning
      ? '恢复需处理 · 自动保存已暂停'
      : recovered
        ? '已恢复待保存草稿'
        : '已打开作品'
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id)
    } catch {
      /* Direct project URLs still work. */
    }
    return true
  }
  function cancelOpening() {
    openVersion++
  }
  function restore() {
    try {
      const saved = loadDocument()
      if (saved) {
        document.value = saved
        status.value = '已恢复本地草稿'
      }
      recoveryRequired.value = false
    } catch {
      recoveryRequired.value = true
      status.value = '草稿恢复失败 · 自动保存已暂停'
      error.value = '本地草稿无法读取，原数据已保留。请导入有效备份，或点击「保存」用当前画布覆盖。'
    }
  }
  function replace(doc: PageDocument) {
    const valid = parseDocument(doc)
    commit((current) => Object.assign(current, valid))
    selectedId.value = null
  }
  function create(starter = false) {
    replace(newDocument(starter))
  }
  function addKeyframe(id: string) {
    const node = findNode(document.value.nodes, id)
    if (!node) return
    const frames = insertKeyframe(node.animation.keyframes)
    const inserted = frames.find(
      (frame) => !node.animation.keyframes.some((old) => old.id === frame.id),
    )
    if (
      inserted &&
      commit((doc) => {
        findNode(doc.nodes, id)!.animation.keyframes = frames
      })
    )
      selectedKeyframeId.value = inserted.id
  }
  function updateKeyframe(
    id: string,
    frameId: string,
    patch: Partial<Omit<AnimationKeyframe, 'id'>>,
  ) {
    commit((doc) => {
      const frame = findNode(doc.nodes, id)?.animation.keyframes.find((f) => f.id === frameId)
      if (frame) Object.assign(frame, patch)
    })
  }
  function removeKeyframe(id: string, frameId: string) {
    commit((doc) => {
      const frames = findNode(doc.nodes, id)?.animation.keyframes
      const index = frames?.findIndex((frame) => frame.id === frameId) ?? -1
      if (frames && index > 0 && index < frames.length - 1) frames.splice(index, 1)
    })
  }
  return {
    document,
    selectedId,
    inspectorTab,
    selectedKeyframeId,
    selected,
    past,
    future,
    status,
    error,
    recoveryRequired,
    dirty,
    projectId,
    projectRevision,
    canUndo,
    canRedo,
    commit,
    add,
    update,
    move,
    reorder,
    remove,
    duplicate,
    undo,
    redo,
    save,
    autosave,
    journal,
    openProject,
    cancelOpening,
    restore,
    replace,
    create,
    addKeyframe,
    updateKeyframe,
    removeKeyframe,
  }
})
