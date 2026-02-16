import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate login
    setTimeout(() => {
      if (email === 'andrei@cypher.ro' && password === 'password') {
        console.log('Login successful');
      } else {
        setError('Email sau parola invalida');
      }
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-block">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl font-bold text-white">⚡</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">CYPHER ERP</h1>
            <p className="text-gray-500 mt-1">Enterprise Resource Planning</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="bg-white border-0 shadow-lg">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Alert */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <Input
                  type="email"
                  placeholder="andrei@cypher.ro"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  required
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Parola</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                  required
                />
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span className="text-sm text-gray-700">Tine-ma conectat</span>
                </label>
                <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  Ai uitat parola?
                </a>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {isLoading ? 'Se incarca...' : 'Autentificare'}
              </Button>

              {/* 2FA Ready */}
              <p className="text-xs text-gray-500 text-center">
                ✓ Autentificare 2FA disponibila
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>© 2024 CYPHER LED Systems. Toate drepturile rezervate.</p>
        </div>

        {/* Demo Credentials */}
        <Card className="bg-blue-50 border border-blue-200 mt-6">
          <CardContent className="p-4 text-center text-sm">
            <p className="font-medium text-blue-900 mb-2">Conturi Demo:</p>
            <p className="text-blue-800">Email: <code className="font-mono">andrei@cypher.ro</code></p>
            <p className="text-blue-800">Parola: <code className="font-mono">password</code></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
