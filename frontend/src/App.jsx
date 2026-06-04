import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AppShell from './components/AppShell';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ children }) {
  const { user } = useAuth();

  // Still loading Firebase auth state — show a blank dark screen to prevent flash
  if (user === undefined) {
    return <div style={{ background: '#0b1326', height: '100vh' }} />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Login />} />

          {/* Redirect /signup to login — no public signup */}
          <Route path="/signup" element={<Navigate to="/" replace />} />

          {/* Protected Routes handled by AppShell */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}