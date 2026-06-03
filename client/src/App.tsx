import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/auth'
import { api } from './lib/api'
import type { User } from '@shared/types'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import FilamentPage from './pages/Filament'
import PrintersPage from './pages/Printers'
import WorkshopPage from './pages/Workshop'
import ProjectsPage from './pages/Projects'
import SettingsPage from './pages/Settings'
import AlertsPage from './pages/Alerts'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function P({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

export default function App() {
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    api.get<User>('/auth/me')
      .then((user) => setUser(user))
      .catch(() => setUser(null))
  }, [setUser])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"     element={<Login />} />
        <Route path="/"          element={<P><Dashboard /></P>} />
        <Route path="/filament"  element={<P><FilamentPage /></P>} />
        <Route path="/printers"  element={<P><PrintersPage /></P>} />
        <Route path="/workshop"  element={<P><WorkshopPage /></P>} />
        <Route path="/purchases" element={<Navigate to="/" replace />} />
        <Route path="/projects"  element={<P><ProjectsPage /></P>} />
        <Route path="/quotes"    element={<Navigate to="/projects" replace />} />
        <Route path="/settings"  element={<P><SettingsPage /></P>} />
        <Route path="/alerts"    element={<P><AlertsPage /></P>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
