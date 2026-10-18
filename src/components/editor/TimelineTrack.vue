<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useTimelineDrag } from '../../composables/useTimelineDrag'
import {
  editFrameOffset,
  editTrackTiming,
  frameOffsetBounds,
  type TimingEdit,
} from '../../core/timeline-edit'
import type { AnimationKeyframe, PageNode } from '../../types/editor'
const props = defineProps<{ node: PageNode; span: number; snapping: boolean; disabled: boolean }>()
const emit = defineEmits<{ inspect: []; editing: [active: boolean] }>()
const store = useEditorStore()
const lane = ref<HTMLElement>()
function select(frameId?: string) {
  store.selectedId = props.node.id
  store.inspectorTab = 'motion'
  if (frameId) store.selectedKeyframeId = frameId
}
function inspect() {
  select()
  emit('inspect')
}
const { drag, begin, move, finish, cancel } = useTimelineDrag(
  () => props.node,
  () => props.span,
  () => props.snapping,
  select,
  (value) => emit('editing', value),
)
const timing = computed(() => drag.value?.timing ?? props.node.animation)
const end = computed(() => timing.value.start + timing.value.duration)
function offset(frame: AnimationKeyframe) {
  return drag.value?.frameId === frame.id ? (drag.value.offset ?? frame.offset) : frame.offset
}
function position(frame: AnimationKeyframe) {
  return ((timing.value.start + offset(frame) * timing.value.duration) / props.span) * 100
}
function nudge(event: KeyboardEvent, kind: TimingEdit, direction: number) {
  if (drag.value || props.disabled) return
  select()
  const step = event.shiftKey ? 0.01 : 0.1
  store.update(
    props.node.id,
    {},
    undefined,
    editTrackTiming(props.node.animation, kind, direction * step, step),
  )
}
function nudgeFrame(event: KeyboardEvent, frame: AnimationKeyframe, direction: number) {
  if (drag.value || props.disabled) return
  select(frame.id)
  const next = editFrameOffset(
    props.node.animation.keyframes,
    frame.id,
    frame.offset + direction * (event.shiftKey ? 0.001 : 0.01),
    props.node.animation,
    0,
  )
  if (next !== undefined) store.updateKeyframe(props.node.id, frame.id, { offset: next })
}
function removeFrame(frame: AnimationKeyframe) {
  if (!drag.value && !props.disabled) store.removeKeyframe(props.node.id, frame.id)
}
</script>
<template>
  <div
    class="timeline-row"
    :class="{ selected: store.selectedId === node.id, 'is-dragging': !!drag }"
  >
    <button class="track-label" :title="node.name" @click="inspect">
      {{ node.name }}<small>{{ timing.start.toFixed(2) }} → {{ end.toFixed(2) }}s</small>
    </button>
    <div
      ref="lane"
      class="track-lane"
      @pointermove="move"
      @pointerup="finish"
      @pointercancel="cancel"
      @lostpointercapture="cancel"
    >
      <div
        class="track-clip"
        :style="{
          left: `${(timing.start / span) * 100}%`,
          width: `${(timing.duration / span) * 100}%`,
        }"
      >
        <button
          class="track-move"
          role="slider"
          :aria-label="`${node.name}开始时间`"
          aria-valuemin="0"
          aria-valuemax="30"
          :aria-valuenow="timing.start"
          :aria-valuetext="`${timing.start.toFixed(2)} 秒`"
          :disabled="disabled"
          title="拖动移动轨道；左右键微调，Shift 精调"
          @pointerdown.stop.prevent="begin($event, lane, 'move')"
          @keydown.left.prevent="nudge($event, 'move', -1)"
          @keydown.right.prevent="nudge($event, 'move', 1)"
        >
          <span>{{ timing.duration.toFixed(2) }}s</span>
        </button>
        <button
          class="track-resize start"
          role="slider"
          :aria-label="`${node.name}左边界`"
          aria-valuemin="0"
          aria-valuemax="30"
          :aria-valuenow="timing.start"
          :disabled="disabled"
          title="拖动左边界，保持结束时刻"
          @pointerdown.stop.prevent="begin($event, lane, 'resize-start')"
          @keydown.left.prevent="nudge($event, 'resize-start', -1)"
          @keydown.right.prevent="nudge($event, 'resize-start', 1)"
        ></button>
        <button
          class="track-resize end"
          role="slider"
          :aria-label="`${node.name}动画时长`"
          aria-valuemin="0.1"
          aria-valuemax="10"
          :aria-valuenow="timing.duration"
          :aria-valuetext="`${timing.duration.toFixed(2)} 秒`"
          :disabled="disabled"
          title="拖动右边界调整时长"
          @pointerdown.stop.prevent="begin($event, lane, 'resize-end')"
          @keydown.left.prevent="nudge($event, 'resize-end', -1)"
          @keydown.right.prevent="nudge($event, 'resize-end', 1)"
        ></button>
      </div>
      <button
        v-for="(frame, index) in node.animation.keyframes"
        :key="frame.id"
        class="track-keyframe"
        role="slider"
        :class="{
          active: store.selectedId === node.id && store.selectedKeyframeId === frame.id,
          fixed: index === 0 || index === node.animation.keyframes.length - 1,
        }"
        :aria-label="`${node.name}关键帧 ${index + 1}`"
        :aria-valuemin="
          (frameOffsetBounds(node.animation.keyframes, frame.id)?.[0] ?? frame.offset) * 100
        "
        :aria-valuemax="
          (frameOffsetBounds(node.animation.keyframes, frame.id)?.[1] ?? frame.offset) * 100
        "
        :aria-valuenow="offset(frame) * 100"
        :aria-valuetext="`${(offset(frame) * 100).toFixed(1)}%，${(timing.start + offset(frame) * timing.duration).toFixed(2)} 秒${frame.offset === 0 || frame.offset === 1 ? '，位置固定' : ''}`"
        :disabled="disabled"
        :style="{ left: `${position(frame)}%` }"
        :title="`关键帧 ${(offset(frame) * 100).toFixed(1)}% · 双击编辑属性`"
        @pointerdown.stop.prevent="begin($event, lane, 'frame', frame.id)"
        @click="select(frame.id)"
        @dblclick="$emit('inspect')"
        @keydown.left.prevent="nudgeFrame($event, frame, -1)"
        @keydown.right.prevent="nudgeFrame($event, frame, 1)"
        @keydown.delete.stop.prevent="removeFrame(frame)"
        @keydown.backspace.stop.prevent="removeFrame(frame)"
      >
        <span class="track-diamond"></span>
      </button>
      <div v-if="drag?.moved" class="timeline-drag-feedback" aria-hidden="true">
        {{
          drag.kind === 'frame'
            ? `${((drag.offset ?? 0) * 100).toFixed(1)}% · ${(timing.start + (drag.offset ?? 0) * timing.duration).toFixed(2)}s`
            : `${timing.start.toFixed(2)} → ${end.toFixed(2)}s · 时长 ${timing.duration.toFixed(2)}s`
        }}
      </div>
    </div>
  </div>
</template>
