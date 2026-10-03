import { create } from 'zustand';
import { projectsApi, ComplianceProject, ProjectMember, ProjectPhase, ProjectStep } from '@/lib/api';

interface ProjectState {
  projects: ComplianceProject[];
  currentProject: ComplianceProject | null;
  phases: ProjectPhase[];
  members: ProjectMember[];
  isLoading: boolean;

  loadProjects: (orgId: string) => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createProject: (orgId: string, data: {
    name: string;
    description?: string;
    start_date?: string;
    target_date?: string;
    framework_id: string;
  }) => Promise<ComplianceProject>;
  updateProject: (projectId: string, data: {
    name?: string;
    description?: string;
    status?: string;
    start_date?: string;
    target_date?: string;
  }) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  completeStep: (stepId: string) => Promise<ProjectStep>;
  addMember: (email: string, privilege: string, custom_role?: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  assignIsoRoles: (memberId: string, isoRoles: string[]) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
  (set, get) => ({
    projects: [],
    currentProject: null,
    phases: [],
    members: [],
    isLoading: false,

    loadProjects: async (orgId) => {
      set({ isLoading: true });
      try {
        const projects = await projectsApi.list(orgId);
        set({ projects, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    },

    selectProject: async (projectId) => {
      set({ isLoading: true });
      try {
        const project = await projectsApi.getOne(projectId);
        set({
          currentProject: project,
          phases: project.phases || [],
          members: project.members || [],
          isLoading: false,
        });
      } catch {
        set({ isLoading: false });
      }
    },

    createProject: async (orgId, data) => {
      const project = await projectsApi.create(orgId, data);
      set((state) => ({
        projects: [project, ...state.projects],
        currentProject: project,
        phases: project.phases || [],
        members: project.members || [],
      }));
      return project;
    },

    updateProject: async (projectId, data) => {
      const updated = await projectsApi.update(projectId, data);
      set((state) => ({
        currentProject: state.currentProject?.id === projectId ? { ...state.currentProject, ...updated } : state.currentProject,
        projects: state.projects.map((p) => (p.id === projectId ? { ...p, ...updated } : p)),
      }));
    },

    deleteProject: async (projectId) => {
      await projectsApi.delete(projectId);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
      }));
    },

    completeStep: async (stepId) => {
      const project = get().currentProject;
      if (!project) throw new Error('No project selected');
      const step = await projectsApi.completeStep(project.id, stepId);
      // Completing a step can finish its phase or add steps (the SoA adds Phase 3 policies): reload everything.
      const refreshed = await projectsApi.getOne(project.id);
      set({ currentProject: refreshed, phases: refreshed.phases || [] });
      return step;
    },

    addMember: async (email, privilege, custom_role) => {
      const project = get().currentProject;
      if (!project) return;
      await projectsApi.addMember(project.id, { email, privilege, custom_role });
      const refreshed = await projectsApi.getOne(project.id);
      set({ members: refreshed.members || [] });
    },

    removeMember: async (memberId) => {
      const project = get().currentProject;
      if (!project) return;
      await projectsApi.removeMember(project.id, memberId);
      set((state) => ({
        members: state.members.filter((m) => m.id !== memberId),
      }));
    },

    assignIsoRoles: async (memberId, isoRoles) => {
      const project = get().currentProject;
      if (!project) return;
      const updated = await projectsApi.assignIsoRoles(project.id, memberId, isoRoles);
      set((state) => ({
        members: state.members.map((m) => (m.id === memberId ? { ...m, ...updated } : m)),
      }));
    },
  })
);
