import { parseDocument } from '../core/document'
import { projectThumbnail } from '../core/thumbnail'
import type { PageDocument } from '../types/editor'
import type { ProjectJournal, ProjectRecord, ProjectSummary } from '../types/project'
import { STORAGE_KEY } from './storage'

export const PROJECT_DB = 'scroll-studio:projects'
export const ACTIVE_PROJECT_KEY = 'scroll-studio:active-project:v1'
export const journalKey = (id: string) => `scroll-studio:pending:${id}`
let connection: Promise<IDBDatabase> | undefined
function storageError(error: unknown): Error {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'QuotaExceededError'
  )
    return new Error('作品存储空间不足，请先导出 JSON 备份，再清理浏览器存储。')
  return error instanceof Error ? error : new Error('作品存储失败，请检查浏览器存储空间。')
}
function database(): Promise<IDBDatabase> {
  if (connection) return connection
  connection = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('当前浏览器无法使用作品存储，请使用支持 IndexedDB 的浏览器。'))
      return
    }
    const request = indexedDB.open(PROJECT_DB, 1)
    let blocked = false
    request.onupgradeneeded = () => {
      request.result.createObjectStore('projects', { keyPath: 'id' })
      request.result.createObjectStore('meta')
    }
    request.onsuccess = () => {
      if (blocked) {
        request.result.close()
        return
      }
      request.result.onversionchange = () => {
        request.result.close()
        connection = undefined
      }
      resolve(request.result)
    }
    request.onerror = () => reject(storageError(request.error))
    request.onblocked = () => {
      blocked = true
      reject(new Error('作品存储升级被其他标签页阻止，请关闭旧标签页后重试。'))
    }
  })
  void connection.catch(() => {
    connection = undefined
  })
  return connection
}
async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  task: (tx: IDBTransaction, result: (value: T) => void, fail: (error: unknown) => void) => void,
): Promise<T> {
  const db = await database()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    let value: T, failure: Error | undefined
    const fail = (error: unknown) => {
      failure = storageError(error)
      try {
        tx.abort()
      } catch {
        reject(error)
      }
    }
    tx.oncomplete = () => resolve(value)
    tx.onabort = tx.onerror = () => reject(failure ?? storageError(tx.error))
    try {
      task(
        tx,
        (next) => {
          value = next
        },
        fail,
      )
    } catch (error) {
      fail(error)
    }
  })
}
function record(input: unknown): ProjectRecord {
  if (typeof input !== 'object' || input === null) throw new Error('作品不存在或数据已损坏。')
  const data = input as Record<string, unknown>
  if (
    typeof data.id !== 'string' ||
    typeof data.createdAt !== 'string' ||
    typeof data.updatedAt !== 'string' ||
    typeof data.revision !== 'number' ||
    !Number.isInteger(data.revision) ||
    data.revision < 1
  )
    throw new Error('作品数据无法读取。')
  const document = parseDocument(data.document)
  return {
    id: data.id,
    document,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    revision: data.revision,
    thumbnail: projectThumbnail(document),
  }
}
function fresh(document: PageDocument): ProjectRecord {
  const valid = parseDocument(document),
    now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    document: valid,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    thumbnail: projectThumbnail(valid),
  }
}
export async function initializeProjects(): Promise<string> {
  let legacy: ProjectRecord | undefined,
    warning = ''
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) legacy = fresh(parseDocument(raw))
  } catch {
    warning = '旧草稿无法读取，原数据已保留。你仍可新建作品，或导入有效 JSON 备份。'
  }
  return transaction(['projects', 'meta'], 'readwrite', (tx, result, fail) => {
    const meta = tx.objectStore('meta'),
      request = meta.get('legacy-migrated')
    request.onsuccess = () => {
      try {
        if (request.result) {
          result('')
          return
        }
        if (warning) {
          result(warning)
          return
        }
        if (legacy) tx.objectStore('projects').add(legacy)
        meta.put(true, 'legacy-migrated')
        result('')
      } catch (error) {
        fail(error)
      }
    }
  })
}
export async function listProjects(): Promise<ProjectRecord[]> {
  return transaction(['projects'], 'readonly', (tx, result, fail) => {
    const request = tx.objectStore('projects').getAll()
    request.onsuccess = () => {
      try {
        result(
          (request.result as unknown[])
            .map(record)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        )
      } catch (error) {
        fail(error)
      }
    }
  })
}
// Read one record at a time and release embedded images instead of retaining every project asset in UI state.
export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  return transaction(['projects'], 'readonly', (tx, result, fail) => {
    const summaries: ProjectSummary[] = []
    const request = tx.objectStore('projects').openCursor()
    request.onsuccess = () => {
      try {
        const cursor = request.result
        if (!cursor) {
          result(summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
          return
        }
        const current = record(cursor.value as unknown)
        summaries.push({
          id: current.id,
          createdAt: current.createdAt,
          updatedAt: current.updatedAt,
          revision: current.revision,
          thumbnail: current.thumbnail,
          document: { name: current.document.name },
        })
        cursor.continue()
      } catch (error) {
        fail(error)
      }
    }
  })
}
export async function getProject(id: string): Promise<ProjectRecord> {
  return transaction(['projects'], 'readonly', (tx, result, fail) => {
    const request = tx.objectStore('projects').get(id)
    request.onsuccess = () => {
      try {
        result(record(request.result as unknown))
      } catch (error) {
        fail(error)
      }
    }
  })
}
export async function createProject(document: PageDocument): Promise<ProjectRecord> {
  const next = fresh(document)
  return transaction(['projects'], 'readwrite', (tx, result) => {
    tx.objectStore('projects').add(next)
    result(next)
  })
}
export async function updateProject(
  id: string,
  document: PageDocument,
  revision: number,
): Promise<ProjectRecord> {
  const valid = parseDocument(document)
  return transaction(['projects'], 'readwrite', (tx, result, fail) => {
    const store = tx.objectStore('projects'),
      request = store.get(id)
    request.onsuccess = () => {
      try {
        const current = record(request.result as unknown)
        if (current.revision !== revision)
          throw new Error('作品已被其他标签页修改。请先导出当前 JSON 备份，再重新打开作品。')
        const next = {
          ...current,
          document: valid,
          revision: revision + 1,
          updatedAt: new Date().toISOString(),
          thumbnail: projectThumbnail(valid),
        }
        store.put(next)
        result(next)
      } catch (error) {
        fail(error)
      }
    }
  })
}
export async function deleteProject(id: string, revision: number): Promise<void> {
  return transaction(['projects'], 'readwrite', (tx, result, fail) => {
    const store = tx.objectStore('projects'),
      request = store.get(id)
    request.onsuccess = () => {
      try {
        if (record(request.result as unknown).revision !== revision)
          throw new Error('作品已更新，请刷新列表后再删除。')
        store.delete(id)
        result(undefined)
      } catch (error) {
        fail(error)
      }
    }
  })
}
export function writeJournal(id: string, document: PageDocument, revision: number): void {
  localStorage.setItem(
    journalKey(id),
    JSON.stringify({ document, revision } satisfies ProjectJournal),
  )
}
export function readJournal(id: string): ProjectJournal | null {
  const raw = localStorage.getItem(journalKey(id))
  if (!raw) return null
  const data: unknown = JSON.parse(raw)
  if (
    typeof data !== 'object' ||
    data === null ||
    !('revision' in data) ||
    typeof data.revision !== 'number' ||
    !('document' in data)
  )
    throw new Error('作品的待保存草稿无法读取。请先导出备份。')
  return { document: parseDocument(data.document), revision: data.revision }
}
export async function closeProjectDatabase(): Promise<void> {
  const previous = connection
  connection = undefined
  if (previous) (await previous).close()
}
