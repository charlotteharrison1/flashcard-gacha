import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { DEFAULT_FONT, type CardFont } from './fonts'
import type { Orientation } from './types'

/** The user's presets: what a new deck or card starts with. */
export type Settings = { default_font: CardFont; show_both: boolean; float_anim: boolean; orientation: Orientation }

export const DEFAULT_SETTINGS: Settings = { default_font: DEFAULT_FONT, show_both: false, float_anim: true, orientation: 'horizontal' }

/**
 * Loads the signed-in user's presets (one row in user_settings) and saves changes to them.
 * Until 0018_user_settings.sql has been run there is no table, so this falls back to the built-in defaults.
 */
export function useSettings() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('user_settings')
      .select('*') // all columns, so a database that hasn't had the newest migration yet still loads the rest
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data) setSettings({ ...DEFAULT_SETTINGS, ...(data as Partial<Settings>) })
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const save = useCallback(
    async (patch: Partial<Settings>) => {
      if (!userId) return
      setSettings((s) => ({ ...s, ...patch })) // show it straight away
      setSaveError(null)
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() })
      if (error) setSaveError(error.message)
    },
    [userId],
  )

  return { settings, ready, save, saveError }
}
