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
import type { NodeKind, PageDocument, PageNode } from '../types/editor'

export const useEditorStore = defineStore('editor', () => {
  const document = ref<PageDocument>(newDocument(true))
  const selectedId = ref<string | null>(null)
  const past = ref<PageDocument[]>([])
  const future = ref<PageDocument[]>([])
  const status = ref('尚未保存')
  const error = ref('')
  const dirty = ref(false)
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
      error.value = '操作未应用：页面最多支持 500 个组件和 13 层嵌套，请精简后重试。'
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
    })
    if (!selected.value) selectedId.value = null
  }
  function duplicate(id: string) {
    commit((doc) => {
      const loc = findLocation(doc.nodes, id)
      if (!loc) return
      const node = clone(loc.siblings[loc.index]!)
      const rekey = (n: PageNode) => {
        n.id = crypto.randomUUID()
        n.children.forEach(rekey)
      }
      rekey(node)
      node.name += ' 副本'
      loc.siblings.splice(loc.index + 1, 0, node)
      selectedId.value = node.id
    })
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
  function save() {
    try {
      saveDocument(document.value)
      dirty.value = false
      error.value = ''
      status.value = '已保存到本机'
      return true
    } catch {
      error.value = '保存失败：浏览器存储不可用或已满。请导出 JSON 备份。'
      return false
    }
  }
  function restore() {
    try {
      const saved = loadDocument()
      if (saved) {
        document.value = saved
        status.value = '已恢复本地草稿'
      }
    } catch {
      error.value = '本地草稿无法读取。原数据未被覆盖，请先导出或检查浏览器存储。'
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
  return {
    document,
    selectedId,
    selected,
    past,
    future,
    status,
    error,
    dirty,
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
    restore,
    replace,
    create,
  }
})
