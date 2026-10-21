<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CircleHelp, X } from '@lucide/vue'

const dialog = ref<HTMLDialogElement>()
const seenKey = 'scroll-studio:guide:v1'
function close() {
  dialog.value?.close()
}
function remember() {
  try {
    localStorage.setItem(seenKey, 'seen')
  } catch {
    // Help stays available even when browser storage is disabled.
  }
}
onMounted(() => {
  try {
    if (!localStorage.getItem(seenKey)) dialog.value?.showModal()
  } catch {
    dialog.value?.showModal()
  }
})
</script>
<template>
  <button class="icon-button" aria-label="使用指南" title="使用指南" @click="dialog?.showModal()">
    <CircleHelp :size="18" />
  </button>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="quick-start-dialog"
      aria-labelledby="quick-start-title"
      @close="remember"
    >
      <button class="icon-button guide-close" aria-label="关闭使用指南" @click="close">
        <X :size="18" />
      </button>
      <span class="project-eyebrow">YOUR FIRST SCROLL</span>
      <h2 id="quick-start-title">从一个模板，开始你的创作。</h2>
      <ol>
        <li>
          <strong>创建作品</strong>
          <p>在作品库选择「新建作品」，推荐先试试「滚动叙事」模板。</p>
        </li>
        <li>
          <strong>搭建与修改</strong>
          <p>
            点击或拖入左侧组件和区块；选中元素，在右侧调整属性，并切换桌面、平板、手机独立样式。左侧「素材」可上传图片。手机端可点击添加和排序。
          </p>
        </li>
        <li>
          <strong>让页面动起来</strong>
          <p>选中元素后切换右侧「动画」，配置关键帧和时间轴；点击「预览」，滚动体验或试播动画。</p>
        </li>
        <li>
          <strong>保存与备份</strong>
          <p>
            修改后会自动保存到当前浏览器，也可按 Ctrl / ⌘ + S。通过作品菜单导出
            JSON，换设备时导入恢复。准备展示时，从页面菜单选择「导出网站 ZIP」，检查后下载完整网页。
          </p>
        </li>
      </ol>
      <p class="guide-storage-note">
        公开体验版无需账号，作品不会上传云端。清理浏览器数据会删除本地作品，请定期导出备份。
      </p>
      <footer>
        <span>随时点击问号，再次查看。</span
        ><button class="btn dark" autofocus @click="close">开始创作</button>
      </footer>
    </dialog>
  </Teleport>
</template>
