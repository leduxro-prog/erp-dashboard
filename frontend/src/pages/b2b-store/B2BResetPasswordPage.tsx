import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';
import { b2bApi } from '../../services/b2b-api';

export const B2BResetPasswordPage: React.FC = () => {
  const { language } = useGlobalLanguage();
  const isRo = language === 'ro';

  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    }),
    [password],
  );

  const isPasswordValid =
    passwordChecks.length &&
    passwordChecks.uppercase &&
    passwordChecks.lowercase &&
    passwordChecks.number;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(
        isRo
          ? 'Link de resetare invalid. Solicită un link nou.'
          : 'Invalid reset link. Request a new link.',
      );
      return;
    }

    if (!isPasswordValid) {
      setError(
        isRo
          ? 'Parola nu respectă cerințele minime.'
          : 'Password does not meet minimum requirements.',
      );
      return;
    }

    if (!passwordsMatch) {
      setError(isRo ? 'Parolele nu coincid.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await b2bApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : isRo
            ? 'A apărut o eroare neașteptată.'
            : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {isRo ? 'Link invalid' : 'Invalid link'}
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            {isRo
              ? 'Token-ul de resetare lipsește sau este invalid.'
              : 'Reset token is missing or invalid.'}
          </p>
          <Link
            to="/b2b-store/forgot-password"
            className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            {isRo ? 'Solicită link nou' : 'Request new link'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cypher B2B Portal</h1>
          <p className="text-gray-600 mt-2">{isRo ? 'Setează parola nouă' : 'Set new password'}</p>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isRo ? 'Parolă resetată' : 'Password reset'}
            </h3>
            <p className="text-sm text-gray-600 mb-5">
              {isRo
                ? 'Parola a fost schimbată cu succes. Te poți autentifica acum.'
                : 'Password updated successfully. You can log in now.'}
            </p>
            <Link
              to="/b2b-store/login"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              {isRo ? 'Mergi la Login B2B' : 'Go to B2B Login'}
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-5">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {isRo ? 'Parolă nouă' : 'New password'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">
                    <Lock size={16} />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-500"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <div className={passwordChecks.length ? 'text-green-600' : 'text-gray-500'}>
                  {passwordChecks.length ? '✓' : '•'}{' '}
                  {isRo ? 'minim 8 caractere' : 'minimum 8 characters'}
                </div>
                <div className={passwordChecks.uppercase ? 'text-green-600' : 'text-gray-500'}>
                  {passwordChecks.uppercase ? '✓' : '•'}{' '}
                  {isRo ? 'o literă mare' : 'one uppercase letter'}
                </div>
                <div className={passwordChecks.lowercase ? 'text-green-600' : 'text-gray-500'}>
                  {passwordChecks.lowercase ? '✓' : '•'}{' '}
                  {isRo ? 'o literă mică' : 'one lowercase letter'}
                </div>
                <div className={passwordChecks.number ? 'text-green-600' : 'text-gray-500'}>
                  {passwordChecks.number ? '✓' : '•'} {isRo ? 'o cifră' : 'one number'}
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {isRo ? 'Confirmă parola' : 'Confirm password'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">
                    <Lock size={16} />
                  </span>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-gray-500"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isPasswordValid || !passwordsMatch}
                className="w-full flex justify-center py-2.5 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? isRo
                    ? 'Se resetează...'
                    : 'Resetting...'
                  : isRo
                    ? 'Resetează parola'
                    : 'Reset password'}
              </button>
            </form>

            <Link
              to="/b2b-store/login"
              className="mt-6 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft size={16} />
              {isRo ? 'Înapoi la Login B2B' : 'Back to B2B Login'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default B2BResetPasswordPage;
