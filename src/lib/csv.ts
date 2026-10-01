import Papa from 'papaparse'
import { htmlToText } from './textFormat'

export const MAX_CSV_BYTES = 5 * 1024 * 1024

/**
 * Parses a CSV, TSV or plain-text (.txt) file into rows — the delimiter (comma, tab, etc.) is
 * auto-detected. Also understands Anki's plain-text export format: lines starting with `#` are
 * metadata and are dropped, and if one of them is `#html:true`, each cell's simple HTML is
 * converted into our markdown syntax instead of showing up as literal tags.
 */
export async function parseTabularFile(file: File): Promise<string[][]> {
  if (file.size > MAX_CSV_BYTES) throw new Error('File is larger than 5 MB.')

  const raw = await file.text()
  let html = false
  const body = raw
    .split('\n')
    .filter((line) => {
      if (!line.trimStart().startsWith('#')) return true
      if (/^#\s*html:\s*true/i.test(line.trim())) html = true
      return false
    })
    .join('\n')

  const { data, errors } = Papa.parse<string[]>(body, { skipEmptyLines: 'greedy' })
  if (errors.length && data.length === 0) throw new Error(errors[0].message)
  return html ? data.map((row) => row.map(htmlToText)) : data
}

export type ImportedCard = { front: string; back: string }

/** Apply the user's column mapping; drops rows where either side is blank. */
export function mapRows(
  rows: string[][],
  frontCol: number,
  backCol: number,
  hasHeader: boolean,
): ImportedCard[] {
  return (hasHeader ? rows.slice(1) : rows)
    .map((r) => ({
      front: (r[frontCol] ?? '').trim().slice(0, 5000),
      back: (r[backCol] ?? '').trim().slice(0, 5000),
    }))
    .filter((c) => c.front && c.back)
}
