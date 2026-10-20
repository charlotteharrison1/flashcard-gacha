import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

const MIN_FIT = 0.75 // never shrink below three quarters size; past that the text just scrolls
const MIN_FIT_WIDE = 0.35 // a formula too wide for the card may shrink this far before it scrolls sideways
const STEP = 0.02 // how finely to search for the size

/** The largest f from `floor` to 1 for which `ok(f)` holds (1 if it already does, `floor` if even that is not enough). */
function largest(ok: (f: number) => boolean, floor: number) {
  if (ok(1)) return 1
  if (!ok(floor)) return floor
  let lo = floor // ok
  let hi = 1 // not ok
  while (hi - lo > STEP) {
    const mid = (lo + hi) / 2
    if (ok(mid)) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * Sets --fit (a multiplier, 1 = full size) to the largest value at which the content fits inside `el`, both
 * ways: not too tall and not too wide. A long formula can't wrap, so it shrinks (down to MIN_FIT_WIDE) rather than
 * pushing the card wider or scrolling sideways.
 * `comfortable` also asks for the card to stay under about a third of the screen height, so a big card gets
 * smaller type well before it hits its hard height cap (which is where it would start to scroll).
 */
function fit(el: HTMLElement, comfortable: boolean) {
  el.style.removeProperty('--fit')
  if (!el.clientHeight) return // not laid out right now (hidden, mid-render): measuring would wrongly read as "too tall" and shrink the text
  const comfort = Math.max(200, window.innerHeight * 0.38)
  const set = (f: number) => el.style.setProperty('--fit', String(f))
  const tallOk = (f: number) => (set(f), el.scrollHeight <= (comfortable ? Math.min(el.clientHeight + 1, comfort) : el.clientHeight + 1))
  // Display maths scrolls inside its own box, so check those boxes as well as the area itself.
  const wideOk = (f: number) => (set(f), el.scrollWidth <= el.clientWidth + 1 && [...el.querySelectorAll('.md-math-block')].every((m) => m.scrollWidth <= m.clientWidth + 1))
  set(Math.min(largest(wideOk, MIN_FIT_WIDE), largest(tallOk, MIN_FIT)))
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
    document.fonts?.addEventListener('loadingdone', refit) // e.g. the math fonts, which only start loading once a formula is on screen
    return () => {
      window.removeEventListener('resize', refit)
      document.fonts?.removeEventListener('loadingdone', refit)
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
