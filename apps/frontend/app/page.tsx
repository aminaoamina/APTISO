'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { LogOut, Loader2 } from 'lucide-react';
import { Logo } from '@/components/logo';
import { AnimatedBackground } from '@/components/animated-background';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth-store';

export default function HomePage() {
  const { user, isAuthenticated, isLoading, loadUser, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => {
        // Not authenticated - stays on landing view
      });
    }
  }, [isAuthenticated, loadUser]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <AnimatedBackground>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-2xl shadow-2xl relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo variant="vertical" className="h-28 w-auto" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">APTISO</CardTitle>
            <CardDescription className="text-lg mt-2">
              AI-powered ISO 27001 compliance platform
            </CardDescription>
            <div
              className="mx-auto mt-4 h-1 w-16 rounded-full"
              style={{ background: 'var(--brand-orange)' }}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-8">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {isAuthenticated && user && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border p-4 bg-card">
                <div>
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="font-semibold text-lg">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="default">Authenticated</Badge>
                  {user.is_email_verified ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Email Verified
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Email Unverified</Badge>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                <p className="text-sm">
                  The full dashboard (compliance projects, gap analysis, and risk management)
                  ships in Sprint 2. Stay tuned!
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          )}

          {!isLoading && !isAuthenticated && (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">
                Your secure path to ISO 27001 certification. Sign in to continue.
              </p>
              <div className="flex gap-4">
                <Button asChild className="flex-1 h-11">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 h-11">
                  <Link href="/register">Create Account</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AnimatedBackground>
  );
}
