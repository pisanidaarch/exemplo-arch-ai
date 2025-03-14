// auth-system/frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './pages/LoginScreen';
import authService from './services/authService';

// Componente Dashboard simples para demonstração
const Dashboard = () => (
  <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Dashboard</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-4">
        Você está logado com sucesso!
      </p>
      <button
        onClick={() => {
          authService.logout();
          window.location.href = '/login';
        }}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
      >
        Sair
      </button>
    </div>
  </div>
);

// Componente de proteção de rota
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;