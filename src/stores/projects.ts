import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createTemplate, duplicateDocument } from '../core/templates'
import { parseDocument } from '../core/document'
import {
  createProject,
  deleteProject,
  getProject,
  initializeProjects,
  listProjectSummaries,
  updateProject,
} from '../services/projects'
import type { ProjectSummary, TemplateId } from '../types/project'
export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<ProjectSummary[]>([]),
    loading = ref(false),
    error = ref(''),
    warning = ref('')
  const count = computed(() => projects.value.length)
  let refreshing: Promise<void> | undefined
  async function refresh() {
    if (refreshing) return refreshing
    refreshing = (async () => {
      loading.value = true
      error.value = ''
      try {
        warning.value = await initializeProjects()
        projects.value = await listProjectSummaries()
      } catch (reason) {
        error.value = reason instanceof Error ? reason.message : '作品库无法读取。'
        throw reason
      } finally {
        loading.value = false
        refreshing = undefined
      }
    })()
    return refreshing
  }
  async function create(template: TemplateId, name: string) {
    const doc = createTemplate(template)
    doc.name = name.trim().slice(0, 100) || doc.name
    const created = await createProject(doc)
    await refresh()
    return created
  }
  async function rename(project: ProjectSummary, name: string) {
    const doc = parseDocument((await getProject(project.id)).document)
    doc.name = name.trim().slice(0, 100) || doc.name
    doc.updatedAt = new Date().toISOString()
    await updateProject(project.id, doc, project.revision)
    await refresh()
  }
  async function duplicate(id: string) {
    const current = await getProject(id)
    const copy = await createProject(duplicateDocument(current.document))
    await refresh()
    return copy
  }
  async function remove(project: ProjectSummary) {
    await deleteProject(project.id, project.revision)
    await refresh()
  }
  async function importDocument(input: unknown) {
    const original = parseDocument(input),
      doc = duplicateDocument(original)
    doc.name = original.name
    const created = await createProject(doc)
    await refresh()
    return created
  }
  return {
    projects,
    count,
    loading,
    error,
    warning,
    refresh,
    create,
    rename,
    duplicate,
    remove,
    importDocument,
  }
})
