<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronUp, Diamond, Film, Play, Plus, Minus } from '@lucide/vue'
import { useEditorStore } from '../../stores/editor'
import { compileSequence, flattenNodes } from '../../core/motion'
import type { TimelineConfig } from '../../types/editor'
import TimelineTrack from './TimelineTrack.vue'
const emit = defineEmits<{ preview: []; inspect: [] }>()
const store = useEditorStore()
const expanded = ref(true)
const zoom = ref(1)
const snapping = ref(true)
const activeDragId = ref<string | null>(null)
const nodes = computed(() => flattenNodes(store.document.nodes))
const sequence = computed(() => compileSequence(store.document.nodes))
const tracks = computed(() =>
  nodes.value.filter((n) => n.animation.enabled && n.animation.mode === 'sequence'),
)
const span = computed(() => Math.min(40, Math.max(4, Math.ceil(sequence.value.duration + 1))))
const tickCount = computed(() => 4 * zoom.value + 1)
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
function join() {
  if (store.selected) {
    store.update(store.selected.id, {}, undefined, {
      enabled: true,
      mode: 'sequence',
      start: Math.min(30, sequence.value.duration),
    })
    store.inspectorTab = 'motion'
  }
}
function editing(id: string, active: boolean) {
  if (active) activeDragId.value = id
  else if (activeDragId.value === id) activeDragId.value = null
}
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
        <div class="timeline-tools">
          <button
            class="timeline-snap"
            :class="{ active: snapping }"
            :aria-pressed="snapping"
            @click="snapping = !snapping"
          >
            吸附 0.1s
          </button>
          <span class="timeline-tool-help">Alt 暂停吸附 · Esc 取消拖动</span>
          <div class="timeline-zoom" aria-label="时间轴缩放">
            <button
              class="icon-button"
              aria-label="缩小时间轴"
              :disabled="zoom <= 1 || !!activeDragId"
              @click="zoom /= 2"
            >
              <Minus :size="13" /></button
            ><output>{{ zoom }}×</output
            ><button
              class="icon-button"
              aria-label="放大时间轴"
              :disabled="zoom >= 8 || !!activeDragId"
              @click="zoom *= 2"
            >
              <Plus :size="13" />
            </button>
          </div>
        </div>
        <div class="timeline-scroll" tabindex="0" aria-label="时间轴轨道区域">
          <div
            class="timeline-grid"
            :style="{
              width: `${zoom * 100}%`,
              '--timeline-tick-size': `${100 / (tickCount - 1)}%`,
            }"
          >
            <div class="timeline-ruler">
              <span>图层 / {{ sequence.duration.toFixed(2) }} s</span>
              <div>
                <span v-for="n in tickCount" :key="n"
                  >{{ (((n - 1) * span) / (tickCount - 1)).toFixed(1) }}s</span
                >
              </div>
            </div>
            <div class="timeline-tracks">
              <TimelineTrack
                v-for="node in tracks"
                :key="node.id"
                :node="node"
                :span="span"
                :snapping="snapping"
                :disabled="!!activeDragId && activeDragId !== node.id"
                @inspect="emit('inspect')"
                @editing="editing(node.id, $event)"
              />
            </div>
          </div>
        </div>
        <p class="timeline-hint">
          拖动轨道移动 · 拖动两端拉伸 · 拖动菱形移动帧 · 方向键微调，Shift 精调
        </p>
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
