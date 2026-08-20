'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  FolderKanban,
  Mail,
  Pencil,
  Trash2,
  Plus,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useOrgStore } from '@/store/org-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

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

export default function OrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const { currentOrg, members, isLoading, selectOrg, deleteOrg } = useOrgStore();
  const user = useAuthStore((s) => s.user);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwnerOrAdmin =
    currentOrg?.members?.some(
      (m) =>
        m.user_id === user?.id &&
        (m.role === 'ORG_OWNER' || m.role === 'ORG_ADMIN'),
    ) ?? false;

  useEffect(() => {
    if (orgId) {
      selectOrg(orgId);
    }
  }, [orgId, selectOrg]);

  const handleDelete = async () => {
    if (!currentOrg) return;
    if (!window.confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteOrg(currentOrg.id);
      toast.success('Organization deleted');
      router.push('/dashboard/organizations');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete organization'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading || !currentOrg) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const previewMembers = (currentOrg.members || []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{currentOrg.name}</h1>
            {currentOrg.description && (
              <p className="text-muted-foreground text-sm">{currentOrg.description}</p>
            )}
          </div>
        </div>
        {isOwnerOrAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/organizations/${orgId}/edit`}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Link>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-4 w-4" /> Members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentOrg._count?.members ?? members.length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <FolderKanban className="h-4 w-4" /> Projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentOrg._count?.projects ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Mail className="h-4 w-4" /> Pending Invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentOrg._count?.invitations ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {previewMembers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No members yet.</p>
          ) : (
            <div className="space-y-3">
              {previewMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {member.user.first_name?.[0]}
                      {member.user.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.user.first_name} {member.user.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.user.email}</p>
                    </div>
                  </div>
                  <Badge className={roleBadgeColors[member.role]}>
                    {roleLabels[member.role]}
                  </Badge>
                </div>
              ))}
              {members.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  + {members.length - 5} more members
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Button variant="outline" className="justify-start" asChild>
          <Link href={`/dashboard/organizations/${orgId}/members`}>
            <Users className="h-4 w-4 mr-2" />
            View All Members
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Link>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
          <Link href={`/dashboard/organizations/${orgId}/projects`}>
            <FolderKanban className="h-4 w-4 mr-2" />
            View All Projects
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Link>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
          <Link href={`/dashboard/organizations/${orgId}/invitations`}>
            <Mail className="h-4 w-4 mr-2" />
            Manage Invitations
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Link>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
          <Link href={`/dashboard/organizations/${orgId}/projects?create=true`}>
            <Plus className="h-4 w-4 mr-2" />
            Create Project
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
