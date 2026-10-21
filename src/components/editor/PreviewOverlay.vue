<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Monitor, Tablet, Smartphone, X, RotateCcw, Play, Pause } from '@lucide/vue'
import { useEditorStore } from '../../stores/editor'
import { clone } from '../../core/document'
import { previewSrc } from '../../core/assets'
import { deviceWidths, type Device } from '../../types/editor'
import { compileSequence } from '../../core/motion'
import type { PlaybackState, PreviewMode } from '../../animation/runtime'
import { useModalDialog } from '../../composables/useModalDialog'
const dialog = ref<HTMLDialogElement>()
useModalDialog(dialog)
const props = defineProps<{ initialMode: PreviewMode }>()
const emit = defineEmits<{ close: [] }>()
const store = useEditorStore()
const frame = ref<HTMLIFrameElement>()
const device = ref<Device>('desktop')
const mode = ref<PreviewMode>(props.initialMode)
const closeButton = ref<HTMLButtonElement>()
const playbackReady = ref(false)
let requestId = 0
const playback = ref<PlaybackState>({
  time: 0,
  duration: compileSequence(store.document.nodes).duration,
  playing: false,
  reducedMotion: false,
})
function send() {
  requestId++
  playbackReady.value = false
  playback.value.playing = false
  frame.value?.contentWindow?.postMessage(
    { type: 'scroll-studio:preview', document: clone(store.document), mode: mode.value, requestId },
    location.origin,
  )
}
function transport(action: 'seek' | 'play' | 'pause', time?: number) {
  if (!playbackReady.value) return
  frame.value?.contentWindow?.postMessage(
    { type: 'scroll-studio:transport', action, time, requestId },
    location.origin,
  )
}
function receive(event: MessageEvent<unknown>) {
  if (
    event.origin !== location.origin ||
    event.source !== frame.value?.contentWindow ||
    typeof event.data !== 'object' ||
    event.data === null
  )
    return
  const data = event.data as Record<string, unknown>
  if (data.requestId === requestId) {
    if (data.type === 'scroll-studio:close-preview') emit('close')
    if (data.type === 'scroll-studio:focus-boundary' && typeof data.backward === 'boolean') {
      const controls = [
        ...(dialog.value?.querySelectorAll<HTMLElement>('button, input') ?? []),
      ].filter((element) => !element.matches(':disabled') && element.getClientRects().length > 0)
      ;(data.backward ? controls.at(-1) : controls[0])?.focus()
    }
  }
  if (data.type === 'scroll-studio:ready') send()
  if (
    data.type === 'scroll-studio:playback' &&
    data.requestId === requestId &&
    typeof data.time === 'number' &&
    Number.isFinite(data.time) &&
    typeof data.duration === 'number' &&
    Number.isFinite(data.duration) &&
    typeof data.playing === 'boolean' &&
    typeof data.reducedMotion === 'boolean'
  ) {
    playbackReady.value = true
    playback.value = {
      time: data.time,
      duration: data.duration,
      playing: data.playing,
      reducedMotion: data.reducedMotion,
    }
  }
}
function seek(event: Event) {
  transport('seek', Number((event.target as HTMLInputElement).value))
}
watch(() => store.document, send, { deep: true })
watch(mode, send)
onMounted(async () => {
  window.addEventListener('message', receive)
  await nextTick()
  closeButton.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('message', receive))
</script>
<template>
  <dialog
    ref="dialog"
    class="preview-overlay"
    aria-label="页面实时预览"
    @cancel.prevent="$emit('close')"
  >
    <header>
      <span
        ><span class="tiny-dot"></span>实时预览 <small>{{ store.document.name }}</small></span
      >
      <div class="device-switch">
        <button
          v-for="(icon, key) in { desktop: Monitor, tablet: Tablet, mobile: Smartphone }"
          :key="key"
          :class="{ active: device === key }"
          :aria-label="`预览${key}`"
          @click="device = key"
        >
          <component :is="icon" :size="17" />
        </button>
      </div>
      <div class="toolbar-group">
        <button class="btn small" @click="send"><RotateCcw :size="14" />重播动画</button
        ><button
          ref="closeButton"
          class="icon-button"
          aria-label="关闭预览"
          @click="$emit('close')"
        >
          <X :size="20" />
        </button>
      </div>
    </header>
    <div class="preview-transport">
      <div class="preview-mode-switch" aria-label="预览方式">
        <button
          :class="{ active: mode === 'scroll' }"
          :aria-pressed="mode === 'scroll'"
          @click="mode = 'scroll'"
        >
          滚动体验</button
        ><button
          :class="{ active: mode === 'timeline' }"
          :aria-pressed="mode === 'timeline'"
          @click="mode = 'timeline'"
        >
          时间轴试播
        </button>
      </div>
      <template v-if="mode === 'timeline' && playback.duration > 0">
        <button
          class="icon-button"
          :disabled="!playbackReady || playback.reducedMotion"
          :aria-label="playback.playing ? '暂停时间轴' : '播放时间轴'"
          @click="transport(playback.playing ? 'pause' : 'play')"
        >
          <component :is="playback.playing ? Pause : Play" :size="17" />
        </button>
        <input
          aria-label="时间轴播放进度"
          type="range"
          min="0"
          :max="playback.duration"
          step="0.01"
          :value="playback.time"
          :disabled="!playbackReady || playback.reducedMotion"
          @input="seek"
        />
        <output class="playback-time"
          >{{ playback.time.toFixed(2) }} / {{ playback.duration.toFixed(2) }} s</output
        >
      </template>
      <span v-else class="preview-mode-hint">{{
        mode === 'timeline'
          ? '先将组件加入共享时间轴，再开始试播。'
          : '在页面内滚动，体验真实触发效果。'
      }}</span>
      <span v-if="playback.reducedMotion" class="reduced-motion-note" role="status"
        >系统已减弱动态效果</span
      >
    </div>
    <div class="preview-stage">
      <iframe
        ref="frame"
        title="独立页面预览"
        :src="previewSrc"
        :style="{ width: `${deviceWidths[device]}px` }"
        @load="send"
      ></iframe>
    </div>
    <footer>
      {{ deviceWidths[device] }} px · 独立视口 ·
      {{ device === 'mobile' ? '手机' : device === 'tablet' ? '平板' : '桌面' }}预览
    </footer>
  </dialog>
</template>
