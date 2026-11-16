import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEarnings } from '../lib/earnings'
import type { Result, Winnings } from '../lib/slots'
import Earnings from '../components/Earnings'
import Badge from '../components/Badge'
import { SlotSymbol } from '../components/SlotSymbol'
import SlotsGame from '../components/SlotsGame'

export default function Pull() {
  const { balance, setBalance, error: loadError } = useEarnings()
  const [winnings, setWinnings] = useState<Winnings | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  // The page background is a burst of lines pointing at the machine; tell the CSS where on the page the machine is.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const place = () => {
      const r = stage.getBoundingClientRect()
      document.body.style.setProperty('--burst-y', `${Math.round(r.top + window.scrollY + r.height / 2)}px`)
      document.body.style.setProperty('--burst-x', `${Math.round(r.left + window.scrollX + r.width / 2)}px`)
    }
    place()
    window.addEventListener('resize', place)
    const resizeObserver = new ResizeObserver(place) // the page above the machine can change height (errors, wrapping)
    resizeObserver.observe(document.body)
    return () => {
      window.removeEventListener('resize', place)
      resizeObserver.disconnect()
      document.body.style.removeProperty('--burst-y')
      document.body.style.removeProperty('--burst-x')
    }
  }, [])

  useEffect(() => {
    supabase.rpc('get_winnings').then(({ data }) => {
      if (data) setWinnings(data as Winnings)
    })
  }, [])

  const addResults = useCallback(
    (results: Result[]) =>
      setWinnings(
        (w) =>
          w && {
            pulls: w.pulls + results.length,
            silver: w.silver + results.filter((r) => r === 'silver').length,
            gold: w.gold + results.filter((r) => r === 'gold').length,
          },
      ),
    [],
  )

  return (
    <div className="pull">
      <div className="pull-main">
        <Link to="/" className="button spend keep-earning">
          <span className="keep-arrow">
            <SlotSymbol id="arrow" />
          </span>
          <span>Keep earning</span>
        </Link>
        <div className="wallet earn-panel">
          <Earnings compact balance={balance} />
        </div>

        {loadError && (
          <p className="error">
            Couldn't load earnings: {loadError}. Have you run <code>supabase/migrations/0002_pulls.sql</code>,{' '}
            <code>0003_slots.sql</code> and <code>0004_bulk_pulls.sql</code>?
          </p>
        )}

        <SlotsGame balance={balance} setBalance={setBalance} onResults={addResults} stageRef={stageRef} />
      </div>

      <div className="pull-side">
        <section className="panel winnings-panel">
          <h3>
            <SlotSymbol id="star" />
            Winnings
            <SlotSymbol id="star" />
          </h3>
          <div className="winnings">
            <div className="win">
              <Badge tier="gold" />
              <span className="win-count">{winnings?.gold ?? '–'}</span>
              <span className="win-label">Gold</span>
            </div>
            <div className="win">
              <Badge tier="silver" />
              <span className="win-count">{winnings?.silver ?? '–'}</span>
              <span className="win-label">Silver</span>
            </div>
            <div className="win">
              <span className="win-icon">
                <SlotSymbol id="coin" />
              </span>
              <span className="win-count">{winnings?.pulls ?? '–'}</span>
              <span className="win-label">Total pulls</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
