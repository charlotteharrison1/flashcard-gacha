import { useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { mapRows, parseCsv } from '../lib/csv'

const CHUNK = 500

export default function CsvImport({ deckId, onImported }: { deckId: string; onImported: () => void }) {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [hasHeader, setHasHeader] = useState(true)
  const [frontCol, setFrontCol] = useState(0)
  const [backCol, setBackCol] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setStatus(null)
    try {
      const parsed = await parseCsv(file)
      if (parsed.length === 0 || parsed[0].length < 2) throw new Error('CSV needs at least two columns.')
      setRows(parsed)
      setFrontCol(0)
      setBackCol(1)
    } catch (err) {
      setRows(null)
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  const cards = rows ? mapRows(rows, frontCol, backCol, hasHeader) : []

  async function importAll() {
    setBusy(true)
    setError(null)
    for (let i = 0; i < cards.length; i += CHUNK) {
      const chunk = cards.slice(i, i + CHUNK).map((c) => ({ ...c, deck_id: deckId, source: 'csv' as const }))
      const { error } = await supabase.from('cards').insert(chunk)
      if (error) {
        setError(`Imported ${i} of ${cards.length} cards, then failed: ${error.message}`)
        setBusy(false)
        onImported()
        return
      }
    }
    setStatus(`Imported ${cards.length} cards.`)
    setRows(null)
    setBusy(false)
    onImported()
  }

  const columnCount = rows ? Math.max(...rows.slice(0, 50).map((r) => r.length)) : 0
  const label = (i: number) => (hasHeader && rows ? rows[0][i] || `Column ${i + 1}` : `Column ${i + 1}`)

  return (
    <section className="panel">
      <h3>Import from CSV</h3>
      <input type="file" accept=".csv,text/csv" onChange={pick} />
      <div className="format-help">
        <p>
          <strong>Accepted format</strong>
        </p>
        <ul>
          <li>
            A <code>.csv</code> file saved as UTF-8, up to 5 MB.
          </li>
          <li>One card per row: one column for the front, another for the back.</li>
          <li>
            Extra columns are fine. After uploading, you pick which two to use. The header checkbox is on by default; untick it if
            your file has no header row.
          </li>
          <li>Rows with a blank front or back are skipped, and text over 5,000 characters is cut off.</li>
          <li>Wrap any cell that contains a comma or line break in double quotes.</li>
        </ul>
        <pre>{`front,back\nbonjour,hello\n"Capital of France, city",Paris`}</pre>
      </div>
      {error && <p className="error">{error}</p>}
      {status && <p className="notice">{status}</p>}
      {rows && (
        <div className="stack">
          <label>
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> First row is a header
          </label>
          <div className="row">
            <label>
              Front:{' '}
              <select value={frontCol} onChange={(e) => setFrontCol(Number(e.target.value))}>
                {Array.from({ length: columnCount }, (_, i) => (
                  <option key={i} value={i}>
                    {label(i)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Back:{' '}
              <select value={backCol} onChange={(e) => setBackCol(Number(e.target.value))}>
                {Array.from({ length: columnCount }, (_, i) => (
                  <option key={i} value={i}>
                    {label(i)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            Preview (first 3 of {cards.length} cards):
          </p>
          <ul className="list">
            {cards.slice(0, 3).map((c, i) => (
              <li key={i}>
                <strong>{c.front}</strong> <span className="muted">→ {c.back}</span>
              </li>
            ))}
          </ul>
          <button className="gold" onClick={importAll} disabled={busy || cards.length === 0}>
            {busy ? 'Importing…' : `Import ${cards.length} cards`}
          </button>
        </div>
      )}
    </section>
  )
}
