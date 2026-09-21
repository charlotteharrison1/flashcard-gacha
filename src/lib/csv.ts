import Papa from 'papaparse'

export const MAX_CSV_BYTES = 5 * 1024 * 1024

/** Parse a CSV file into raw rows. Column mapping happens in the UI. */
export function parseCsv(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_CSV_BYTES) {
      reject(new Error('File is larger than 5 MB.'))
      return
    }
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: (res) => resolve(res.data),
      error: (err) => reject(err),
    })
  })
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
