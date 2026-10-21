<script setup lang="ts">
import { toRef } from 'vue'
import { Type, AlignLeft, Image, MousePointer2, LayoutTemplate, Plus, Layers } from '@lucide/vue'
import { useEditorStore } from '../../stores/editor'
import { useDragDrop } from '../../composables/useDragDrop'
import type { NodeKind } from '../../types/editor'
import LayerTree from './LayerTree.vue'
import MediaLibrary from './MediaLibrary.vue'
import { blockPresets, createBlock } from '../../core/presets'
const store = useEditorStore()
const { start } = useDragDrop()
const tab = toRef(store, 'libraryTab')
const items = [
  { kind: 'section', label: '容器', icon: LayoutTemplate },
  { kind: 'heading', label: '标题', icon: Type },
  { kind: 'text', label: '段落', icon: AlignLeft },
  { kind: 'image', label: '图片', icon: Image },
  { kind: 'button', label: '按钮', icon: MousePointer2 },
] as const
function add(kind: NodeKind) {
  store.add(kind, store.selected?.kind === 'section' ? store.selected.id : null)
}
</script>
<template>
  <aside class="library panel">
    <div class="panel-tabs">
      <button :class="{ active: tab === 'components' }" @click="tab = 'components'">
        <Plus :size="15" />组件</button
      ><button :class="{ active: tab === 'layers' }" @click="tab = 'layers'">
        <Layers :size="15" />图层</button
      ><button :class="{ active: tab === 'media' }" @click="tab = 'media'">
        <Image :size="15" />素材
      </button>
    </div>
    <template v-if="tab === 'components'">
      <div class="panel-heading">基础组件 <span>05</span></div>
      <p class="panel-help">拖入画布，或点击添加</p>
      <div class="component-grid">
        <button
          v-for="item in items"
          :key="item.kind"
          class="component-item"
          draggable="true"
          :aria-label="`添加${item.label}`"
          @dragstart="start($event, { kind: 'new', value: item.kind })"
          @click="add(item.kind)"
        >
          <component :is="item.icon" :size="24" :stroke-width="1.4" /><span>{{ item.label }}</span
          ><Plus class="component-plus" :size="12" />
        </button>
      </div>
      <div class="panel-heading">常用区块 <span>04</span></div>
      <div class="block-presets">
        <button
          v-for="preset in blockPresets"
          :key="preset.id"
          draggable="true"
          :aria-label="`插入区块 ${preset.name}`"
          @dragstart="start($event, { kind: 'block', value: preset.id })"
          @click="store.insertBlock(createBlock(preset.id))"
        >
          <strong>{{ preset.name }}<Plus :size="13" /></strong><small>{{ preset.detail }}</small>
        </button>
      </div>
      <div class="library-note">
        <span class="tiny-dot"></span>
        <div>
          从一个容器开始
          <p>将组件放入容器，自由组合横向或纵向布局。</p>
        </div>
      </div>
    </template>
    <MediaLibrary v-if="tab === 'media'" />
    <template v-if="tab !== 'media'">
      <div class="panel-heading layer-heading">
        页面结构 <span>{{ store.document.nodes.length }} 个区块</span>
      </div>
      <LayerTree :nodes="store.document.nodes" />
      <p v-if="!store.document.nodes.length" class="panel-help">画布还是空的。添加第一个组件吧。</p>
    </template>
    <div class="library-footer"><kbd>⌘ / Ctrl</kbd> + <kbd>Z</kbd><span>撤销上一步</span></div>
  </aside>
</template>
