<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowUpRight,
  Plus,
  Copy,
  Pencil,
  Trash2,
  Upload,
  Download,
  Search,
  RefreshCw,
  X,
  FolderOpen,
} from '@lucide/vue'
import BrandMark from '../components/ui/BrandMark.vue'
import ProjectCreateDialog from '../components/projects/ProjectCreateDialog.vue'
import QuickStartGuide from '../components/editor/QuickStartGuide.vue'
import { useProjectsStore } from '../stores/projects'
import type { ProjectSummary, TemplateId } from '../types/project'
import { getProject } from '../services/projects'
import { MAX_DOCUMENT_BYTES } from '../core/media'
const store = useProjectsStore(),
  router = useRouter()
const creating = ref(false),
  search = ref(''),
  busy = ref(false),
  error = ref(''),
  file = ref<HTMLInputElement>()
const operation = ref<{ kind: 'rename' | 'delete'; project: ProjectSummary }>(),
  name = ref(''),
  nameInput = ref<HTMLInputElement>()
const visible = computed(() =>
  store.projects.filter((p) =>
    p.document.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()),
  ),
)
async function refresh() {
  try {
    await store.refresh()
  } catch {
    /* Store exposes the recoverable error. */
  }
}
async function create(template: TemplateId, title: string) {
  const project = await store.create(template, title)
  await router.push(`/editor/${project.id}`)
}
async function act(action: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await action()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '操作失败，请重试。'
  } finally {
    busy.value = false
  }
}
async function openOperation(project: ProjectSummary, kind: 'rename' | 'delete') {
  operation.value = { project, kind }
  name.value = project.document.name
  await nextTick()
  nameInput.value?.focus()
}
async function confirmOperation() {
  const current = operation.value
  if (!current) return
  await act(async () => {
    if (current.kind === 'rename') await store.rename(current.project, name.value)
    else await store.remove(current.project)
    operation.value = undefined
  })
}
async function exportProject(project: ProjectSummary) {
  const current = await getProject(project.id)
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(current.document, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'scroll-studio-project.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
async function importProject(event: Event) {
  const input = event.target as HTMLInputElement,
    selected = input.files?.[0]
  if (!selected) return
  await act(async () => {
    if (selected.size > MAX_DOCUMENT_BYTES) throw new Error('JSON 文件不能超过 16 MB。')
    await store.importDocument(await selected.text())
  })
  input.value = ''
}
function date(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '时间未知'
    : new Intl.DateTimeFormat('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
}
onMounted(refresh)
</script>
<template>
  <div class="projects-page">
    <div :inert="creating || !!operation">
      <header class="projects-nav">
        <BrandMark /><QuickStartGuide /><RouterLink to="/"
          >返回首页<ArrowUpRight :size="14"
        /></RouterLink>
      </header>
      <main class="projects-main">
        <div class="projects-heading">
          <div>
            <span class="project-eyebrow">YOUR CREATIVE SPACE / 0.7</span>
            <h1>每个想法，都有自己的位置。</h1>
            <p>继续打磨正在生长的作品，或开始一次新的探索。</p>
          </div>
          <button
            class="btn dark"
            :disabled="busy || store.loading || !!store.error"
            @click="creating = true"
          >
            <Plus :size="17" />新建作品
          </button>
        </div>
        <div class="projects-toolbar">
          <div class="projects-count">
            我的作品 <span>{{ store.count.toString().padStart(2, '0') }}</span>
          </div>
          <label class="project-search"
            ><Search :size="15" /><input
              v-model="search"
              type="search"
              placeholder="搜索作品"
              aria-label="搜索作品" /></label
          ><button
            class="btn small"
            :disabled="busy || store.loading || !!store.error"
            @click="file?.click()"
          >
            <Upload :size="14" />导入作品</button
          ><button
            class="icon-button"
            aria-label="刷新作品库"
            :disabled="store.loading || busy"
            @click="refresh"
          >
            <RefreshCw :size="16" />
          </button>
        </div>
        <p class="project-notice">
          作品仅保存在当前设备的浏览器中，不会上传云端。清理浏览器数据前请导出 JSON
          备份；换设备可通过「导入作品」恢复。
        </p>
        <p v-if="store.warning" class="project-notice" role="status">{{ store.warning }}</p>
        <div v-if="store.error || error" class="project-form-error" role="alert">
          {{ store.error || error
          }}<button v-if="error" aria-label="关闭操作错误" @click="error = ''">
            <X :size="14" />
          </button>
        </div>
        <div v-if="store.loading" class="project-loading" role="status">
          正在读取作品…
          <div class="project-skeletons">
            <div></div>
            <div></div>
          </div>
        </div>
        <div v-else-if="!visible.length && !store.error" class="projects-empty">
          <FolderOpen :size="36" :stroke-width="1.1" />
          <h2>{{ search ? '暂时没有找到这个作品。' : '空白，也是创作的开始。' }}</h2>
          <p>
            {{ search ? '换个关键词，继续寻找。' : '创建第一件作品，或者导入以前保存的 JSON。' }}
          </p>
          <button v-if="!search" class="btn" @click="creating = true">
            <Plus :size="15" />创建第一件作品
          </button>
        </div>
        <div v-else class="project-grid">
          <article
            v-for="project in visible"
            :key="project.id"
            class="project-card"
            :aria-label="`作品 ${project.document.name}`"
          >
            <RouterLink
              :to="`/editor/${project.id}`"
              class="project-cover"
              :aria-label="`打开 ${project.document.name}`"
              ><img
                :src="`data:image/svg+xml;charset=utf-8,${encodeURIComponent(project.thumbnail)}`"
                :alt="`${project.document.name}的布局缩略图`" /><span
                >继续编辑<ArrowUpRight :size="16" /></span
            ></RouterLink>
            <div class="project-card-info">
              <RouterLink :to="`/editor/${project.id}`"
                ><h2>{{ project.document.name }}</h2>
                <p>最近修改 {{ date(project.updatedAt) }}</p></RouterLink
              >
              <div class="project-card-actions">
                <button
                  class="icon-button"
                  :aria-label="`重命名 ${project.document.name}`"
                  :disabled="busy"
                  @click="openOperation(project, 'rename')"
                >
                  <Pencil :size="15" /></button
                ><button
                  class="icon-button"
                  :aria-label="`复制 ${project.document.name}`"
                  :disabled="busy"
                  @click="act(() => store.duplicate(project.id))"
                >
                  <Copy :size="15" /></button
                ><button
                  class="icon-button"
                  :aria-label="`导出 ${project.document.name}`"
                  :disabled="busy"
                  @click="act(() => exportProject(project))"
                >
                  <Download :size="15" /></button
                ><button
                  class="icon-button"
                  :aria-label="`删除 ${project.document.name}`"
                  :disabled="busy"
                  @click="openOperation(project, 'delete')"
                >
                  <Trash2 :size="15" />
                </button>
              </div>
            </div>
          </article>
        </div>
        <footer class="projects-footer">
          <span>仅保存在此浏览器 · 建议定期导出 JSON 备份</span
          ><span>Built for the way you create.</span>
        </footer>
      </main>
      <input
        ref="file"
        hidden
        type="file"
        accept="application/json,.json"
        @change="importProject"
      />
    </div>
    <ProjectCreateDialog v-if="creating" :create="create" @close="creating = false" />
    <div
      v-if="operation"
      class="modal-backdrop"
      @click.self="!busy && (operation = undefined)"
      @keydown.esc="!busy && (operation = undefined)"
    >
      <section
        class="project-dialog compact-project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-action-title"
      >
        <h2 id="project-action-title">
          {{ operation.kind === 'rename' ? '为作品换个名字' : '删除这件作品？' }}
        </h2>
        <form @submit.prevent="confirmOperation">
          <label v-if="operation.kind === 'rename'" class="project-name-label"
            >新的作品名称<input
              ref="nameInput"
              v-model="name"
              maxlength="100"
              required
              :disabled="busy"
          /></label>
          <p v-else>
            「{{
              operation.project.document.name
            }}」将从本机作品库删除，无法撤销。需要保留时，请先导出 JSON。
          </p>
          <p v-if="error" class="project-form-error" role="alert">{{ error }}</p>
          <footer>
            <button type="button" class="btn" :disabled="busy" @click="operation = undefined">
              取消</button
            ><button
              class="btn dark"
              :disabled="busy || (operation.kind === 'rename' && !name.trim())"
            >
              {{ busy ? '正在处理…' : operation.kind === 'rename' ? '保存名称' : '确认删除' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </div>
</template>
