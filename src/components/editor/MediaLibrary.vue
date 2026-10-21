<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Upload, Trash2, ImagePlus } from '@lucide/vue'
import { useEditorStore } from '../../stores/editor'
import { readImage } from '../../services/media'
import { MAX_MEDIA_BYTES, assetReferences } from '../../core/media'
import { createNode, findNode } from '../../core/document'
import type { MediaAsset } from '../../types/editor'

const store = useEditorStore()
const input = ref<HTMLInputElement>()
const busy = ref(false)
const error = ref('')
let active = true
onBeforeUnmount(() => {
  active = false
})
const total = computed(() => store.document.assets.reduce((size, asset) => size + asset.bytes, 0))
const references = (asset: MediaAsset) => assetReferences(store.document, asset.id)
async function upload(event: Event) {
  const picker = event.target as HTMLInputElement
  const file = picker.files?.[0]
  picker.value = ''
  if (!file || busy.value) return
  busy.value = true
  error.value = ''
  const id = store.document.id
  try {
    const asset = await readImage(file)
    if (!active || store.document.id !== id) return
    if (store.document.assets.length >= 20 || total.value + asset.bytes > MAX_MEDIA_BYTES)
      throw new Error('每件作品最多 20 张图片、总量 8 MB。请先移除未使用的素材。')
    if (
      !store.commit((doc) => {
        doc.assets.push(asset)
      })
    )
      throw new Error('素材没有添加，请检查页面提示。')
  } catch (reason) {
    if (active && store.document.id === id)
      error.value = reason instanceof Error ? reason.message : '图片上传失败。'
  } finally {
    busy.value = false
  }
}
function use(asset: MediaAsset) {
  let selected = store.selected?.kind === 'image' ? store.selected.id : undefined
  const applied = store.commit((doc) => {
    const image = selected ? findNode(doc.nodes, selected) : createNode('image')
    if (!image) return
    image.src = `asset:${asset.id}`
    image.content = asset.name
    if (!selected) {
      doc.nodes.push(image)
      selected = image.id
    }
  })
  if (applied && selected) store.selectedId = selected
}
function remove(asset: MediaAsset) {
  if (references(asset)) {
    error.value = '这张图片仍被组件使用，请先替换或删除对应图片组件。'
    return
  }
  store.commit((doc) => {
    doc.assets = doc.assets.filter((item) => item.id !== asset.id)
  })
}
function rename(asset: MediaAsset, event: Event) {
  const name = (event.target as HTMLInputElement).value.trim().slice(0, 150) || asset.name
  store.commit((doc) => {
    const item = doc.assets.find((item) => item.id === asset.id)
    if (item) item.name = name
  })
}
</script>
<template>
  <section class="media-library" aria-label="本地图片素材">
    <div class="panel-heading">
      本地素材 <span>{{ store.document.assets.length }} / 20</span>
    </div>
    <p class="panel-help">
      图片仅存在此作品中，JSON 备份会包含图片。原图最大 8 MB，最长边自动缩至 1920 px。
    </p>
    <button class="btn small media-upload" :disabled="busy" @click="input?.click()">
      <Upload :size="14" />{{ busy ? '正在处理图片…' : '上传图片' }}
    </button>
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      aria-label="上传本地图片"
      hidden
      @change="upload"
    />
    <p class="media-capacity">{{ (total / 1_000_000).toFixed(2) }} / 8 MB · PNG / JPEG / WebP</p>
    <p v-if="error" class="media-error" role="alert">{{ error }}</p>
    <p v-if="!store.document.assets.length" class="panel-help">
      还没有本地图片。上传后，点击「使用」替换选中的图片，或添加一个新图片组件。
    </p>
    <article v-for="asset in store.document.assets" :key="asset.id" class="media-card">
      <img :src="asset.dataUrl" :alt="asset.name" />
      <input
        :value="asset.name"
        :aria-label="`素材名称 ${asset.name}`"
        maxlength="150"
        @change="rename(asset, $event)"
      />
      <small
        >{{ asset.width }} × {{ asset.height }} · {{ Math.ceil(asset.bytes / 1000) }} KB ·
        {{ references(asset) }} 处引用</small
      >
      <div>
        <button class="btn small" :aria-label="`使用素材 ${asset.name}`" @click="use(asset)">
          <ImagePlus :size="13" />使用</button
        ><button
          class="icon-button"
          :aria-label="`删除素材 ${asset.name}`"
          :disabled="references(asset) > 0"
          :title="references(asset) ? '先替换使用此素材的图片组件' : '删除未使用素材（可撤销）'"
          @click="remove(asset)"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </article>
  </section>
</template>
