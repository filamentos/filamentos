import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/auth'
import { api } from './lib/api'
import type { User } from '@shared/types'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import FilamentPage from './pages/Filament'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const setUser = useAuthStore((s) => s.setUser)

  // Re-hydrate session on app load
  useEffect(() => {
    api.get<User>('/auth/me')
      .then((user) => setUser(user))
      .catch(() => setUser(null))
  }, [setUser])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/filament"
          element={
            <ProtectedRoute>
              <FilamentPage />
            </ProtectedRoute>
          }
        />

        {/* Placeholder routes for future phases */}
        <Route path="/printers"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/workshop"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/quotes"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/alerts"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/settings"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
