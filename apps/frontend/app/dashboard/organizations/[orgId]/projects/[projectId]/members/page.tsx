'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  UserPlus,
  Shield,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
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

const ISO_ROLES = [
  'Top Management',
  'Information Security Manager',
  'Asset Owner',
  'Department Head',
  'IT Administrator',
  'Internal Auditor',
  'Employee',
] as const;

const addMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  privilege: z.enum(['PROJECT_LEAD', 'PROJECT_AUDITOR', 'PROJECT_MEMBER'], 'Privilege is required'),
  custom_role: z.string().optional(),
});

type AddMemberForm = z.infer<typeof addMemberSchema>;

const privilegeBadgeColors: Record<string, string> = {
  PROJECT_LEAD: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  PROJECT_AUDITOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PROJECT_MEMBER: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
};

const privilegeLabels: Record<string, string> = {
  PROJECT_LEAD: 'Lead',
  PROJECT_AUDITOR: 'Auditor',
  PROJECT_MEMBER: 'Member',
};

export default function ProjectMembersPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { currentProject, members, isLoading, selectProject, addMember, removeMember, assignIsoRoles } =
    useProjectStore();
  const user = useAuthStore((s) => s.user);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isoRolesMemberId, setIsoRolesMemberId] = useState<string | null>(null);
  const [selectedIsoRoles, setSelectedIsoRoles] = useState<string[]>([]);
  const [isSavingRoles, setIsSavingRoles] = useState(false);

  const isLead =
    currentProject?.members?.some(
      (m) => m.user_id === user?.id && m.privilege === 'PROJECT_LEAD',
    ) ?? false;

  const form = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: '', privilege: 'PROJECT_MEMBER', custom_role: '' },
  });

  useEffect(() => {
    if (projectId) selectProject(projectId);
  }, [projectId, selectProject]);

  const handleAddMember = async (data: AddMemberForm) => {
    try {
      await addMember(data.email, data.privilege, data.custom_role || undefined);
      toast.success('Member added');
      setShowAddDialog(false);
      form.reset();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add member'));
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!window.confirm('Remove this member from the project?')) return;
    try {
      await removeMember(memberId);
      toast.success('Member removed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove member'));
    }
  };

  const openIsoRoles = (memberId: string, currentRoles: { iso_role: string }[]) => {
    setIsoRolesMemberId(memberId);
    setSelectedIsoRoles(currentRoles.map((r) => r.iso_role));
  };

  const handleSaveIsoRoles = async () => {
    if (!isoRolesMemberId) return;
    setIsSavingRoles(true);
    try {
      await assignIsoRoles(isoRolesMemberId, selectedIsoRoles);
      toast.success('ISO roles updated');
      setIsoRolesMemberId(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update ISO roles'));
    } finally {
      setIsSavingRoles(false);
    }
  };

  const toggleIsoRole = (role: string) => {
    setSelectedIsoRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  if (isLoading || !currentProject) {
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
          <h1 className="text-2xl font-bold tracking-tight">Project Members</h1>
          <p className="text-muted-foreground text-sm">
            Manage members of {currentProject.name}
          </p>
        </div>
        {isLead && (
          <Button onClick={() => setShowAddDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
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
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Privilege</th>
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">ISO Roles</th>
                  <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground">Custom Role</th>
                  {isLead && (
                    <th className="h-10 px-4 text-right text-xs font-medium text-muted-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
                      No members yet.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => {
                    const isCurrentUser = member.user_id === user?.id;
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
                          <Badge className={privilegeBadgeColors[member.privilege]}>
                            {privilegeLabels[member.privilege]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {member.iso_roles.length === 0 ? (
                              <span className="text-xs text-muted-foreground">None</span>
                            ) : (
                              member.iso_roles.map((r) => (
                                <Badge key={r.iso_role} variant="outline" className="text-xs">
                                  {r.iso_role}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {member.custom_role || '—'}
                        </td>
                        {isLead && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openIsoRoles(member.id, member.iso_roles)}
                                title="Assign ISO Roles"
                              >
                                <Shield className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleRemove(member.id)}
                                title="Remove member"
                              >
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
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

      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddDialog(false)} />
          <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Member</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowAddDialog(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAddMember)} className="space-y-4">
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
                  name="privilege"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Privilege</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none md:text-sm"
                          {...field}
                        >
                          <option value="PROJECT_MEMBER">Member</option>
                          <option value="PROJECT_AUDITOR">Auditor</option>
                          <option value="PROJECT_LEAD">Lead</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="custom_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Role</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Security Analyst" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
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

      {isoRolesMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsoRolesMemberId(null)} />
          <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Assign ISO Roles</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setIsoRolesMemberId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {ISO_ROLES.map((role) => {
                const isSelected = selectedIsoRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleIsoRole(role)}
                    className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-accent/50'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/30'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                    {role}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsoRolesMemberId(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveIsoRoles} disabled={isSavingRoles}>
                {isSavingRoles && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Roles
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
