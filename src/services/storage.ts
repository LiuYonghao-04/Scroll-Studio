import { parseDocument } from '../core/document'
import type { PageDocument } from '../types/editor'
export const STORAGE_KEY = 'scroll-studio:document:v1'
export function loadDocument(): PageDocument | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? parseDocument(raw) : null
}
export function saveDocument(doc: PageDocument): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
}
