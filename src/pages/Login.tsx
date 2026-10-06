import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import SchemeButton from '../components/SchemeButton'
import PixelTitle, { Plait } from '../components/PixelTitle'
import { SlotSymbol } from '../components/SlotSymbol'

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else if (!data.session) setNotice('Check your email to confirm your account, then sign in.')
    }
    setBusy(false)
  }

  return (
    <main className="narrow login-main">
      {/* The same double-framed box (and checkerboard behind it) as the home page */}
      <div className="home-box login-box">
        <span className="home-suit tl"><SlotSymbol id="spade" /></span>
        <span className="home-suit tr"><SlotSymbol id="heart" /></span>
        <span className="home-suit bl"><SlotSymbol id="suitDiamond" /></span>
        <span className="home-suit br"><SlotSymbol id="club" /></span>

      <h1 className="logo">
        <PixelTitle scale={3} />
        <Plait scale={3} />
      </h1>
      <form onSubmit={submit} className="stack">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <button className="gold" disabled={busy}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        {error && <p className="error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
      </form>
      <button className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
      <p>
        <SchemeButton />
      </p>
      </div>
    </main>
  )
}
