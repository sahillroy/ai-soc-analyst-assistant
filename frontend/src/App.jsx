import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AppShell from './components/AppShell';

// Fix: key must match what AuthContext writes ('soc_auth_token')
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('soc_auth_token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Login />} />

        {/* Protected Routes handled by AppShell */}
        <Route path="/*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}