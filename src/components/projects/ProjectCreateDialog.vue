<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { X, ArrowUpRight } from '@lucide/vue'
import { templates } from '../../core/templates'
import type { TemplateId } from '../../types/project'
const props = defineProps<{ create: (template: TemplateId, name: string) => Promise<void> }>()
const emit = defineEmits<{ close: [] }>()
const selected = ref<TemplateId>('blank'),
  name = ref('未命名作品'),
  busy = ref(false),
  error = ref(''),
  input = ref<HTMLInputElement>()
function choose(id: TemplateId) {
  selected.value = id
  name.value = templates.find((t) => t.id === id)?.name ?? '未命名作品'
}
async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await props.create(selected.value, name.value)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '创建失败，请重试。'
  } finally {
    busy.value = false
  }
}
function close() {
  if (!busy.value) emit('close')
}
onMounted(async () => {
  await nextTick()
  input.value?.focus()
})
</script>
<template>
  <div class="modal-backdrop" @click.self="close" @keydown.esc.stop="close">
    <section
      class="project-dialog create-project-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
    >
      <button
        class="icon-button project-dialog-close"
        aria-label="关闭新建作品"
        :disabled="busy"
        @click="close"
      >
        <X :size="19" />
      </button>
      <span class="project-eyebrow">A NEW BEGINNING</span>
      <h2 id="create-project-title">给新的灵感，一张画布。</h2>
      <p>从空白开始，或选择一个可以自由修改的模板。</p>
      <form @submit.prevent="submit">
        <label class="project-name-label"
          >作品名称<input ref="input" v-model="name" maxlength="100" required :disabled="busy"
        /></label>
        <div class="template-options">
          <button
            v-for="template in templates"
            :key="template.id"
            type="button"
            :aria-pressed="selected === template.id"
            :disabled="busy"
            :class="{ selected: selected === template.id }"
            @click="choose(template.id)"
          >
            <span class="template-art" :style="{ background: template.color }"
              ><i></i><i></i><i v-if="template.id !== 'blank'"></i></span
            ><strong>{{ template.name }}</strong
            ><small>{{ template.subtitle }}</small>
          </button>
        </div>
        <p v-if="error" class="project-form-error" role="alert">{{ error }}</p>
        <footer>
          <span>每个作品独立保存到此浏览器。</span
          ><button class="btn dark" :disabled="busy || !name.trim()">
            {{ busy ? '正在创建…' : '创建并打开' }}<ArrowUpRight :size="16" />
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>
