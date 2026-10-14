<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Monitor, Tablet, Smartphone, X, RotateCcw } from '@lucide/vue'
import { useEditorStore } from '../../stores/editor'
import { clone } from '../../core/document'
import { deviceWidths, type Device } from '../../types/editor'
defineEmits<{ close: [] }>()
const store = useEditorStore()
const frame = ref<HTMLIFrameElement>()
const device = ref<Device>('desktop')
function send() {
  frame.value?.contentWindow?.postMessage(
    { type: 'scroll-studio:preview', document: clone(store.document) },
    location.origin,
  )
}
function receive(event: MessageEvent) {
  if (
    event.origin === location.origin &&
    event.source === frame.value?.contentWindow &&
    event.data?.type === 'scroll-studio:ready'
  )
    send()
}
watch(() => store.document, send, { deep: true })
onMounted(() => window.addEventListener('message', receive))
onBeforeUnmount(() => window.removeEventListener('message', receive))
</script>
<template>
  <div
    class="preview-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="页面实时预览"
    @keydown.esc="$emit('close')"
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
        ><button class="icon-button" aria-label="关闭预览" autofocus @click="$emit('close')">
          <X :size="20" />
        </button>
      </div>
    </header>
    <div class="preview-stage">
      <iframe
        ref="frame"
        title="独立页面预览"
        src="/#/render"
        :style="{ width: `${deviceWidths[device]}px` }"
        @load="send"
      ></iframe>
    </div>
    <footer>
      {{ deviceWidths[device] }} px · 独立视口 ·
      {{ device === 'mobile' ? '手机' : device === 'tablet' ? '平板' : '桌面' }}预览
    </footer>
  </div>
</template>
