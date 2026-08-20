'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Mail,
  Send,
  Copy,
  Ban,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useOrgStore } from '@/store/org-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

const sendInviteSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['ORG_ADMIN', 'ORG_MEMBER'], 'Role is required'),
});

type SendInviteForm = z.infer<typeof sendInviteSchema>;

const statusBadgeColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ACCEPTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REVOKED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  EXPIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REVOKED: 'Revoked',
  EXPIRED: 'Expired',
};

export default function InvitationsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const { currentOrg, invitations, isLoading, selectOrg, loadInvitations, sendInvitation, revokeInvitation } =
    useOrgStore();
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);

  const form = useForm<SendInviteForm>({
    resolver: zodResolver(sendInviteSchema),
    defaultValues: { email: '', role: 'ORG_MEMBER' },
  });

  useEffect(() => {
    if (orgId) {
      selectOrg(orgId);
      loadInvitations();
    }
  }, [orgId, selectOrg, loadInvitations]);

  const handleSend = async (data: SendInviteForm) => {
    try {
      const result = await sendInvitation(data.email, data.role);
      setInvitationLink(result.invitation_link);
      toast.success('Invitation sent');
      form.reset();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send invitation'));
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!window.confirm('Revoke this invitation?')) return;
    try {
      await revokeInvitation(invitationId);
      toast.success('Invitation revoked');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to revoke invitation'));
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied');
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const isExpiringSoon = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 1000 * 60 * 60 * 24 * 2;
  };

  if (isLoading || !currentOrg) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invitations</h1>
          <p className="text-muted-foreground text-sm">
            Manage invitations for {currentOrg.name}
          </p>
        </div>
        <Button onClick={() => { setShowSendDialog(true); setInvitationLink(null); }}>
          <Send className="h-4 w-4 mr-2" />
          Send Invitation
        </Button>
      </div>

      {invitationLink && (
        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-sm break-all font-mono">{invitationLink}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopyLink(invitationLink)}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Email</th>
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Role</th>
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Invited By</th>
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Expires</th>
                  <th className="h-10 px-4 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
                      No invitations yet.
                    </td>
                  </tr>
                ) : (
                  invitations.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 text-sm font-medium">{inv.invited_email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize">
                          {inv.role.replace('ORG_', '').toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusBadgeColors[inv.status]}>
                          {statusLabels[inv.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {inv.inviter.first_name} {inv.inviter.last_name}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          {isExpiringSoon(inv.expires_at) && (
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                          )}
                          <span className={isExpiringSoon(inv.expires_at) ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}>
                            {formatDate(inv.expires_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.status === 'PENDING' && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleCopyLink(`${window.location.origin}/register?invitation_token=${inv.id}`)}
                              title="Copy invitation link"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleRevoke(inv.id)}
                              title="Revoke invitation"
                            >
                              <Ban className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showSendDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowSendDialog(false)} />
          <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Send Invitation</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowSendDialog(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSend)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="member@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none md:text-sm"
                          {...field}
                        >
                          <option value="ORG_MEMBER">Member</option>
                          <option value="ORG_ADMIN">Admin</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowSendDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Send Invitation
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
