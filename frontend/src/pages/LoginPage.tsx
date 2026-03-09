import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Shield, KeyRound } from 'lucide-react';
import { authService } from '../services/auth.service';
import { resolveGoogleLoginClientId } from './loginPage.google-config';

type GoogleAuthModule = typeof import('@react-oauth/google');

async function trackSuccessfulLogin(method: 'email' | 'google' | '2fa' | 'backup_code') {
  const { trackLogin } = await import('../services/retargeting');

  trackLogin({ method, user_type: 'erp_user', source: 'erp' });
}

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleConfigLoaded, setGoogleConfigLoaded] = useState(false);
  const [googleAuthModule, setGoogleAuthModule] = useState<GoogleAuthModule | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadGoogleConfig = async () => {
      try {
        const clientId = await resolveGoogleLoginClientId(() => authService.getGoogleAuthConfig());
        if (!mounted) {
          return;
        }

        setGoogleClientId(clientId);
      } catch {
        if (!mounted) {
          return;
        }

        setGoogleClientId('');
      } finally {
        if (mounted) {
          setGoogleConfigLoaded(true);
        }
      }
    };

    void loadGoogleConfig();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!googleConfigLoaded || !googleClientId || googleClientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      return;
    }

    let isActive = true;

    import('@react-oauth/google').then((module) => {
      if (isActive) {
        setGoogleAuthModule(module);
      }
    });

    return () => {
      isActive = false;
    };
  }, [googleClientId, googleConfigLoaded]);

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
        }, rememberMe);
        await trackSuccessfulLogin(useBackupCode ? 'backup_code' : '2fa');
        navigate('/dashboard');
      } else {
        // Initial login step
        const response = await authService.login({ email, password }, rememberMe);
        if (response.requires2FA) {
          setRequires2FA(true);
          setPreAuthToken(response.preAuthToken || '');
        } else {
          await trackSuccessfulLogin('email');
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

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      setError('Google authentication failed - no credential received.');
      return;
    }
    setError('');
    setGoogleLoading(true);
    try {
      await authService.loginWithGoogle(credentialResponse.credential, rememberMe);
      await trackSuccessfulLogin('google');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google login failed. Your account may not be authorized.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError(
      'Google Sign-In a esuat. Verifica daca folosesti domeniul oficial ERP si ca browserul permite popup/cookies.',
    );
  };

  const GoogleOAuthProvider = googleAuthModule?.GoogleOAuthProvider;
  const GoogleLogin = googleAuthModule?.GoogleLogin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-40 h-40 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="card backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="text-5xl font-bold bg-gradient-to-r from-primary-400 to-primary-500 bg-clip-text text-transparent mb-2">
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
                    className="input w-full bg-white/5 border border-white/20 text-white placeholder-white/40 focus:bg-white/10 focus:border-primary-400"
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
                      className="input w-full bg-white/5 border border-white/20 text-white placeholder-white/40 focus:bg-white/10 focus:border-primary-400"
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
                  <Link to="/forgot-password" className="text-primary-400 hover:text-primary-300">
                    Forgot password?
                  </Link>
                </div>
              </>
            ) : (
              /* 2FA Token Input */
              <div className="space-y-4 py-4">
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary-500/20 flex items-center justify-center">
                    <Shield size={28} className="text-primary-400" />
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
                    className="w-full text-center text-2xl tracking-[0.3em] font-mono py-4 bg-white/5 border border-white/20 text-white rounded-xl focus:ring-2 focus:ring-primary-400 outline-none"
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
                    className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 bg-white/5 border border-white/20 text-white rounded-xl focus:ring-2 focus:ring-primary-400 outline-none"
                  />
                )}

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-primary-400 hover:text-primary-300 text-sm"
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
                (requires2FA && useBackupCode && twofaToken.length !== 8)
              }
              className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg transition duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
              <div className="flex flex-col items-center gap-3">
                {googleLoading ? (
                  <div className="py-2 text-white/60 text-sm">Connecting with Google...</div>
                ) : !googleConfigLoaded ? (
                  <div className="py-2 text-white/60 text-sm">Loading Google Sign-In...</div>
                ) : googleClientId &&
                  googleClientId !== 'YOUR_GOOGLE_CLIENT_ID_HERE' &&
                  !googleAuthModule ? (
                  <div className="py-2 text-white/60 text-sm">Loading Google Sign-In...</div>
                ) :
                  googleClientId &&
                  googleClientId !== 'YOUR_GOOGLE_CLIENT_ID_HERE' &&
                  GoogleOAuthProvider &&
                  GoogleLogin ? (
                  <GoogleOAuthProvider clientId={googleClientId}>
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      theme="filled_black"
                      size="large"
                      width="350"
                      text="signin_with"
                      shape="rectangular"
                    />
                  </GoogleOAuthProvider>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-white/30 cursor-not-allowed text-sm font-medium"
                  >
                    Google (not configured - check backend config)
                  </button>
                )}
              </div>

              {/* Sign Up Link */}
              <p className="text-center text-white/60 text-sm mt-6">
                Don't have an account?{' '}
                <Link to="/b2b-store/register" className="text-primary-400 hover:text-primary-300 font-medium">
                  Sign up here
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-white/40 text-xs">
          <p>Powered by Ledux.ro</p>
          <div className="flex justify-center gap-4 mt-3">
            <Link to="/b2b-store/privacy" className="hover:text-white/60">
              Privacy Policy
            </Link>
            <Link to="/b2b-store/terms" className="hover:text-white/60">
              Terms of Service
            </Link>
            <a href="/api-docs" target="_blank" rel="noreferrer" className="hover:text-white/60">
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
