import React, { useState } from 'react';
import { Eye, EyeOff, Mail, User, Lock, AlertCircle } from 'lucide-react';

const LoginScreen = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const validateForm = () => {
    if (!formData.username) {
      setError('Por favor, digite seu usuário ou e-mail');
      return false;
    }
    if (!formData.password) {
      setError('Por favor, digite sua senha');
      return false;
    }
    if (formData.password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    try {
      setLoading(true);

      // Simulating API call to the specified endpoint
      const response = await new Promise((resolve) => {
        setTimeout(() => {
          // Simulated response based on input
          // In a real application, this would be a fetch call to the backend
          const simulateError = formData.username === 'error@example.com';
          const simulateMfa = formData.username === 'mfa@example.com';

          if (simulateError) {
            resolve({
              ok: false,
              json: () => Promise.resolve({ error: 'Usuário ou senha inválidos' })
            });
          } else if (simulateMfa) {
            resolve({
              ok: true,
              json: () => Promise.resolve({ requireMfa: true })
            });
          } else {
            resolve({
              ok: true,
              json: () => Promise.resolve({
                token: "eyJhbGciOiJIUzI1NiIsIn...",
                refresh_token: "dQw4w9WgXcQ..."
              })
            });
          }
        }, 1000);
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error);
        return;
      }

      if (data.requireMfa) {
        setShowMfa(true);
        return;
      }

      // Store tokens in localStorage or secure cookie
      if (formData.rememberMe) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refresh_token);
      } else {
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('refreshToken', data.refresh_token);
      }

      // Redirect to dashboard
      alert('Login bem-sucedido! Redirecionando para o dashboard...');

    } catch (err) {
      setError('Ocorreu um erro ao tentar fazer login. Tente novamente.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();

    if (!mfaCode) {
      setError('Por favor, digite o código de verificação');
      return;
    }

    setLoading(true);

    // Simulate MFA verification
    await new Promise(resolve => setTimeout(resolve, 1000));

    setLoading(false);

    if (mfaCode === '123456') {
      // Store tokens in localStorage or secure cookie
      const mockToken = {
        token: "eyJhbGciOiJIUzI1NiIsIn...",
        refresh_token: "dQw4w9WgXcQ..."
      };

      if (formData.rememberMe) {
        localStorage.setItem('token', mockToken.token);
        localStorage.setItem('refreshToken', mockToken.refresh_token);
      } else {
        sessionStorage.setItem('token', mockToken.token);
        sessionStorage.setItem('refreshToken', mockToken.refresh_token);
      }

      alert('Autenticação de dois fatores bem-sucedida! Redirecionando para o dashboard...');
    } else {
      setError('Código de verificação inválido. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex justify-center mb-8">
          {/* Logo da empresa */}
          <div className="w-32 h-12 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold">
            LOGO
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
          {showMfa ? 'Verificação em Duas Etapas' : 'Entrar na sua conta'}
        </h1>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-900 rounded-md p-3 mb-4 flex items-start">
            <AlertCircle className="text-red-500 dark:text-red-400 mr-2 h-5 w-5 mt-0.5" />
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {!showMfa ? (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                E-mail ou nome de usuário
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Seu e-mail ou nome de usuário"
                  value={formData.username}
                  onChange={handleChange}
                  className="pl-10 w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Senha
                </label>
                <a href="#" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="Sua senha"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center mb-6">
              <input
                type="checkbox"
                id="rememberMe"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Manter-me conectado
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex justify-center"
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              Entrar
            </button>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Não tem uma conta?{' '}
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  Criar conta
                </a>
              </p>
            </div>

            <div className="mt-8">
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                Para testar o fluxo de erro, use: error@example.com<br />
                Para testar o fluxo de MFA, use: mfa@example.com
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit}>
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Um código de verificação foi enviado para seu dispositivo. Digite o código abaixo para continuar.
              </p>
              <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Código de verificação
              </label>
              <input
                type="text"
                id="mfaCode"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Digite o código de 6 dígitos"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                maxLength={6}
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Para testar, use o código: 123456
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex justify-center"
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              Verificar
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowMfa(false)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Voltar para o login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;