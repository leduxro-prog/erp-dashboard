import { useState } from 'react';
import { Shield, Copy, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { authService } from '../services/auth.service';

interface TwoFactorSetupProps {
  onSuccess: (backupCodes: string[]) => void;
  onCancel: () => void;
}

export function TwoFactorSetup({ onSuccess, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'intro' | 'qr' | 'verify' | 'success'>('intro');
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(
    null,
  );
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSetup = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await authService.setup2FA();
      setSetupData({
        secret: data.secret,
        qrCodeDataUrl: data.qrCodeDataUrl,
      });
      setStep('qr');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!setupData || !token) return;

    try {
      setLoading(true);
      setError(null);

      const data = await authService.verifySetup2FA(token, setupData.secret);
      setBackupCodes(data.backupCodes);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
  };

  return (
    <div className="bg-surface-primary border border-border-primary rounded-xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-border-primary flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-600">
          <Shield size={24} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Two-Factor Authentication</h3>
          <p className="text-sm text-text-secondary">
            Add an extra layer of security to your account
          </p>
        </div>
      </div>

      <div className="p-6">
        {step === 'intro' && (
          <div className="space-y-6">
            <p className="text-text-secondary leading-relaxed">
              Two-factor authentication (2FA) protects your account by requiring more than just a
              password. You'll need a mobile app like Google Authenticator or Microsoft
              Authenticator to generate a one-time code.
            </p>
            <div className="flex gap-3">
              <button onClick={startSetup} disabled={loading} className="btn-primary flex-1 py-2.5">
                {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Setup 2FA Now'}
              </button>
              <button onClick={onCancel} className="btn-secondary flex-1 py-2.5">
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === 'qr' && setupData && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <p className="font-medium text-text-primary">1. Scan this QR Code</p>
              <p className="text-sm text-text-secondary">
                Open your authenticator app and scan the code below
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-border-primary w-fit mx-auto shadow-sm">
              <img src={setupData.qrCodeDataUrl} alt="2FA QR Code" className="w-48 h-48" />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-text-tertiary">Can't scan? Use this secret key instead:</p>
              <code className="bg-surface-secondary px-3 py-1.5 rounded text-primary-600 font-mono text-sm block border border-border-primary">
                {setupData.secret}
              </code>
            </div>

            <button onClick={() => setStep('verify')} className="btn-primary w-full py-2.5">
              I've scanned it, continue
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <p className="font-medium text-text-primary">2. Verify Token</p>
              <p className="text-sm text-text-secondary">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div className="max-w-xs mx-auto">
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 bg-surface-secondary border border-border-primary rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm border border-red-100">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('qr')} className="btn-secondary flex-1 py-2.5">
                Back
              </button>
              <button
                onClick={verifyAndEnable}
                disabled={token.length !== 6 || loading}
                className="btn-primary flex-1 py-2.5"
              >
                {loading ? (
                  <Loader2 className="animate-spin mx-auto" size={20} />
                ) : (
                  'Verify & Enable'
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-600 mx-auto mb-2">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-xl font-bold text-text-primary">2FA Enabled Successfully!</h4>
              <p className="text-text-secondary">
                Save these backup codes in a safe place. You'll need them if you lose access to your
                authenticator app.
              </p>
            </div>

            <div className="bg-surface-secondary border border-border-primary rounded-xl p-4 font-mono text-sm grid grid-cols-2 gap-2 relative">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="text-text-primary">
                  {code}
                </div>
              ))}
              <button
                onClick={copyBackupCodes}
                className="absolute top-2 right-2 p-1.5 hover:bg-surface-primary rounded-lg text-text-tertiary"
                title="Copy all"
              >
                <Copy size={16} />
              </button>
            </div>

            <button onClick={() => onSuccess(backupCodes)} className="btn-primary w-full py-2.5">
              I've saved the codes, finish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
