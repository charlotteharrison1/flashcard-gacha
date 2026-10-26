/**
 * The last home screen and coin balance, kept on this device so the app can draw instantly on the next
 * visit while fresh data loads in the background. Keyed by user id, and cleared on sign out.
 */
const PREFIX = 'tyche:'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null // storage blocked, or the saved text is damaged: just load normally
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // storage full or blocked: caching is optional
  }
}

export const loadHome = <T>(userId: string) => read<T>(`home:${userId}`)
export const saveHome = (userId: string, data: unknown) => write(`home:${userId}`, data)
export const loadBalance = (userId: string) => read<number>(`balance:${userId}`)
export const saveBalance = (userId: string, balance: number) => write(`balance:${userId}`, balance)

export function clearCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}
