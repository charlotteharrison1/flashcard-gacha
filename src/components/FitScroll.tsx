import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

const MIN_FIT = 0.5 // never shrink below half size; past that the text just scrolls
const STEP = 0.02 // how finely to search between half and full size

/**
 * Sets --fit (a multiplier, 1 = full size) to the largest value at which the content fits inside `el`.
 * `comfortable` also asks for the card to stay under about a third of the screen height, so a big card gets
 * smaller type well before it hits its hard height cap (which is where it would start to scroll).
 */
function fit(el: HTMLElement, comfortable: boolean) {
  const comfort = Math.max(200, window.innerHeight * 0.38)
  const fits = (f: number) => {
    el.style.setProperty('--fit', String(f))
    return el.scrollHeight <= (comfortable ? Math.min(el.clientHeight + 1, comfort) : el.clientHeight + 1)
  }
  if (fits(1)) return
  if (!fits(MIN_FIT)) return // still too long at the smallest size: leave it there and let it scroll
  let lo = MIN_FIT // fits
  let hi = 1 // doesn't
  while (hi - lo > STEP) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  el.style.setProperty('--fit', String(lo))
}

/**
 * The scrolling text area inside a flashcard. The card has a height cap; this measures the real
 * rendered text (so math, lists and pictures all count) and shrinks the type until it fits, or
 * to a minimum, after which the area scrolls. It measures in a layout effect, which runs before
 * the browser paints, so the card never visibly resizes. `watch` changes when the content does.
 */
export default function FitScroll({ watch, comfortable = false, children }: { watch: string; comfortable?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (ref.current) fit(ref.current, comfortable)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure only when the content changes
  }, [watch])

  // Things that change the size after first paint: the window, pictures finishing loading, web fonts arriving.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const refit = () => fit(el, comfortable)
    window.addEventListener('resize', refit)
    el.addEventListener('load', refit, true) // <img> load events don't bubble, so listen in the capture phase
    document.fonts?.ready.then(refit)
    return () => {
      window.removeEventListener('resize', refit)
      el.removeEventListener('load', refit, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `comfortable` is fixed for a given card face
  }, [])

  return (
    <div className="face-scroll" ref={ref}>
      {children}
    </div>
  )
}
