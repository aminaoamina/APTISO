import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  organizationsApi,
  Organization,
  OrganizationMember,
} from '@/lib/api';

interface OrgState {
  organizations: Organization[];
  currentOrg: Organization | null;
  members: OrganizationMember[];
  isLoading: boolean;

  loadOrganizations: () => Promise<void>;
  selectOrg: (orgId: string) => Promise<void>;
  clearCurrentOrg: () => void;
  createOrg: (data: { name: string; description?: string; industry?: string }) => Promise<Organization>;
  updateOrg: (orgId: string, data: { name?: string; description?: string; industry?: string }) => Promise<void>;
  deleteOrg: (orgId: string, data: {
    action: 'DELETE' | 'TRANSFER';
    transfer_to_user_id?: string;
    leave_organization: boolean;
  }) => Promise<void>;
  leaveOrg: () => Promise<void>;
  loadMembers: () => Promise<void>;
  addMember: (email: string, role: string) => Promise<{ requested_user_id: string | null }>;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: string) => Promise<void>;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      organizations: [],
      currentOrg: null,
      members: [],
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

      clearCurrentOrg: () => {
        set({ currentOrg: null, members: [] });
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

      deleteOrg: async (orgId, data) => {
        await organizationsApi.delete(orgId, data);
        set((state) => ({
          organizations: state.organizations.filter((o) => o.id !== orgId),
          currentOrg: state.currentOrg?.id === orgId ? null : state.currentOrg,
        }));
      },

      leaveOrg: async () => {
        const org = get().currentOrg;
        if (!org) return;
        await organizationsApi.leave(org.id);
        set((state) => ({
          organizations: state.organizations.filter((organization) => organization.id !== org.id),
          currentOrg: null,
          members: [],
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
        if (!org) return { requested_user_id: null };
        const request = await organizationsApi.addMember(org.id, { email, role });
        await get().loadMembers();
        return { requested_user_id: request.requested_user_id };
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

    }),
    {
      name: 'aptiso-org-storage',
      partialize: (state) => ({
        currentOrg: state.currentOrg,
      }),
    }
  )
);
