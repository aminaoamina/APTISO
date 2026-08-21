'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  FolderKanban,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showOwnershipDialog, setShowOwnershipDialog] = useState(false);
  const [transferToUserId, setTransferToUserId] = useState('');
  const [leaveAfterTransfer, setLeaveAfterTransfer] = useState(true);

  const currentRole = currentOrg?.members?.find((m) => m.user_id === user?.id)?.role;
  const isOwnerOrAdmin = currentRole === 'ORG_OWNER' || currentRole === 'ORG_ADMIN';
  const isOwner = currentRole === 'ORG_OWNER';

  useEffect(() => {
    if (orgId) {
      selectOrg(orgId);
    }
  }, [orgId, selectOrg]);

  const handleDelete = async () => {
    if (!currentOrg) return;
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    setShowDeleteDialog(false);
    setTransferToUserId('');
    setLeaveAfterTransfer(true);
    setShowOwnershipDialog(true);
  };

  const finishOrganizationAction = async (data: {
    action: 'DELETE' | 'TRANSFER';
    transfer_to_user_id?: string;
    leave_organization: boolean;
  }) => {
    setIsDeleting(true);
    try {
      await deleteOrg(currentOrg!.id, data);
      setShowOwnershipDialog(false);
      toast.success(data.action === 'TRANSFER'
        ? (data.leave_organization ? 'Ownership transferred and you left the organization' : 'Ownership transferred')
        : 'Organization deleted');
      router.push('/dashboard/organizations');
    } catch (err) {
      toast.error(getErrorMessage(err, data.action === 'TRANSFER' ? 'Failed to transfer ownership' : 'Failed to delete organization'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferToUserId) {
      toast.error('Choose a member to receive ownership');
      return;
    }
    await finishOrganizationAction({
      action: 'TRANSFER',
      transfer_to_user_id: transferToUserId,
      leave_organization: leaveAfterTransfer,
    });
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
            {isOwner && (
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
            )}
          </div>
        )}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete organization?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Do you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOwnershipDialog} onOpenChange={setShowOwnershipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What should happen to ownership?</DialogTitle>
            <DialogDescription>
              Transfer ownership to a member, or permanently delete {currentOrg.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor="ownership-recipient">New owner</label>
              <select
                id="ownership-recipient"
                className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={transferToUserId}
                onChange={(event) => setTransferToUserId(event.target.value)}
                disabled={isDeleting}
              >
                <option value="">Select a member</option>
                {members.filter((member) => member.user_id !== user?.id).map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.user.first_name} {member.user.last_name} ({member.user.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Do you want to leave the organization?</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={leaveAfterTransfer} onChange={() => setLeaveAfterTransfer(true)} />
                Yes, leave the organization
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!leaveAfterTransfer} onChange={() => setLeaveAfterTransfer(false)} />
                No, keep me as a member
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOwnershipDialog(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => finishOrganizationAction({ action: 'DELETE', leave_organization: false })} disabled={isDeleting}>
              Delete organization
            </Button>
            <Button onClick={handleTransfer} disabled={isDeleting || !transferToUserId}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transfer ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2">
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
        {isOwnerOrAdmin && (
          <>
            <Button variant="outline" className="justify-start" asChild>
              <Link href={`/dashboard/organizations/${orgId}/projects?create=true`}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
