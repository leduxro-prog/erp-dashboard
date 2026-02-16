import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useGlobalLanguage } from '../../hooks/useLanguage';
import { b2bApi } from '../../services/b2b-api';

export const B2BForgotPasswordPage: React.FC = () => {
  const { language } = useGlobalLanguage();
  const isRo = language === 'ro';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await b2bApi.forgotPassword(email);

      if (response.success === false || response.emailRegistered === false) {
        setError(
          response.message ||
            (isRo
              ? 'Adresa de email nu este înregistrată în sistem.'
              : 'This email address is not registered in the system.'),
        );
        return;
      }

      setSubmitted(true);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cypher B2B Portal</h1>
          <p className="text-gray-600 mt-2">
            {isRo ? 'Recuperare parolă cont B2B' : 'B2B password recovery'}
          </p>
        </div>

        {submitted ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isRo ? 'Verifică email-ul' : 'Check your email'}
            </h3>
            <p className="text-sm text-gray-600 mb-5">
              {isRo ? (
                <>
                  Dacă există un cont pentru <span className="font-medium">{email}</span>, am trimis
                  link-ul de resetare. Link-ul expiră în 1 oră.
                </>
              ) : (
                <>
                  If an account exists for <span className="font-medium">{email}</span>, a reset
                  link was sent. The link expires in 1 hour.
                </>
              )}
            </p>
            <Link
              to="/b2b-store/login"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              {isRo ? 'Înapoi la Login B2B' : 'Back to B2B Login'}
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-5">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">
                    <Mail size={16} />
                  </span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@companie.ro"
                    required
                    autoComplete="email"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex justify-center py-2.5 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? isRo
                    ? 'Se trimite...'
                    : 'Sending...'
                  : isRo
                    ? 'Trimite link de resetare'
                    : 'Send reset link'}
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

export default B2BForgotPasswordPage;
