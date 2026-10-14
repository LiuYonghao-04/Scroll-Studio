<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  FilePlus2,
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
import { useEditorStore } from '../stores/editor'
import { useDragDrop } from '../composables/useDragDrop'
import { parseDocument } from '../core/document'
import { deviceWidths, type Device } from '../types/editor'
const store = useEditorStore()
const { drop } = useDragDrop()
const device = ref<Device>('desktop')
const preview = ref(false)
const menu = ref(false)
const newPage = ref(false)
const side = ref<'library' | 'properties' | null>(null)
const stage = ref<HTMLElement>()
const stageWidth = ref(900)
const file = ref<HTMLInputElement>()
const previewButton = ref<HTMLButtonElement>()
const zoom = computed(() =>
  Math.min(1, Math.max(0.15, (stageWidth.value - 64) / deviceWidths[device.value])),
)
let observer: ResizeObserver | undefined
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => store.document,
  () => {
    clearTimeout(timer)
    if (store.dirty && !store.error) timer = setTimeout(() => store.save(), 900)
  },
  { deep: true },
)
function openNewPage() {
  newPage.value = true
  menu.value = false
}
function createBlankPage() {
  store.create()
  newPage.value = false
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
    if (selected.size > 2_000_000) throw new Error('文件不能超过 2 MB。')
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
  if (event.key === 'Escape') {
    preview.value = false
    menu.value = false
    newPage.value = false
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
  if (store.dirty && !store.save()) event.preventDefault()
}
async function closePreview() {
  preview.value = false
  await nextTick()
  previewButton.value?.focus()
}
onMounted(() => {
  if (!store.dirty && !store.past.length) store.restore()
  observer = new ResizeObserver((entries) => {
    stageWidth.value = entries[0]?.contentRect.width ?? 900
  })
  if (stage.value) observer.observe(stage.value)
  window.addEventListener('keydown', shortcuts)
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(timer)
  window.removeEventListener('keydown', shortcuts)
  window.removeEventListener('beforeunload', beforeUnload)
  if (store.dirty && !store.error) store.save()
})
</script>
<template>
  <div class="editor-shell">
    <div :inert="preview || newPage">
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
              ><button @click="openNewPage"><FilePlus2 :size="15" />新建页面</button
              ><button @click="exportJson"><Download :size="15" />导出页面 JSON</button
              ><button @click="file?.click()"><Upload :size="15" />导入页面 JSON</button
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
          ><button ref="previewButton" class="btn dark small" @click="preview = true">
            <Play :size="14" />预览<ArrowUpRight :size="14" />
          </button>
        </div>
      </header>
      <div v-if="store.error" class="error-banner" role="alert">
        {{ store.error
        }}<button aria-label="关闭错误提示" @click="store.error = ''"><X :size="14" /></button>
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
                  <NodeRenderer :node="node" editing
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
          <footer class="canvas-status">
            <span><Check :size="12" />自动保存至本机</span
            ><span>Vue 3 + TypeScript <i></i>Scroll Studio 0.1</span>
          </footer>
        </main>
        <PropertyPanel />
      </div>
      <input ref="file" type="file" accept="application/json,.json" hidden @change="importJson" />
    </div>
    <PreviewOverlay v-if="preview" @close="closePreview" />
    <div v-if="newPage" class="modal-backdrop" @click.self="newPage = false">
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="new-page-title">
        <FilePlus2 :size="28" />
        <h2 id="new-page-title">从新的灵感开始</h2>
        <p>新页面将替换当前工作区。你可以先导出 JSON 保留副本；新建后也可以撤销返回。</p>
        <div class="dialog-actions">
          <button class="btn" autofocus @click="newPage = false">继续编辑</button
          ><button class="btn dark" @click="createBlankPage">创建空白页面</button>
        </div>
      </section>
    </div>
  </div>
</template>
