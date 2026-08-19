'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/theme-toggle';
import { AnimatedBackground } from '@/components/animated-background';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isVerifying, setIsVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid verification link. No token provided.');
      setIsVerifying(false);
      return;
    }

    const verifyEmail = async () => {
      try {
        setIsVerifying(true);
        setError('');

        await authApi.verifyEmail(token!);
        setSuccess(true);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login?verified=true');
        }, 3000);
      } catch (err) {
        const errorMessage = getErrorMessage(
          err,
          'Email verification failed. The link may be invalid or expired.',
        );
        setError(errorMessage);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [token, router]);

  if (isVerifying) {
    return (
      <AnimatedBackground>
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md shadow-lg relative z-10">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Verifying your email...</p>
          </CardContent>
        </Card>
      </AnimatedBackground>
    );
  }

  if (success) {
    return (
      <AnimatedBackground>
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl">Email Verified!</CardTitle>
            <CardDescription className="text-center">
              Your email has been successfully verified
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <Mail className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600 dark:text-green-400">
                You can now log in to your account and access all features.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button asChild className="w-full">
              <Link href="/login">Continue to Login</Link>
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Redirecting in 3 seconds...
            </p>
          </CardFooter>
        </Card>
      </AnimatedBackground>
    );
  }

  return (
    <AnimatedBackground>
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
              <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">Verification Failed</CardTitle>
          <CardDescription className="text-center">
            We couldn&apos;t verify your email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button asChild variant="outline" className="w-full">
            <Link href="/register">Create New Account</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Back to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </AnimatedBackground>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
