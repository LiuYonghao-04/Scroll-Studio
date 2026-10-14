<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import { GripVertical } from '@lucide/vue'
import type { PageNode } from '../../types/editor'
import { safeUrl } from '../../core/document'
import { useEditorStore } from '../../stores/editor'
import { useDragDrop } from '../../composables/useDragDrop'
const props = defineProps<{
  node: PageNode
  editing?: boolean
  parentId?: string
  index?: number
  horizontal?: boolean
}>()
const store = useEditorStore()
const { start, drop } = useDragDrop()
const fonts = {
  sans: '"DM Sans", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  serif: 'Georgia, "Songti SC", serif',
  mono: '"Courier New", monospace',
}
const style = computed<CSSProperties>(() => ({
  color: props.node.style.color,
  background: props.node.style.background,
  '--node-font-size': `${props.node.style.fontSize}px`,
  fontSize: `${props.node.style.fontSize}px`,
  fontFamily: fonts[props.node.style.fontFamily],
  '--node-padding': `${props.node.style.padding}px`,
  '--node-gap': `${props.node.style.gap}px`,
  padding: `${props.node.style.padding}px`,
  margin: `${props.node.style.margin}px`,
  borderRadius: `${props.node.style.radius}px`,
  textAlign: props.node.style.align,
  ...(props.node.kind === 'section'
    ? {
        display: 'flex',
        flexDirection: props.node.style.layout,
        gap: `${props.node.style.gap}px`,
        alignItems:
          props.node.style.layout === 'row'
            ? 'stretch'
            : props.node.style.align === 'center'
              ? 'center'
              : props.node.style.align === 'right'
                ? 'flex-end'
                : 'stretch',
      }
    : {}),
}))
function select(event: MouseEvent) {
  if (!props.editing) return
  event.stopPropagation()
  event.preventDefault()
  store.selectedId = props.node.id
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
        :parent-id="node.id"
        :index="childIndex"
        :horizontal="node.style.layout === 'row'"
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
      :src="safeUrl(node.src, true) || '/images/landscape.svg'"
      :alt="node.content"
      draggable="false"
      @error="($event.target as HTMLImageElement).src = '/images/landscape.svg'"
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
