<script setup lang="ts">
import { computed } from 'vue'
import { nodeStyle, imageStyle } from '../../core/render-style'
import { GripVertical } from '@lucide/vue'
import type { Device, MediaAsset, PageNode } from '../../types/editor'
import { resolveStyle } from '../../core/responsive'
import { safeUrl } from '../../core/document'
import { imageSrc, landscapeSrc } from '../../core/assets'
import { useEditorStore } from '../../stores/editor'
import { useDragDrop } from '../../composables/useDragDrop'
const props = defineProps<{
  node: PageNode
  editing?: boolean
  parentId?: string
  index?: number
  horizontal?: boolean
  device: Device
  assets: MediaAsset[]
}>()
const store = useEditorStore()
const { start, drop } = useDragDrop()
const resolved = computed(() => resolveStyle(props.node, props.device))
const style = computed(() => nodeStyle(props.node, props.device, props.horizontal))
function select(event: MouseEvent) {
  if (!props.editing) return
  event.stopPropagation()
  event.preventDefault()
  store.selectedId = props.node.id
}
function imageError(event: Event) {
  const image = event.target as HTMLImageElement
  // Do not retry forever if the bundled fallback itself cannot be loaded.
  if (image.src !== new URL(landscapeSrc, location.href).href) image.src = landscapeSrc
}
function followLink(event: MouseEvent) {
  if (props.editing) {
    event.preventDefault()
    return
  }
  const href = safeUrl(props.node.href) || '#'
  if (href.startsWith('#')) {
    event.preventDefault()
    const id = href.slice(1)
    if (id)
      document.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      })
  }
}
</script>
<template>
  <div
    :data-node-id="node.id"
    class="page-node"
    :class="[node.kind, { editable: editing, selected: editing && store.selectedId === node.id }]"
    :style="style"
    @click="select"
    @dragover="editing && node.kind === 'section' ? $event.preventDefault() : undefined"
    @drop="editing && node.kind === 'section' ? drop($event, node.id) : undefined"
  >
    <div
      v-if="editing && index !== undefined"
      class="drop-slot"
      :class="{ horizontal }"
      aria-label="在此插入组件"
      @dragover.prevent.stop
      @drop="drop($event, parentId ?? null, index)"
    ></div>
    <span
      v-if="editing && store.selectedId === node.id"
      class="node-selection-label"
      draggable="true"
      @dragstart.stop="start($event, { kind: 'move', value: node.id })"
      ><GripVertical :size="12" />{{ node.name }}</span
    >
    <template v-if="node.kind === 'section'">
      <NodeRenderer
        v-for="(child, childIndex) in node.children"
        :key="child.id"
        :node="child"
        :editing="editing"
        :device="device"
        :assets="assets"
        :parent-id="node.id"
        :index="childIndex"
        :horizontal="resolved.layout === 'row'"
      />
      <div
        v-if="editing"
        class="container-drop"
        :class="{ empty: !node.children.length }"
        @dragover.prevent.stop
        @drop="drop($event, node.id)"
      >
        {{ node.children.length ? '+ 拖入此容器' : '将组件拖到这里，开始布局' }}
      </div>
    </template>
    <h2 v-else-if="node.kind === 'heading'">{{ node.content }}</h2>
    <p v-else-if="node.kind === 'text'">{{ node.content }}</p>
    <img
      v-else-if="node.kind === 'image'"
      :src="imageSrc(node.src, assets)"
      :style="imageStyle(resolved)"
      :alt="node.content"
      draggable="false"
      @error="imageError"
    />
    <a
      v-else
      :href="safeUrl(node.href) || '#'"
      :tabindex="editing ? -1 : 0"
      :target="node.href.startsWith('http') ? '_blank' : undefined"
      rel="noopener noreferrer"
      @click="followLink"
      >{{ node.content }}</a
    >
  </div>
</template>
