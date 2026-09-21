import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

// Placeholder values keep the app rendering (with a setup notice) when .env.local is missing.
export const supabase = createClient(url || 'http://localhost', key || 'missing-key')
