<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  FilePlus2,
  FolderOpen,
  Menu,
  Monitor,
  MousePointer2,
  Play,
  Redo2,
  Save,
  Settings2,
  Smartphone,
  Tablet,
  Undo2,
  Upload,
  X,
} from '@lucide/vue'
import BrandMark from '../components/ui/BrandMark.vue'
import ComponentLibrary from '../components/editor/ComponentLibrary.vue'
import PropertyPanel from '../components/editor/PropertyPanel.vue'
import NodeRenderer from '../components/editor/NodeRenderer.vue'
import PreviewOverlay from '../components/editor/PreviewOverlay.vue'
import QuickStartGuide from '../components/editor/QuickStartGuide.vue'
import ExportDialog from '../components/editor/ExportDialog.vue'
import TimelinePanel from '../components/editor/TimelinePanel.vue'
import ProjectCreateDialog from '../components/projects/ProjectCreateDialog.vue'
import { useProjectsStore } from '../stores/projects'
import {
  ACTIVE_PROJECT_KEY,
  createProject,
  initializeProjects,
  journalKey,
  listProjectSummaries,
} from '../services/projects'
import { newDocument } from '../core/document'
import type { TemplateId } from '../types/project'
import type { PreviewMode } from '../animation/runtime'
import { useEditorStore } from '../stores/editor'
import { useDragDrop } from '../composables/useDragDrop'
import { parseDocument } from '../core/document'
import { deviceWidths } from '../types/editor'
import { MAX_DOCUMENT_BYTES } from '../core/media'
import { APP_VERSION } from '../core/version'
const store = useEditorStore()
const projects = useProjectsStore(),
  route = useRoute(),
  router = useRouter()
const initializing = ref(true),
  routeError = ref('')
let opening = 0
const { drop } = useDragDrop()
const device = toRef(store, 'device')
const preview = ref(false)
const previewMode = ref<PreviewMode>('scroll')
const menu = ref(false)
const newPage = ref(false)
const exporting = ref(false)
const side = ref<'library' | 'properties' | null>(null)
const stage = ref<HTMLElement>()
const stageWidth = ref(900)
const file = ref<HTMLInputElement>()
const previewButton = ref<HTMLButtonElement>()
const zoom = computed(() =>
  Math.min(1, Math.max(0.15, (stageWidth.value - 64) / deviceWidths[device.value])),
)
let observer: ResizeObserver | undefined
let resizeFrame = 0
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => store.document,
  () => {
    clearTimeout(timer)
    if (store.dirty) timer = setTimeout(() => store.autosave(), 900)
  },
  { deep: true },
)
function openNewPage() {
  newPage.value = true
  menu.value = false
}
async function createNewProject(template: TemplateId, name: string) {
  if (store.dirty && !(await store.autosave()))
    throw new Error(store.error || '请先保存当前作品或导出备份。')
  const created = await projects.create(template, name)
  await router.push(`/editor/${created.id}`)
  newPage.value = false
}
async function openRoute() {
  const current = ++opening
  initializing.value = true
  routeError.value = ''
  try {
    await initializeProjects()
    const id = route.params.projectId
    if (typeof id === 'string' && id) {
      if (!(await store.openProject(id))) throw new Error(store.error || '无法切换作品。')
    } else {
      const all = await listProjectSummaries()
      let active: string | null = null
      try {
        active = localStorage.getItem(ACTIVE_PROJECT_KEY)
      } catch {
        /* Latest work remains accessible from the library. */
      }
      const project =
        all.find((p) => p.id === active) ?? all[0] ?? (await createProject(newDocument(true)))
      await router.replace(`/editor/${project.id}`)
    }
  } catch (reason) {
    if (current === opening)
      routeError.value = reason instanceof Error ? reason.message : '作品无法打开。'
  } finally {
    if (current === opening) initializing.value = false
  }
}
async function flushBeforeNavigation() {
  return !store.dirty || (await store.autosave())
}
onBeforeRouteLeave(flushBeforeNavigation)
onBeforeRouteUpdate(flushBeforeNavigation)
function downloadRecovery() {
  try {
    const raw = store.projectId ? localStorage.getItem(journalKey(store.projectId)) : null
    if (!raw) return
    let data = raw
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null && 'document' in parsed)
        data = JSON.stringify(parsed.document, null, 2)
    } catch {
      /* Preserve corrupt raw data for inspection. */
    }
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' })),
      link = document.createElement('a')
    link.href = url
    link.download = 'scroll-studio-recovery.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch {
    store.error = '无法下载恢复备份，请检查浏览器存储权限。'
  }
}
function saveFromMenu() {
  store.save()
  menu.value = false
}
function exportJson() {
  const blob = new Blob([JSON.stringify(store.document, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'scroll-studio-page.json'
  a.click()
  URL.revokeObjectURL(url)
  menu.value = false
}
async function importJson(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return
  try {
    if (selected.size > MAX_DOCUMENT_BYTES) throw new Error('文件不能超过 16 MB。')
    store.replace(parseDocument(await selected.text()))
    store.error = ''
    store.save()
  } catch (error) {
    store.error = error instanceof Error ? error.message : '无法导入该页面。'
  }
  input.value = ''
  menu.value = false
}
function shortcuts(event: KeyboardEvent) {
  if (
    preview.value ||
    newPage.value ||
    exporting.value ||
    initializing.value ||
    routeError.value ||
    (event.target instanceof Element && event.target.closest('dialog[open]'))
  ) {
    const editingDialog =
      event.target instanceof Element &&
      event.target.closest('dialog[open]') &&
      event.target.closest('input, textarea, select, [contenteditable]')
    if (
      !editingDialog &&
      (event.key === 'Delete' ||
        event.key === 'Backspace' ||
        ((event.metaKey || event.ctrlKey) && ['z', 'y', 's'].includes(event.key.toLowerCase())))
    )
      event.preventDefault()
    return
  }
  if (event.key === 'Escape') {
    menu.value = false
    return
  }
  if (
    event.target instanceof HTMLElement &&
    (event.target.closest('input, textarea, select, [contenteditable]') ||
      preview.value ||
      newPage.value)
  )
    return
  if (event.metaKey || event.ctrlKey) {
    if (event.key.toLowerCase() === 's') {
      event.preventDefault()
      store.save()
    }
    if (event.key.toLowerCase() === 'z') {
      event.preventDefault()
      event.shiftKey ? store.redo() : store.undo()
    }
    if (event.key.toLowerCase() === 'y') {
      event.preventDefault()
      store.redo()
    }
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && store.selectedId) {
    event.preventDefault()
    store.remove(store.selectedId)
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (store.dirty && !store.journal()) {
    event.preventDefault()
    event.returnValue = ''
  }
}
function persistOnHide() {
  if (!store.dirty || initializing.value) return
  store.journal()
  void store.autosave()
}
function visibilityChanged() {
  if (document.visibilityState === 'hidden') persistOnHide()
}
function openPreview(mode: PreviewMode = 'scroll') {
  previewButton.value?.focus()
  previewMode.value = mode
  preview.value = true
}
function openExport() {
  menu.value = false
  exporting.value = true
}
function inspectMotion() {
  side.value = 'properties'
}
async function closePreview() {
  preview.value = false
  await nextTick()
  previewButton.value?.focus()
}
onMounted(() => {
  observer = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 900
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      stageWidth.value = width
    })
  })
  if (stage.value) observer.observe(stage.value)
  window.addEventListener('keydown', shortcuts)
  window.addEventListener('beforeunload', beforeUnload)
  window.addEventListener('pagehide', persistOnHide)
  document.addEventListener('visibilitychange', visibilityChanged)
})
watch(() => route.params.projectId, openRoute, { immediate: true })
onBeforeUnmount(() => {
  opening++
  store.cancelOpening()
  observer?.disconnect()
  cancelAnimationFrame(resizeFrame)
  clearTimeout(timer)
  window.removeEventListener('keydown', shortcuts)
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('pagehide', persistOnHide)
  document.removeEventListener('visibilitychange', visibilityChanged)
  if (store.dirty) store.autosave()
})
</script>
<template>
  <div class="editor-shell">
    <div :inert="preview || newPage || initializing || !!routeError">
      <header class="editor-header">
        <div class="toolbar-group">
          <BrandMark compact /><span class="toolbar-divider"></span>
          <div class="document-menu">
            <button class="document-menu-button" :aria-expanded="menu" @click="menu = !menu">
              {{ store.document.name }}<ChevronDown :size="14" />
            </button>
            <div v-if="menu" class="dropdown">
              <label
                >页面名称<input
                  :value="store.document.name"
                  @change="
                    store.commit((doc) => {
                      doc.name = ($event.target as HTMLInputElement).value || '未命名页面'
                    })
                  " /></label
              ><button @click="saveFromMenu"><Save :size="15" />保存当前页面</button
              ><button @click="openNewPage"><FilePlus2 :size="15" />新建作品</button
              ><button @click="exportJson"><Download :size="15" />导出页面 JSON</button
              ><button @click="openExport"><Download :size="15" />导出网站 ZIP</button
              ><button @click="file?.click()"><Upload :size="15" />导入页面 JSON</button
              ><RouterLink to="/projects"><FolderOpen :size="15" />我的作品</RouterLink
              ><RouterLink to="/"><ArrowLeft :size="15" />返回首页</RouterLink>
            </div>
          </div>
          <span class="draft-tag">本地草稿</span>
        </div>
        <div class="toolbar-group header-status">
          <span class="save-indicator" :class="{ dirty: store.dirty }"></span
          ><span role="status">{{ store.status }}</span>
        </div>
        <div class="toolbar-group">
          <QuickStartGuide />
          <button
            class="icon-button"
            aria-label="导出网站 ZIP"
            title="导出网站 ZIP"
            @click="openExport"
          >
            <Download :size="18" />
          </button>
          <button
            class="icon-button"
            aria-label="撤销"
            title="撤销 Ctrl+Z"
            :disabled="!store.canUndo"
            @click="store.undo"
          >
            <Undo2 :size="18" /></button
          ><button
            class="icon-button"
            aria-label="重做"
            title="重做 Ctrl+Shift+Z"
            :disabled="!store.canRedo"
            @click="store.redo"
          >
            <Redo2 :size="18" /></button
          ><span class="toolbar-divider"></span
          ><button class="btn small save-button" @click="store.save"><Save :size="15" />保存</button
          ><button ref="previewButton" class="btn dark small" @click="openPreview()">
            <Play :size="14" />预览<ArrowUpRight :size="14" />
          </button>
        </div>
      </header>
      <div v-if="store.error" class="error-banner" role="alert">
        {{ store.error
        }}<button v-if="store.recoveryRequired && store.projectId" @click="downloadRecovery">
          下载恢复备份</button
        ><button aria-label="关闭错误提示" @click="store.error = ''"><X :size="14" /></button>
      </div>
      <div
        class="editor-workspace"
        :class="{ 'show-library': side === 'library', 'show-properties': side === 'properties' }"
      >
        <ComponentLibrary />
        <main class="canvas-workspace">
          <div class="canvas-toolbar">
            <div class="toolbar-group">
              <button
                class="icon-button mobile-panel-toggle"
                aria-label="组件面板"
                @click="side = side === 'library' ? null : 'library'"
              >
                <Menu :size="18" /></button
              ><span class="canvas-label">设计画布</span>
            </div>
            <div class="device-switch">
              <button
                v-for="(icon, key) in { desktop: Monitor, tablet: Tablet, mobile: Smartphone }"
                :key="key"
                :class="{ active: device === key }"
                :aria-label="`${key}画布`"
                @click="device = key"
              >
                <component :is="icon" :size="16" />
              </button>
            </div>
            <div class="toolbar-group">
              <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span
              ><button
                class="icon-button mobile-panel-toggle"
                aria-label="属性面板"
                @click="side = side === 'properties' ? null : 'properties'"
              >
                <Settings2 :size="18" />
              </button>
            </div>
          </div>
          <div ref="stage" class="canvas-stage" @click.self="store.selectedId = null">
            <div class="canvas-caption" :style="{ width: `${deviceWidths[device] * zoom}px` }">
              <span>{{ store.document.name }}</span
              ><span>{{ deviceWidths[device] }} PX</span>
            </div>
            <div class="canvas-scale-wrap" :style="{ width: `${deviceWidths[device] * zoom}px` }">
              <div
                class="canvas-page rendered-page"
                :style="{ width: `${deviceWidths[device]}px`, zoom }"
                @dragover.prevent
                @drop="drop($event, null)"
              >
                <template v-for="(node, index) in store.document.nodes" :key="node.id"
                  ><div
                    class="root-drop-slot"
                    @dragover.prevent.stop
                    @drop="drop($event, null, index)"
                  ></div>
                  <NodeRenderer
                    :node="node"
                    :device="device"
                    :assets="store.document.assets"
                    editing
                /></template>
                <div class="canvas-add" @dragover.prevent.stop @drop="drop($event, null)">
                  <span>+</span>
                  <p>
                    {{
                      store.document.nodes.length
                        ? '拖入组件，继续你的创作'
                        : '空白，也是一个好开始。'
                    }}
                  </p>
                  <small>从左侧拖入组件，或点击组件直接添加</small
                  ><button
                    v-if="!store.document.nodes.length"
                    class="btn small"
                    @click="store.add('section')"
                  >
                    添加第一个容器
                  </button>
                </div>
              </div>
            </div>
            <div class="canvas-footnote">
              <MousePointer2 :size="12" />点击编辑 · 拖动选中标签移动组件
            </div>
          </div>
          <TimelinePanel @preview="openPreview('timeline')" @inspect="inspectMotion" />
          <footer class="canvas-status">
            <span
              ><Check :size="12" />{{
                store.recoveryRequired ? '自动保存已暂停 · 请恢复或手动保存' : '自动保存至本机'
              }}</span
            ><span>Vue 3 + TypeScript <i></i>Scroll Studio {{ APP_VERSION }}</span>
          </footer>
        </main>
        <PropertyPanel @media="side = 'library'" />
      </div>
      <input ref="file" type="file" accept="application/json,.json" hidden @change="importJson" />
    </div>
    <PreviewOverlay v-if="preview" :initial-mode="previewMode" @close="closePreview" />
    <ExportDialog v-if="exporting" @close="exporting = false" />
    <ProjectCreateDialog v-if="newPage" :create="createNewProject" @close="newPage = false" />
    <div v-if="initializing || routeError" class="project-open-overlay">
      <div role="status">
        <h2>{{ routeError ? '作品暂时无法打开' : '正在打开你的作品…' }}</h2>
        <p v-if="routeError" role="alert">{{ routeError }}</p>
        <RouterLink v-if="routeError" class="btn" to="/projects">返回作品库</RouterLink>
      </div>
    </div>
  </div>
</template>
