'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Building2,
  Plus,
  Users,
  FolderKanban,
  FolderOpen,
  Pencil,
  Trash2,
  Loader2,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import type { Organization } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const orgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  description: z.string().optional(),
  industry: z.string().optional(),
});

type OrgForm = z.infer<typeof orgSchema>;

const roleLabels: Record<string, string> = {
  ORG_OWNER: 'Owner',
  ORG_ADMIN: 'Admin',
  ORG_MEMBER: 'Member',
};

export default function OrganizationsPage() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { organizations, isLoading, loadOrganizations, createOrg, updateOrg, deleteOrg, leaveOrgById } =
    useOrgStore();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [leavingOrg, setLeavingOrg] = useState<Organization | null>(null);

  const getMyRole = (org: Organization) =>
    org.members?.find((member) => member.user_id === userId)?.role;

  const form = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: '',
      description: '',
      industry: '',
    },
  });

  useEffect(() => {
    loadOrganizations();
    if (new URLSearchParams(window.location.search).get('create') === 'true') {
      setCreateDialogOpen(true);
    }
  }, [loadOrganizations]);

  const openEditDialog = (org: Organization) => {
    setEditingOrg(org);
    form.reset({
      name: org.name,
      description: org.description || '',
      industry: org.industry || '',
    });
  };

  const handleCreateOrg = async (data: OrgForm) => {
    try {
      const org = await createOrg(data);
      toast.success('Organization created successfully');
      setCreateDialogOpen(false);
      form.reset();
      router.push(`/dashboard/organizations/${org.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create organization'));
    }
  };

  const handleUpdateOrg = async (data: OrgForm) => {
    if (!editingOrg) return;
    try {
      await updateOrg(editingOrg.id, data);
      toast.success('Organization updated successfully');
      setEditingOrg(null);
      form.reset();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update organization'));
    }
  };

  const handleDeleteOrg = async () => {
    if (!deletingOrg) return;
    try {
      await deleteOrg(deletingOrg.id, {
        action: 'DELETE',
        leave_organization: false,
      });
      toast.success(`"${deletingOrg.name}" was deleted`);
      setDeletingOrg(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete organization'));
    }
  };

  const handleLeaveOrg = async () => {
    if (!leavingOrg) return;
    try {
      await leaveOrgById(leavingOrg.id);
      toast.success(`You left "${leavingOrg.name}"`);
      setLeavingOrg(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to leave organization'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Organizations</h1>
          <p className="text-muted-foreground text-sm">
            Open, edit, or remove your organizations
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : organizations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No organizations yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4 max-w-sm">
            Create your first organization to start managing ISO 27001 compliance.
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizations.map((org) => {
            const myRole = getMyRole(org);
            const isOwner = myRole === 'ORG_OWNER';
            const isAdmin = myRole === 'ORG_ADMIN';
            const canEdit = isOwner || isAdmin;

            return (
              <Card key={org.id} className="flex flex-col transition-colors hover:bg-accent/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{org.name}</CardTitle>
                      {org.industry && <CardDescription>{org.industry}</CardDescription>}
                    </div>
                    {myRole && (
                      <Badge
                        variant={isOwner ? 'default' : isAdmin ? 'secondary' : 'outline'}
                        className="shrink-0"
                      >
                        {roleLabels[myRole]}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div>
                    {org.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {org.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {org._count?.members ?? 0} members
                      </span>
                      <span className="flex items-center gap-1">
                        <FolderKanban className="h-3.5 w-3.5" />
                        {org._count?.projects ?? 0} projects
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/dashboard/organizations/${org.id}`)}
                    >
                      <FolderOpen className="h-4 w-4 mr-1.5" />
                      Open
                    </Button>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(org)}>
                        <Pencil className="h-4 w-4 mr-1.5" />
                        Edit
                      </Button>
                    )}
                    {isOwner ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingOrg(org)}
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLeavingOrg(org)}
                      >
                        <LogOut className="h-4 w-4 mr-1.5" />
                        Leave
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create organization dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Set up a new workspace for managing ISO 27001 compliance.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateOrg)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Organization name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Technology, Healthcare" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit organization dialog */}
      <Dialog open={Boolean(editingOrg)} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Update the details of this organization.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateOrg)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Organization name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Technology, Healthcare" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingOrg(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(deletingOrg)} onOpenChange={(open) => !open && setDeletingOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete organization?</DialogTitle>
            <DialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold text-foreground">{deletingOrg?.name}</span>, along
              with all of its projects, members, and data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingOrg(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteOrg}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave confirmation dialog */}
      <Dialog open={Boolean(leavingOrg)} onOpenChange={(open) => !open && setLeavingOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave organization?</DialogTitle>
            <DialogDescription>
              You will lose access to{' '}
              <span className="font-semibold text-foreground">{leavingOrg?.name}</span> and all of
              its projects. An owner would have to invite you again to rejoin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeavingOrg(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLeaveOrg}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
