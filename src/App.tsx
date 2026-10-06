import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured, supabase } from './lib/supabase'
import Login from './pages/Login'
import Decks from './pages/Decks'
import Deck from './pages/Deck'
import Study from './pages/Study'
import Preview from './pages/Preview'
import Pull from './pages/Pull'
import Deckbox from './pages/Deckbox'
import SettingsMenu from './components/SettingsMenu'

function Layout() {
  const { session, loading } = useAuth()
  if (loading) return <p className="narrow">Loading…</p>
  if (!session) return <Navigate to="/login" replace />
  return (
    <>
      {/* The top bar spans the whole window: the logo at the left edge, the account controls at the right edge. */}
      <header className="app-header row between">
        <Link to="/" className="brand">
          Tyche
        </Link>
        <span className="row">
          <span className="muted user-email" title={session.user.email}>
            {session.user.email}
          </span>
          <button className="link" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
          <SettingsMenu />
        </span>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}

function LoginRoute() {
  const { session, loading } = useAuth()
  if (loading) return null
  return session ? <Navigate to="/" replace /> : <Login />
}

export default function App() {
  if (!isConfigured) {
    return (
      <main className="narrow">
        <h1>Setup needed</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Supabase URL and anon key, then restart{' '}
          <code>npm run dev</code>.
        </p>
      </main>
    )
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<Layout />}>
            <Route index element={<Decks />} />
            <Route path="decks/:id" element={<Deck />} />
            <Route path="decks/:id/study" element={<Study scope="deck" />} />
            <Route path="boxes/:id" element={<Deckbox />} />
            <Route path="boxes/:id/study" element={<Study scope="box" />} />
            <Route path="decks/:id/preview" element={<Preview />} />
            <Route path="pull" element={<Pull />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
