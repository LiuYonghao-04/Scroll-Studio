import { onBeforeUnmount, watch, type Ref } from 'vue'

export function useModalDialog(dialog: Ref<HTMLDialogElement | undefined>) {
  let returnFocus: HTMLElement | undefined
  function trapTab(event: KeyboardEvent) {
    const element = dialog.value
    if (!element || event.key !== 'Tab') return
    const targets = [
      ...element.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], iframe, [tabindex]',
      ),
    ].filter(
      (target) =>
        target.tabIndex >= 0 &&
        !target.matches(':disabled') &&
        !target.closest('[inert]') &&
        target.getClientRects().length > 0,
    )
    const first = targets[0],
      last = targets.at(-1),
      active = document.activeElement
    if (
      !targets.includes(active as HTMLElement) ||
      (event.shiftKey && active === first) ||
      (!event.shiftKey && active === last)
    ) {
      event.preventDefault()
      ;(event.shiftKey ? last : first)?.focus()
    }
  }
  const restore = () => {
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
    returnFocus = undefined
  }
  watch(
    dialog,
    (element, previous) => {
      previous?.close()
      previous?.removeEventListener('keydown', trapTab)
      if (!element) {
        restore()
        return
      }
      returnFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : undefined
      element.showModal()
      element.addEventListener('keydown', trapTab)
    },
    { flush: 'post' },
  )
  onBeforeUnmount(() => {
    dialog.value?.close()
    dialog.value?.removeEventListener('keydown', trapTab)
    restore()
  })
}
