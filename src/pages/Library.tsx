import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { effectiveColor } from '../lib/theme'
import { logoFor } from '../lib/logos'
import CardLogo from '../components/CardLogo'

export type LibraryDeck = {
  id: string
  slug: string
  name: string
  subject: string
  description: string
  color: number | null
  logo: string | null
  guided: boolean
  library_cards?: { count: number }[]
}

/** Copies a preset deck into the signed-in account; resolves to an error message, or null on success. */
export async function takeLibraryDeck(slug: string): Promise<string | null> {
  const { error } = await supabase.rpc('take_library_deck', { p_slug: slug })
  return error ? error.message : null
}

/** The shelf of preset decks: preview one, or take it onto the home screen. */
export default function Library() {
  const navigate = useNavigate()
  const [decks, setDecks] = useState<LibraryDeck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [taking, setTaking] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('library_decks')
      .select('*, library_cards(count)')
      .order('sort')
      .then(({ data, error }) => {
        if (error) setError(`${error.message}. Have you run supabase/migrations/0023_library.sql?`)
        else setDecks(data as LibraryDeck[])
      })
  }, [])

  async function take(slug: string) {
    setTaking(slug)
    setError(null)
    const err = await takeLibraryDeck(slug)
    if (err) {
      setError(err)
      setTaking(null)
      return
    }
    navigate('/')
  }

  return (
    <>
      <p>
        <Link to="/">← Home</Link>
      </p>
      <section className="panel library-panel">
        <h2>The Library</h2>
        <h3>Preset decks</h3>
        {error && <p className="error">{error}</p>}
        {decks === null ? (
          !error && <p className="muted">Dusting the shelves…</p>
        ) : decks.length === 0 ? (
          <p className="muted">The shelves are empty for now.</p>
        ) : (
          <ul className="library-shelf">
            {decks.map((d) => {
              const n = d.library_cards?.[0]?.count ?? 0
              return (
                <li key={d.id} className="library-item">
                  <div className={`tile cardback c${effectiveColor(d.id, d.color)}`}>
                    <Link to={`/library/${d.slug}`} className="tile-main" aria-label={`Preview ${d.name}`}>
                      <span className="tile-logo">
                        <CardLogo id={logoFor(d.id, d.logo)} />
                      </span>
                      <span className="tile-plate">{d.name}</span>
                      <span className="tile-count">
                        {n} card{n === 1 ? '' : 's'}
                      </span>
                    </Link>
                  </div>
                  <p className="muted library-blurb">{d.description}</p>
                  <div className="row library-actions">
                    <Link className="button secondary sm" to={`/library/${d.slug}`}>
                      Preview
                    </Link>
                    <button className="gold sm" onClick={() => take(d.slug)} disabled={taking !== null}>
                      {taking === d.slug ? 'Taking…' : 'Take'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
