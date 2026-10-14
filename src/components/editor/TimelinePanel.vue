<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronUp, Diamond, Film, Play, Plus } from '@lucide/vue'
import { useEditorStore } from '../../stores/editor'
import { compileSequence, flattenNodes } from '../../core/motion'
import type { PageNode, TimelineConfig } from '../../types/editor'
const emit = defineEmits<{ preview: []; inspect: [] }>()
const store = useEditorStore()
const expanded = ref(true)
const nodes = computed(() => flattenNodes(store.document.nodes))
const sequence = computed(() => compileSequence(store.document.nodes))
const tracks = computed(() =>
  nodes.value.filter((n) => n.animation.enabled && n.animation.mode === 'sequence'),
)
const drag = ref<{
  id: string
  pointer: number
  x: number
  start: number
  current: number
  width: number
  span: number
}>()
const span = computed(() => drag.value?.span ?? Math.max(4, Math.ceil(sequence.value.duration)))
const canJoin = computed(
  () =>
    store.selected &&
    (!store.selected.animation.enabled || store.selected.animation.mode !== 'sequence'),
)
const value = (event: Event) => (event.target as HTMLInputElement).value
function config(patch: Partial<TimelineConfig>) {
  store.commit((doc) => {
    Object.assign(doc.timeline, patch)
  })
}
function number(event: Event, key: 'trigger' | 'scrollDistance', min: number, max: number) {
  const n = Number(value(event))
  if (Number.isFinite(n)) config({ [key]: Math.max(min, Math.min(max, n)) })
}
function select(node: PageNode, frameId?: string) {
  store.selectedId = node.id
  store.inspectorTab = 'motion'
  if (frameId) store.selectedKeyframeId = frameId
}
function inspect(node: PageNode) {
  select(node)
  emit('inspect')
}
function join() {
  if (store.selected)
    store.update(store.selected.id, {}, undefined, {
      enabled: true,
      mode: 'sequence',
      start: Math.min(30, sequence.value.duration),
    })
}
function begin(event: PointerEvent, node: PageNode) {
  if (event.button !== 0) return
  select(node)
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  drag.value = {
    id: node.id,
    pointer: event.pointerId,
    x: event.clientX,
    start: node.animation.start,
    current: node.animation.start,
    width: target.parentElement!.clientWidth,
    span: span.value,
  }
}
function move(event: PointerEvent) {
  const d = drag.value
  if (!d || d.pointer !== event.pointerId) return
  const node = tracks.value.find((n) => n.id === d.id)
  if (!node) return
  d.current = Math.max(
    0,
    Math.min(
      30,
      d.span - node.animation.duration,
      Math.round((d.start + ((event.clientX - d.x) / d.width) * d.span) * 10) / 10,
    ),
  )
}
function finish(event: PointerEvent, cancel = false) {
  const d = drag.value
  if (!d || d.pointer !== event.pointerId) return
  if (!cancel) store.update(d.id, {}, undefined, { start: d.current })
  drag.value = undefined
}
function nudge(node: PageNode, delta: number) {
  store.update(node.id, {}, undefined, {
    start: Math.max(0, Math.min(30, Math.round((node.animation.start + delta) * 10) / 10)),
  })
}
const start = (node: PageNode) =>
  drag.value?.id === node.id ? drag.value.current : node.animation.start
</script>
<template>
  <section class="timeline-panel" aria-label="动画时间轴">
    <header class="timeline-header">
      <button class="timeline-title" :aria-expanded="expanded" @click="expanded = !expanded">
        <Film :size="16" /><strong>动画时间轴</strong
        ><span class="timeline-count">{{ tracks.length }} 轨道</span
        ><component :is="expanded ? ChevronDown : ChevronUp" :size="14" />
      </button>
      <div class="toolbar-group">
        <button v-if="canJoin" class="btn small" @click="join">
          <Plus :size="13" />加入选中组件</button
        ><button class="btn small" :disabled="!tracks.length" @click="$emit('preview')">
          <Play :size="13" />试播
        </button>
      </div>
    </header>
    <div v-if="expanded" class="timeline-body">
      <div v-if="!tracks.length" class="timeline-empty">
        <Diamond :size="23" :stroke-width="1.2" />
        <div>
          <strong>让每个元素，在对的时刻出现。</strong>
          <p>选择画布组件，再点击「加入选中组件」开始编排。</p>
        </div>
      </div>
      <template v-else>
        <div class="timeline-ruler">
          <span>图层 / {{ sequence.duration.toFixed(1) }} s</span>
          <div>
            <span v-for="n in 5" :key="n">{{ (((n - 1) * span) / 4).toFixed(1) }}s</span>
          </div>
        </div>
        <div class="timeline-tracks">
          <div
            v-for="node in tracks"
            :key="node.id"
            class="timeline-row"
            :class="{ selected: store.selectedId === node.id }"
          >
            <button class="track-label" @click="inspect(node)" :title="node.name">
              {{ node.name }}<small>{{ start(node).toFixed(1) }}s</small>
            </button>
            <div class="track-lane">
              <button
                class="track-clip"
                role="slider"
                :aria-label="`${node.name}开始时间`"
                aria-valuemin="0"
                aria-valuemax="30"
                :aria-valuenow="start(node)"
                :style="{
                  left: `${(start(node) / span) * 100}%`,
                  width: `${(node.animation.duration / span) * 100}%`,
                }"
                @pointerdown="begin($event, node)"
                @pointermove="move"
                @pointerup="finish($event)"
                @pointercancel="finish($event, true)"
                @keydown.left.prevent="nudge(node, -0.1)"
                @keydown.right.prevent="nudge(node, 0.1)"
              >
                <span
                  v-for="frame in node.animation.keyframes"
                  :key="frame.id"
                  class="track-diamond"
                  :style="{ left: `${frame.offset * 100}%` }"
                ></span>
              </button>
            </div>
          </div>
        </div>
        <p class="timeline-hint">拖动轨道调整开始时间 · 方向键微调 0.1s · 在右侧编辑关键帧</p>
        <details class="timeline-settings">
          <summary>共享滚动触发设置</summary>
          <div class="timeline-setting-fields">
            <label
              >触发元素<select
                :value="store.document.timeline.triggerNodeId ?? ''"
                @change="config({ triggerNodeId: value($event) || null })"
              >
                <option value="">整个页面</option>
                <option v-for="node in nodes" :key="node.id" :value="node.id">
                  {{ node.name }}
                </option>
              </select></label
            >
            <label
              >触发线 · %<input
                type="number"
                min="10"
                max="100"
                :value="store.document.timeline.trigger"
                @change="number($event, 'trigger', 10, 100)"
            /></label>
            <label
              >滚动距离 · px<input
                type="number"
                min="100"
                max="5000"
                step="100"
                :value="store.document.timeline.scrollDistance"
                @change="number($event, 'scrollDistance', 100, 5000)"
            /></label>
            <label class="timeline-checkbox"
              ><input
                type="checkbox"
                :checked="store.document.timeline.scrub"
                @change="config({ scrub: ($event.target as HTMLInputElement).checked })"
              />跟随滚动</label
            >
          </div>
          <p class="timeline-hint">
            跟随滚动时，秒数表示各轨道的相对节奏；短页面会使用可用滚动距离。关闭后按秒播放。
          </p>
        </details>
      </template>
    </div>
  </section>
</template>
