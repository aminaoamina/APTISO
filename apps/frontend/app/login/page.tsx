'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, LogIn, Loader2, Mail } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/theme-toggle';
import { AnimatedBackground } from '@/components/animated-background';
import { useAuthStore } from '@/store/auth-store';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const isUnverifiedError =
    error.toLowerCase().includes('not verified') ||
    error.toLowerCase().includes('verify your email') ||
    error.toLowerCase().includes('account is not activated');

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Account created! Please check your email to verify your address before logging in.');
    } else if (searchParams.get('verified') === 'true') {
      setSuccessMessage('Email verified successfully! You can now log in.');
    }

    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        router.replace('/login', undefined);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router, successMessage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(formData.email.trim(), formData.password);

      // Small delay to ensure store is updated before redirect
      await new Promise((resolve) => setTimeout(resolve, 100));

      router.push('/dashboard');
    } catch (err) {
      const errorMessage = getErrorMessage(
        err,
        'Unable to sign in. Please check your credentials and try again.',
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!formData.email.trim()) {
      setResendMessage('Enter your email address to resend the verification link.');
      return;
    }
    setIsResending(true);
    setResendMessage('');
    try {
      const res = await authApi.resendVerificationCode(formData.email.trim());
      setResendMessage(res.message);
    } catch {
      setResendMessage('Unable to resend the verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AnimatedBackground>
      <div className="absolute top-4 right-4 animate-in fade-in slide-in-from-top-2 duration-500 z-10 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 relative z-10">
        <CardHeader className="space-y-3">
          <div className="flex justify-center">
            <Logo variant="icon" className="h-12 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold text-center animate-in fade-in slide-in-from-top-2 duration-500 delay-400">
            Welcome back to APTISO
          </CardTitle>
          <CardDescription className="text-center animate-in fade-in slide-in-from-top-2 duration-500 delay-500">
            Sign in to manage your ISO 27001 compliance program
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {successMessage && (
              <Alert className="animate-in fade-in slide-in-from-top-2 duration-300 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isUnverifiedError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300 dark:border-amber-800 dark:bg-amber-950">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Your email hasn&apos;t been verified yet.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Check your inbox for the verification link, or resend it now.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
                      onClick={handleResendVerification}
                      disabled={isResending || isLoading}
                    >
                      {isResending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Resend verification email
                        </>
                      )}
                    </Button>
                    {resendMessage && (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                        {resendMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-500 delay-600">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoComplete="email"
                className="transition-all duration-200 focus:scale-[1.02] focus:shadow-md"
              />
            </div>

            <div className="space-y-2 animate-in fade-in slide-in-from-right-2 duration-500 delay-700">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline transition-colors duration-200 hover:scale-105"
                  tabIndex={-1}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="pr-10 transition-all duration-200 focus:scale-[1.02] focus:shadow-md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 px-6 pt-6 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-800">
            <Button
              type="submit"
              className="w-full h-11 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 delay-900">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-primary font-medium hover:underline transition-colors duration-200 hover:scale-105">
                Create one
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </AnimatedBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
