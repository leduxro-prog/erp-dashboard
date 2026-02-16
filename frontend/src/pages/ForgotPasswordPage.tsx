import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useGlobalLanguage } from '../hooks/useLanguage';
import { authService } from '../services/auth.service';

const ForgotPasswordPage: React.FC = () => {
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
      const response = await authService.forgotPassword(email);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-40 h-40 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="card backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
              CYPHER
            </div>
            <p className="text-white/60 text-sm">Enterprise Resource Planning</p>
          </div>

          {submitted ? (
            // Success state
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h3 className="text-white text-lg font-semibold mb-2">Check your email</h3>
              <p className="text-white/60 text-sm mb-6">
                {isRo ? (
                  <>
                    Am trimis link-ul de resetare pe{' '}
                    <span className="text-white/80 font-medium">{email}</span>. Link-ul expiră în 1
                    oră.
                  </>
                ) : (
                  <>
                    We&apos;ve sent a password reset link to{' '}
                    <span className="text-white/80 font-medium">{email}</span>. The link expires in
                    1 hour.
                  </>
                )}
              </p>
              <p className="text-white/40 text-xs mb-6">
                {isRo
                  ? 'Nu ai primit email-ul? Verifică folderul spam sau încearcă din nou.'
                  : "Didn't receive an email? Check your spam folder or try again."}
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                  }}
                  className="w-full py-3 px-4 bg-white/10 border border-white/20 text-white font-semibold rounded-lg transition duration-200 hover:bg-white/20"
                >
                  {isRo ? 'Încearcă alt email' : 'Try another email'}
                </button>
                <Link
                  to="/login"
                  className="block w-full py-3 px-4 text-center text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  {isRo ? 'Înapoi la autentificare' : 'Back to Sign In'}
                </Link>
              </div>
            </div>
          ) : (
            // Form state
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Mail size={28} className="text-blue-400" />
                </div>
                <h3 className="text-white text-lg font-semibold mb-1">Forgot your password?</h3>
                <p className="text-white/60 text-sm">
                  {isRo
                    ? 'Introdu adresa de email și îți trimitem un link pentru resetarea parolei.'
                    : "Enter your email address and we'll send you a link to reset your password."}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
                    {isRo ? 'Adresă email' : 'Email Address'}
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@ledux.ro"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    className="input w-full bg-white/5 border border-white/20 text-white placeholder-white/40 focus:bg-white/10 focus:border-blue-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg transition duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading
                    ? isRo
                      ? 'Se trimite...'
                      : 'Sending...'
                    : isRo
                      ? 'Trimite link de resetare'
                      : 'Send Reset Link'}
                </button>
              </form>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 mt-6 text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                <ArrowLeft size={16} />
                {isRo ? 'Înapoi la autentificare' : 'Back to Sign In'}
              </Link>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-white/40 text-xs">
          <p>Powered by Ledux.ro</p>
        </div>
      </div>
    </div>
  );
};

export { ForgotPasswordPage };
export default ForgotPasswordPage;
