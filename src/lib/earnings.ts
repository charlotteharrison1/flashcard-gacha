import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { loadBalance, saveBalance } from './homeCache'

/** Display copy of pull_cost in supabase/migrations/0026_fsrs.sql — the database is the source of truth. */
export const PULL_COST = 10

/** Size of the 10-pull bulk buy. The database allows up to 10 per call. */
export const BULK_PULLS = 10

/** `fetch: false` for screens that don't show the balance (or that get it some other way) so they don't ask for it. */
export function useEarnings({ fetch = true }: { fetch?: boolean } = {}) {
  const userId = useAuth().session?.user.id ?? ''
  const [balance, setBalance] = useState<number | null>(() => (userId ? loadBalance(userId) : null)) // last known, until fresh arrives
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userId && balance !== null) saveBalance(userId, balance)
  }, [userId, balance])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_earnings')
    if (error) setError(error.message)
    else {
      setError(null)
      setBalance(data as number)
    }
  }, [])

  useEffect(() => {
    if (fetch) refresh()
  }, [fetch, refresh])

  return { balance, setBalance, error, refresh }
}
