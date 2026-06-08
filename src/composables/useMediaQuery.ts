import { ref, onMounted, onUnmounted, type Ref } from 'vue'

/** Reactive `window.matchMedia` boolean. Registers a listener on mount and
 *  cleans it up on unmount. Returns `false` during SSR / before mount. */
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false)
  let mql: MediaQueryList | null = null
  const update = () => {
    if (mql) matches.value = mql.matches
  }
  onMounted(() => {
    mql = window.matchMedia(query)
    update()
    mql.addEventListener('change', update)
  })
  onUnmounted(() => {
    mql?.removeEventListener('change', update)
  })
  return matches
}
