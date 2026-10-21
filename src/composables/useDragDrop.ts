import type { DragPayload, NodeKind } from '../types/editor'
import { nodeKinds } from '../types/editor'
import { useEditorStore } from '../stores/editor'
import { blockPresets, createBlock, type BlockPresetId } from '../core/presets'
const MIME = 'application/x-scroll-studio'
export function useDragDrop() {
  const store = useEditorStore()
  function start(event: DragEvent, payload: DragPayload) {
    if (!event.dataTransfer) return
    const json = JSON.stringify(payload)
    event.dataTransfer.setData(MIME, json)
    // Some WebKit ports strip custom MIME data during a native drag.
    event.dataTransfer.setData('text/plain', `${MIME}:${json}`)
    event.dataTransfer.effectAllowed = payload.kind === 'move' ? 'move' : 'copy'
  }
  function drop(event: DragEvent, parentId: string | null, index?: number) {
    event.preventDefault()
    event.stopPropagation()
    try {
      const text = event.dataTransfer?.getData('text/plain') ?? ''
      const json =
        event.dataTransfer?.getData(MIME) ||
        (text.startsWith(`${MIME}:`) ? text.slice(MIME.length + 1) : '')
      const raw: unknown = JSON.parse(json)
      if (
        typeof raw !== 'object' ||
        !raw ||
        !('kind' in raw) ||
        !('value' in raw) ||
        typeof raw.value !== 'string'
      )
        return
      if (raw.kind === 'new' && nodeKinds.includes(raw.value as NodeKind))
        store.add(raw.value as NodeKind, parentId, index)
      else if (raw.kind === 'move') store.move(raw.value, parentId, index)
      else if (raw.kind === 'block' && blockPresets.some((preset) => preset.id === raw.value))
        store.insertBlock(createBlock(raw.value as BlockPresetId), parentId, index)
    } catch {
      /* Ignore foreign drag payloads. */
    }
  }
  return { start, drop }
}
