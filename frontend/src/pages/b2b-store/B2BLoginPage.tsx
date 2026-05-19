import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { b2bApi } from '../../services/b2b-api';
import { useGlobalLanguage } from '../../hooks/useLanguage';
import { useB2BAuthStore } from '../../stores/b2b/b2b-auth.store';
import { trackLogin } from '../../services/retargeting';
import { resolveB2BStorePath } from '../../utils/runtime-branding';

export const B2BLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useGlobalLanguage();
  const isRo = language === 'ro';
  const { login, isAuthenticated } = useB2BAuthStore();
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const storePath = (pathname: string) => resolveB2BStorePath(pathname, hostname);

  const queryParams = new URLSearchParams(location.search);
  const redirectParam = queryParams.get('redirect');
  const redirectPath =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : '/b2b-portal/dashboard';

  // Already authenticated B2B users get redirected to the portal
  if (isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await b2bApi.login(email, password);
      login(response.token, response.refresh_token, response.customer);
      trackLogin({ method: 'email', user_type: 'b2b', source: 'b2b_store' });
      navigate(redirectPath);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          (isRo
            ? 'Autentificare eșuată. Verifică email-ul și parola.'
            : 'Login failed. Check email and password.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
      <div className="max-w-md w-full bg-surface-primary rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">Cypher B2B Portal</h1>
          <p className="text-text-secondary mt-2">
            {isRo ? 'Autentifică-te în contul tău B2B' : 'Login to your B2B account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-border-secondary rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="your@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
              {isRo ? 'Parolă' : 'Password'}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-border-secondary rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="••••••••"
            />
            <div className="mt-2 text-right">
              <Link
                to={storePath('/forgot-password')}
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                {isRo ? 'Ai uitat parola?' : 'Forgot password?'}
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? isRo
                ? 'Se autentifică...'
                : 'Logging in...'
              : isRo
                ? 'Autentificare'
                : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to={storePath('/register')} className="text-sm text-primary-600 hover:text-primary-500">
            {isRo ? 'Nu ai cont? Înregistrează-te aici' : "Don't have an account? Register here"}
          </Link>
        </div>
      </div>
    </div>
  );
};
