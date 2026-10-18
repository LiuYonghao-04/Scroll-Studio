import type { PageDocument } from './editor'
export type TemplateId = 'blank' | 'portfolio' | 'product' | 'story'
export interface ProjectRecord {
  id: string
  document: PageDocument
  createdAt: string
  updatedAt: string
  revision: number
  thumbnail: string
}
export interface ProjectJournal {
  document: PageDocument
  revision: number
}
