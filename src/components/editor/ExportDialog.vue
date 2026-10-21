<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Download, X, Check, AlertTriangle } from '@lucide/vue'
import { useEditorStore } from '../../stores/editor'
import { preflight } from '../../export/preflight'
import { buildArchive } from '../../export/archive'
import { clone } from '../../core/document'

const emit = defineEmits<{ close: [] }>()
const store = useEditorStore()
const dialog = ref<HTMLDialogElement>()
const issues = computed(() => preflight(store.document))
const blocked = computed(() => issues.value.some((issue) => issue.level === 'error'))
const busy = ref(false),
  progress = ref(''),
  error = ref(''),
  generated = ref(false)
let controller: AbortController | undefined
function close() {
  controller?.abort()
  dialog.value?.close()
}
async function download() {
  if (busy.value || blocked.value) return
  busy.value = true
  error.value = ''
  generated.value = false
  controller = new AbortController()
  const signal = controller.signal
  try {
    const snapshot = clone(store.document)
    const bytes = await buildArchive(
      snapshot,
      undefined,
      (message) => {
        progress.value = message
      },
      signal,
    )
    if (signal.aborted) return
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }))
    const link = document.createElement('a')
    link.href = url
    const name = snapshot.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 60) || 'scroll-studio'
    link.download = `${name}.zip`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    generated.value = true
    progress.value = 'ZIP 已生成，请查看浏览器下载。'
  } catch (reason) {
    if (!signal.aborted)
      error.value = reason instanceof Error ? reason.message : '导出失败，请重试。'
  } finally {
    busy.value = false
  }
}
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => controller?.abort())
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="quick-start-dialog export-dialog"
      aria-labelledby="export-title"
      @close="emit('close')"
      @cancel="controller?.abort()"
    >
      <button class="icon-button guide-close" aria-label="关闭导出窗口" @click="close">
        <X :size="18" />
      </button>
      <span class="project-eyebrow">READY TO GO LIVE</span>
      <h2 id="export-title">把作品，带到更大的世界。</h2>
      <p class="export-description">
        {{ store.document.name }} ·
        导出当前画布快照，包含网页、样式、图片、动画和可重新编辑的工程备份。
      </p>
      <div class="export-summary">
        <Check v-if="!blocked" :size="17" /><AlertTriangle v-else :size="17" /><strong>{{
          blocked ? '请先处理以下问题' : '结构检查通过，可以导出'
        }}</strong>
      </div>
      <ul class="export-issues" aria-label="发布前检查">
        <li v-for="(issue, index) in issues" :key="index" :class="issue.level">
          <span>{{
            issue.level === 'error' ? '需处理' : issue.level === 'warning' ? '建议检查' : '说明'
          }}</span>
          <p>{{ issue.message }}</p>
        </li>
      </ul>
      <p class="guide-storage-note">
        解压后可直接打开 index.html，也可将整个文件夹上传到 GitHub
        Pages。外部图片需要允许跨域读取，失败时请改用本地素材。导出不会自动发布你的作品。
      </p>
      <p v-if="error" class="media-error" role="alert">{{ error }}</p>
      <p v-if="busy || generated" class="export-progress" role="status">{{ progress }}</p>
      <footer>
        <button class="btn small" @click="close">{{ busy ? '取消导出' : '返回编辑' }}</button
        ><button class="btn dark" :disabled="busy || blocked" @click="download">
          <Download :size="16" />{{ busy ? '正在打包…' : '下载网站 ZIP' }}
        </button>
      </footer>
    </dialog>
  </Teleport>
</template>
