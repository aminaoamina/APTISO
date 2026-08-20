'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, MoreHorizontal, Shield, Trash2, X, Loader2 } from 'lucide-react';
import { useOrgStore } from '@/store/org-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
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

const inviteSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['ORG_ADMIN', 'ORG_MEMBER'], 'Role is required'),
});

type InviteForm = z.infer<typeof inviteSchema>;

const roleBadgeColors: Record<string, string> = {
  ORG_OWNER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  ORG_ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ORG_MEMBER: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
};

const roleLabels: Record<string, string> = {
  ORG_OWNER: 'Owner',
  ORG_ADMIN: 'Admin',
  ORG_MEMBER: 'Member',
};

export default function MembersPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const { currentOrg, members, isLoading, selectOrg, addMember, removeMember, updateMemberRole } = useOrgStore();
  const user = useAuthStore((s) => s.user);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const isOwnerOrAdmin =
    currentOrg?.members?.some(
      (m) =>
        m.user_id === user?.id &&
        (m.role === 'ORG_OWNER' || m.role === 'ORG_ADMIN'),
    ) ?? false;

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'ORG_MEMBER' },
  });

  useEffect(() => {
    if (orgId) selectOrg(orgId);
  }, [orgId, selectOrg]);

  const handleInvite = async (data: InviteForm) => {
    try {
      await addMember(data.email, data.role);
      toast.success('Member added successfully');
      setShowInviteDialog(false);
      form.reset();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add member'));
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!window.confirm('Remove this member from the organization?')) return;
    try {
      await removeMember(memberId);
      toast.success('Member removed');
      setActionMenuId(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove member'));
    }
  };

  const handleChangeRole = async (memberId: string, role: string) => {
    try {
      await updateMemberRole(memberId, role);
      toast.success('Role updated');
      setActionMenuId(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update role'));
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

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
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground text-sm">
            Manage members of {currentOrg.name}
          </p>
        </div>
        {isOwnerOrAdmin && (
          <Button onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Name</th>
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Email</th>
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Role</th>
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Joined</th>
                  {isOwnerOrAdmin && (
                    <th className="h-10 px-4 text-right text-xs font-medium text-muted-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                      No members yet.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => {
                    const isCurrentUser = member.user_id === user?.id;
                    const isMemberOwner = member.role === 'ORG_OWNER';
                    const canManage = isOwnerOrAdmin && !isMemberOwner;

                    return (
                      <tr key={member.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                              {member.user.first_name?.[0]}
                              {member.user.last_name?.[0]}
                            </div>
                            <span className="text-sm font-medium">
                              {member.user.first_name} {member.user.last_name}
                              {isCurrentUser && (
                                <span className="text-muted-foreground ml-1">(you)</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {member.user.email}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={roleBadgeColors[member.role]}>
                            {roleLabels[member.role]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(member.created_at)}
                        </td>
                        {isOwnerOrAdmin && (
                          <td className="px-4 py-3 text-right">
                            {canManage && (
                              <div className="relative inline-block">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() =>
                                    setActionMenuId(
                                      actionMenuId === member.id ? null : member.id,
                                    )
                                  }
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                {actionMenuId === member.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => setActionMenuId(null)}
                                    />
                                    <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
                                      <button
                                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                        onClick={() =>
                                          handleChangeRole(
                                            member.id,
                                            member.role === 'ORG_ADMIN'
                                              ? 'ORG_MEMBER'
                                              : 'ORG_ADMIN',
                                          )
                                        }
                                      >
                                        <Shield className="h-3.5 w-3.5" />
                                        {member.role === 'ORG_ADMIN'
                                          ? 'Make Member'
                                          : 'Make Admin'}
                                      </button>
                                      <button
                                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                                        onClick={() => handleRemove(member.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Remove
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showInviteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowInviteDialog(false)} />
          <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Invite Member</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowInviteDialog(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleInvite)} className="space-y-4">
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
                  <Button type="button" variant="outline" onClick={() => setShowInviteDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Add Member
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
