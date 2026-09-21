import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Display copy of pull_cost in supabase/migrations/0002_pulls.sql — the database is the source of truth. */
export const PULL_COST = 10

export function useEarnings() {
  const [balance, setBalance] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_earnings')
    if (error) setError(error.message)
    else {
      setError(null)
      setBalance(data as number)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { balance, setBalance, error, refresh }
}
