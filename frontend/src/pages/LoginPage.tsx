import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Shield, KeyRound } from 'lucide-react';
import { authService } from '../services/auth.service';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState('');
  const [twofaToken, setTwofaToken] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (requires2FA) {
        // 2FA verification step
        await authService.verify2FA({
          token: twofaToken,
          preAuthToken,
          isBackupCode: useBackupCode,
        });
        navigate('/dashboard');
      } else {
        // Initial login step
        const response = await authService.login({ email, password });
        if (response.requires2FA) {
          setRequires2FA(true);
          setPreAuthToken(response.preAuthToken || '');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRequires2FA(false);
    setPreAuthToken('');
    setTwofaToken('');
    setUseBackupCode(false);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-40 h-40 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="card backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
              CYPHER
            </div>
            <p className="text-white/60 text-sm">Enterprise Resource Planning</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!requires2FA ? (
              <>
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@ledux.ro"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="input w-full bg-white/5 border border-white/20 text-white placeholder-white/40 focus:bg-white/10 focus:border-blue-400"
                  />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-white/80 mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
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

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5"
                    />
                    <span className="text-white/60">Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300">
                    Forgot password?
                  </Link>
                </div>
              </>
            ) : (
              /* 2FA Token Input */
              <div className="space-y-4 py-4">
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Shield size={28} className="text-blue-400" />
                  </div>
                  <h3 className="text-white text-lg font-semibold mb-1">
                    Two-Factor Authentication
                  </h3>
                  <p className="text-white/60 text-sm">
                    {useBackupCode
                      ? 'Enter one of your backup codes'
                      : 'Enter the 6-digit code from your authenticator app'}
                  </p>
                </div>

                {useBackupCode ? (
                  <input
                    id="2fa-backup"
                    type="text"
                    placeholder="ABCD1234"
                    maxLength={8}
                    value={twofaToken}
                    onChange={(e) =>
                      setTwofaToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                    required
                    autoFocus
                    className="w-full text-center text-2xl tracking-[0.3em] font-mono py-4 bg-white/5 border border-white/20 text-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                ) : (
                  <input
                    id="2fa-token"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={twofaToken}
                    onChange={(e) => setTwofaToken(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                    autoFocus
                    className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 bg-white/5 border border-white/20 text-white rounded-xl focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                )}

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Back to login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseBackupCode(!useBackupCode);
                      setTwofaToken('');
                      setError('');
                    }}
                    className="text-white/50 hover:text-white/80 text-sm flex items-center gap-1.5"
                  >
                    <KeyRound size={14} />
                    {useBackupCode ? 'Use authenticator' : 'Use backup code'}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                loading ||
                (requires2FA && !useBackupCode && twofaToken.length !== 6) ||
                (requires2FA && useBackupCode && twofaToken.length < 6)
              }
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg transition duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Verifying...' : requires2FA ? 'Verify Code' : 'Sign In'}
            </button>
          </form>

          {/* Divider - only show on initial login */}
          {!requires2FA && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white/10 text-white/60">Or continue with</span>
                </div>
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="py-2 px-3 bg-white/5 border border-white/20 rounded-lg text-white/60 hover:text-white hover:border-white/40 transition text-sm font-medium"
                >
                  Google
                </button>
                <button
                  type="button"
                  className="py-2 px-3 bg-white/5 border border-white/20 rounded-lg text-white/60 hover:text-white hover:border-white/40 transition text-sm font-medium"
                >
                  Microsoft
                </button>
              </div>

              {/* Sign Up Link */}
              <p className="text-center text-white/60 text-sm mt-6">
                Don't have an account?{' '}
                <a href="#" className="text-blue-400 hover:text-blue-300 font-medium">
                  Sign up here
                </a>
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-white/40 text-xs">
          <p>Powered by Ledux.ro</p>
          <div className="flex justify-center gap-4 mt-3">
            <a href="#" className="hover:text-white/60">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white/60">
              Terms of Service
            </a>
            <a href="#" className="hover:text-white/60">
              Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export { LoginPage };
export default LoginPage;
