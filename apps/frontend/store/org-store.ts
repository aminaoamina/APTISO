import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  organizationsApi,
  Organization,
  OrganizationMember,
  Invitation,
  invitationsApi,
} from '@/lib/api';

interface OrgState {
  organizations: Organization[];
  currentOrg: Organization | null;
  members: OrganizationMember[];
  invitations: Invitation[];
  isLoading: boolean;

  loadOrganizations: () => Promise<void>;
  selectOrg: (orgId: string) => Promise<void>;
  createOrg: (data: { name: string; description?: string; industry?: string }) => Promise<Organization>;
  updateOrg: (orgId: string, data: { name?: string; description?: string; industry?: string }) => Promise<void>;
  deleteOrg: (orgId: string) => Promise<void>;
  loadMembers: () => Promise<void>;
  addMember: (email: string, role: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: string) => Promise<void>;
  loadInvitations: () => Promise<void>;
  sendInvitation: (email: string, role: string) => Promise<{ invitation_link: string }>;
  revokeInvitation: (invitationId: string) => Promise<void>;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      organizations: [],
      currentOrg: null,
      members: [],
      invitations: [],
      isLoading: false,

      loadOrganizations: async () => {
        set({ isLoading: true });
        try {
          const organizations = await organizationsApi.list();
          set({ organizations, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      selectOrg: async (orgId: string) => {
        set({ isLoading: true });
        try {
          const org = await organizationsApi.getOne(orgId);
          set({
            currentOrg: org,
            members: org.members || [],
            isLoading: false,
          });
        } catch {
          set({ isLoading: false });
        }
      },

      createOrg: async (data) => {
        const org = await organizationsApi.create(data);
        set((state) => ({
          organizations: [org, ...state.organizations],
          currentOrg: org,
          members: org.members || [],
        }));
        return org;
      },

      updateOrg: async (orgId, data) => {
        const updated = await organizationsApi.update(orgId, data);
        set((state) => ({
          currentOrg: state.currentOrg?.id === orgId ? updated : state.currentOrg,
          organizations: state.organizations.map((o) =>
            o.id === orgId ? { ...o, ...updated } : o
          ),
        }));
      },

      deleteOrg: async (orgId) => {
        await organizationsApi.delete(orgId);
        set((state) => ({
          organizations: state.organizations.filter((o) => o.id !== orgId),
          currentOrg: state.currentOrg?.id === orgId ? null : state.currentOrg,
        }));
      },

      loadMembers: async () => {
        const org = get().currentOrg;
        if (!org) return;
        try {
          const updated = await organizationsApi.getOne(org.id);
          set({ members: updated.members || [] });
        } catch {
          // ignore
        }
      },

      addMember: async (email, role) => {
        const org = get().currentOrg;
        if (!org) return;
        await organizationsApi.addMember(org.id, { email, role });
        await get().loadMembers();
      },

      removeMember: async (memberId) => {
        const org = get().currentOrg;
        if (!org) return;
        await organizationsApi.removeMember(org.id, memberId);
        await get().loadMembers();
      },

      updateMemberRole: async (memberId, role) => {
        const org = get().currentOrg;
        if (!org) return;
        await organizationsApi.updateMemberRole(org.id, memberId, role);
        await get().loadMembers();
      },

      loadInvitations: async () => {
        const org = get().currentOrg;
        if (!org) return;
        try {
          const invitations = await invitationsApi.list(org.id);
          set({ invitations });
        } catch {
          // ignore
        }
      },

      sendInvitation: async (email, role) => {
        const org = get().currentOrg;
        if (!org) throw new Error('No organization selected');
        const result = await invitationsApi.send(org.id, { email, role });
        await get().loadInvitations();
        return { invitation_link: result.invitation_link };
      },

      revokeInvitation: async (invitationId) => {
        const org = get().currentOrg;
        if (!org) return;
        await invitationsApi.revoke(org.id, invitationId);
        await get().loadInvitations();
      },
    }),
    {
      name: 'aptiso-org-storage',
      partialize: (state) => ({
        currentOrg: state.currentOrg,
      }),
    }
  )
);
