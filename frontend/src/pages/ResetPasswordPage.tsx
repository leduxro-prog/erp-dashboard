import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/auth.service';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordChecks = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    };
  }, [password]);

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
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet the requirements.');
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          <div className="card backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl">
            <div className="text-center mb-8">
              <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
                CYPHER
              </div>
              <p className="text-white/60 text-sm">Enterprise Resource Planning</p>
            </div>
            <div className="text-center py-6">
              <p className="text-red-300 text-sm mb-6">
                Invalid or missing reset token. Please request a new password reset.
              </p>
              <Link
                to="/forgot-password"
                className="inline-block py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg"
              >
                Request New Reset
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

          {success ? (
            // Success state
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h3 className="text-white text-lg font-semibold mb-2">Password Reset Successful</h3>
              <p className="text-white/60 text-sm mb-6">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <Link
                to="/login"
                className="block w-full py-3 px-4 text-center bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg transition duration-200"
              >
                Sign In
              </Link>
            </div>
          ) : (
            // Form state
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Lock size={28} className="text-blue-400" />
                </div>
                <h3 className="text-white text-lg font-semibold mb-1">Reset your password</h3>
                <p className="text-white/60 text-sm">Enter your new password below.</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-white/80 mb-2"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      autoComplete="new-password"
                      className="input w-full bg-white/5 border border-white/20 text-white placeholder-white/40 focus:bg-white/10 focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-white/60 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                {password.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    <div className={passwordChecks.length ? 'text-green-400' : 'text-white/40'}>
                      {passwordChecks.length ? 'v' : 'o'} At least 8 characters
                    </div>
                    <div className={passwordChecks.uppercase ? 'text-green-400' : 'text-white/40'}>
                      {passwordChecks.uppercase ? 'v' : 'o'} One uppercase letter
                    </div>
                    <div className={passwordChecks.lowercase ? 'text-green-400' : 'text-white/40'}>
                      {passwordChecks.lowercase ? 'v' : 'o'} One lowercase letter
                    </div>
                    <div className={passwordChecks.number ? 'text-green-400' : 'text-white/40'}>
                      {passwordChecks.number ? 'v' : 'o'} One number
                    </div>
                  </div>
                )}

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-white/80 mb-2"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className={`input w-full bg-white/5 border text-white placeholder-white/40 focus:bg-white/10 ${
                        confirmPassword.length > 0
                          ? passwordsMatch
                            ? 'border-green-500/50 focus:border-green-400'
                            : 'border-red-500/50 focus:border-red-400'
                          : 'border-white/20 focus:border-blue-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-3 text-white/60 hover:text-white"
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="mt-1.5 text-xs text-red-400">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !isPasswordValid || !passwordsMatch}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg transition duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 mt-6 text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                <ArrowLeft size={16} />
                Back to Sign In
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

export { ResetPasswordPage };
export default ResetPasswordPage;
