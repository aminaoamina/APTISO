'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { invitationsApi, InvitationValidation } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Building2, Mail, Shield, CheckCircle, XCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { AnimatedBackground } from '@/components/animated-background';

function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    ORG_OWNER: 'Owner',
    ORG_ADMIN: 'Admin',
    ORG_MEMBER: 'Member',
    PROJECT_LEAD: 'Project Lead',
    PROJECT_AUDITOR: 'Auditor',
    PROJECT_MEMBER: 'Member',
  };
  return roleMap[role] || role;
}

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, isAuthenticated, loadUser } = useAuthStore();
  const [invitation, setInvitation] = useState<InvitationValidation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setIsLoading(false);
      return;
    }

    invitationsApi
      .validate(token)
      .then((data) => {
        setInvitation(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Invalid or expired invitation');
        setIsLoading(false);
      });
  }, [token]);

  useEffect(() => {
    loadUser().catch(() => {});
  }, [loadUser]);

  const handleAccept = async () => {
    if (!token) return;
    setIsAccepting(true);
    try {
      await invitationsApi.accept(token);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to accept invitation';
      setError(message);
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <AnimatedBackground>
        <Spinner className="h-8 w-8" />
      </AnimatedBackground>
    );
  }

  if (error || !invitation) {
    return (
      <AnimatedBackground>
        <Card className="w-full max-w-md relative z-10 shadow-lg">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error || 'This invitation link is invalid or has expired.'}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => router.push('/')}>
              Go Home
            </Button>
          </CardFooter>
        </Card>
      </AnimatedBackground>
    );
  }

  return (
    <AnimatedBackground>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-lg">
        <CardHeader className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
          <CardTitle>You&apos;ve Been Invited</CardTitle>
          <CardDescription>Join an organization on APTISO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Organization:</span>
              <span className="font-medium">{invitation.organization.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Role:</span>
              <Badge variant="secondary">{formatRole(invitation.role)}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{invitation.email}</span>
            </div>
          </div>

          {isAuthenticated && user && user.email === invitation.email ? (
            <Button className="w-full" onClick={handleAccept} disabled={isAccepting}>
              {isAccepting ? <Spinner className="mr-2 h-4 w-4" /> : null}
              Accept Invitation
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => router.push('/register')}
              >
                Create Account
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Create your account first, then return to this invitation link to accept it. Already have an account?{' '}
                <button
                  onClick={() => router.push('/login')}
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Log In
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AnimatedBackground>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <AnimatedBackground>
          <Spinner className="h-8 w-8" />
        </AnimatedBackground>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
