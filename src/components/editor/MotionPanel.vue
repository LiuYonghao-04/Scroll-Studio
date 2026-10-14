<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Trash2, Diamond } from '@lucide/vue'
import { useEditorStore } from '../../stores/editor'
import { createAnimation } from '../../core/motion'
import {
  animationEases,
  type AnimationConfig,
  type AnimationKeyframe,
  type AnimationPose,
} from '../../types/editor'
const store = useEditorStore()
const node = computed(() => store.selected)
const frames = computed(() => node.value?.animation.keyframes ?? [])
const selected = computed(
  () => frames.value.find((f) => f.id === store.selectedKeyframeId) ?? frames.value[0],
)
const frameIndex = computed(() => frames.value.findIndex((f) => f.id === selected.value?.id))
const endpoint = computed(
  () => frameIndex.value === 0 || frameIndex.value === frames.value.length - 1,
)
const easeLabels = {
  none: '线性',
  'power2.out': '缓出',
  'power2.inOut': '缓入缓出',
  'back.out(1.4)': '轻微回弹',
}
const fields: {
  key: keyof AnimationPose
  label: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'x', label: 'X 位移 · px', min: -500, max: 500, step: 1 },
  { key: 'y', label: 'Y 位移 · px', min: -500, max: 500, step: 1 },
  { key: 'scale', label: '缩放', min: 0.1, max: 3, step: 0.05 },
  { key: 'rotation', label: '旋转 · °', min: -180, max: 180, step: 1 },
  { key: 'opacity', label: '透明度', min: 0, max: 1, step: 0.05 },
]
const value = (event: Event) => (event.target as HTMLInputElement).value
function motion(patch: Partial<AnimationConfig>) {
  if (node.value) store.update(node.value.id, {}, undefined, patch)
}
function numeric(event: Event, key: 'start' | 'duration' | 'trigger', min: number, max: number) {
  const n = Number(value(event))
  if (Number.isFinite(n)) motion({ [key]: Math.min(max, Math.max(min, n)) })
}
function frame(patch: Partial<Omit<AnimationKeyframe, 'id'>>) {
  if (node.value && selected.value) store.updateKeyframe(node.value.id, selected.value.id, patch)
}
function frameNumber(event: Event, field: (typeof fields)[number]) {
  const n = Number(value(event))
  if (Number.isFinite(n)) frame({ [field.key]: Math.min(field.max, Math.max(field.min, n)) })
}
function offset(event: Event) {
  const n = Number(value(event)) / 100
  if (!endpoint.value && Number.isFinite(n))
    frame({
      offset: Math.max(
        frames.value[frameIndex.value - 1]!.offset + 0.001,
        Math.min(frames.value[frameIndex.value + 1]!.offset - 0.001, n),
      ),
    })
}
function preset(kind: 'rise' | 'fade' | 'turn') {
  const next = createAnimation()
  if (kind === 'fade') next.keyframes[0]!.y = 0
  if (kind === 'turn')
    Object.assign(next.keyframes[0]!, { y: 0, x: -80, rotation: -12, scale: 0.8 })
  motion({ enabled: true, keyframes: next.keyframes })
  store.selectedKeyframeId = next.keyframes[0]!.id
}
</script>
<template>
  <div v-if="node" class="property-fields motion-fields">
    <label class="toggle-field"
      >启用动画<input
        type="checkbox"
        :checked="node.animation.enabled"
        @change="motion({ enabled: ($event.target as HTMLInputElement).checked })"
    /></label>
    <p class="panel-help">关键帧与页面一起保存。设计画布保持静止，预览中查看真实效果。</p>
    <div class="motion-presets" aria-label="动画预设">
      <button @click="preset('rise')">向上浮现</button
      ><button @click="preset('fade')">柔和淡入</button
      ><button @click="preset('turn')">旋入</button>
    </div>
    <label
      >播放方式<select
        :value="node.animation.mode"
        @change="motion({ mode: value($event) as AnimationConfig['mode'] })"
      >
        <option value="individual">独立滚动触发</option>
        <option value="sequence">加入共享时间轴</option>
      </select></label
    >
    <div class="field-pair">
      <label v-if="node.animation.mode === 'sequence'"
        >开始时间 · s<input
          type="number"
          min="0"
          max="30"
          step="0.1"
          :value="node.animation.start"
          @change="numeric($event, 'start', 0, 30)"
      /></label>
      <label
        >动画时长 · s<input
          type="number"
          min="0.1"
          max="10"
          step="0.1"
          :value="node.animation.duration"
          @change="numeric($event, 'duration', 0.1, 10)"
      /></label>
      <label v-if="node.animation.mode === 'individual'"
        >触发位置 · %<input
          type="number"
          min="10"
          max="100"
          :value="node.animation.trigger"
          @change="numeric($event, 'trigger', 10, 100)"
      /></label>
    </div>
    <label v-if="node.animation.mode === 'individual'" class="toggle-field"
      >跟随滚动进度<input
        type="checkbox"
        :checked="node.animation.scrub"
        @change="motion({ scrub: ($event.target as HTMLInputElement).checked })"
    /></label>
    <p v-else class="panel-help">共享时间轴的触发位置与滚动距离在画布下方统一设置。</p>
    <div class="keyframe-heading">
      <span
        >关键帧 <small>{{ frames.length }} / 12</small></span
      ><button
        class="icon-button"
        aria-label="添加关键帧"
        :disabled="frames.length >= 12"
        @click="store.addKeyframe(node.id)"
      >
        <Plus :size="16" />
      </button>
    </div>
    <div class="keyframe-list" aria-label="关键帧列表">
      <button
        v-for="f in frames"
        :key="f.id"
        :class="{ active: selected?.id === f.id }"
        :aria-pressed="selected?.id === f.id"
        :aria-label="`关键帧 ${Math.round(f.offset * 100)}%`"
        @click="store.selectedKeyframeId = f.id"
      >
        <Diamond :size="12" />{{ Math.round(f.offset * 100) }}%
      </button>
    </div>
    <template v-if="selected">
      <div class="field-pair">
        <label
          >帧位置 · %<input
            type="number"
            min="0"
            max="100"
            step="1"
            :disabled="endpoint"
            :value="Math.round(selected.offset * 1000) / 10"
            @change="offset" /></label
        ><label
          >进入此帧的曲线<select
            :disabled="frameIndex === 0"
            :value="selected.ease"
            @change="frame({ ease: value($event) as AnimationKeyframe['ease'] })"
          >
            <option v-for="ease in animationEases" :key="ease" :value="ease">
              {{ easeLabels[ease] }}
            </option>
          </select></label
        >
      </div>
      <div class="field-pair">
        <label v-for="field in fields" :key="field.key"
          >{{ field.label
          }}<input
            type="number"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            :value="selected[field.key]"
            @change="frameNumber($event, field)"
        /></label>
      </div>
      <button
        class="text-button delete-keyframe"
        :disabled="endpoint"
        @click="store.removeKeyframe(node.id, selected.id)"
      >
        <Trash2 :size="13" />删除此帧
      </button>
      <p class="panel-help">
        首尾帧固定在 0% 和
        100%。新增帧插入最大间隔；每段使用目标帧的曲线。系统减弱动态效果时显示静态设计。
      </p>
    </template>
  </div>
</template>
