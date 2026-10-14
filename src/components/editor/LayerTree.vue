<script setup lang="ts">
import { ChevronDown, Type, Image, MousePointer2, LayoutTemplate, GripVertical } from '@lucide/vue'
import type { PageNode } from '../../types/editor'
import { useEditorStore } from '../../stores/editor'
import { useDragDrop } from '../../composables/useDragDrop'
defineProps<{ nodes: PageNode[]; depth?: number }>()
const store = useEditorStore()
const { start, drop } = useDragDrop()
const icons = {
  section: LayoutTemplate,
  heading: Type,
  text: Type,
  image: Image,
  button: MousePointer2,
}
</script>
<template>
  <div v-for="node in nodes" :key="node.id">
    <button
      class="layer-row"
      :class="{ active: store.selectedId === node.id }"
      :style="{ paddingLeft: `${12 + (depth ?? 0) * 14}px` }"
      draggable="true"
      @dragstart.stop="start($event, { kind: 'move', value: node.id })"
      @dragover="node.kind === 'section' && $event.preventDefault()"
      @drop="node.kind === 'section' && drop($event, node.id)"
      @click="store.selectedId = node.id"
    >
      <ChevronDown v-if="node.kind === 'section'" :size="12" /><component
        :is="icons[node.kind]"
        :size="14"
      /><span>{{ node.name }}</span
      ><GripVertical class="layer-grip" :size="12" />
    </button>
    <LayerTree v-if="node.children.length" :nodes="node.children" :depth="(depth ?? 0) + 1" />
  </div>
</template>
