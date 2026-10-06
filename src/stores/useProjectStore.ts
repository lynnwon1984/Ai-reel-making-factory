import { create } from 'zustand';
import {
  createProject,
  fetchProjects,
  fetchProject,
  updateProject,
  deleteProject,
  saveStageData,
  fetchStageData,
  saveScript,
  fetchScript,
  type ProjectRow,
} from '../services/projectService';

interface ProjectState {
  projects: ProjectRow[];
  currentProject: ProjectRow | null;
  stageData: Record<string, Record<string, unknown>>; // stageId -> data
  script: { original_text: string; purified_text: string } | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadProjects: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  createNewProject: (params: { name: string; module_id: string; aspect_ratio?: string }) => Promise<ProjectRow>;
  updateCurrentProject: (updates: { name?: string; status?: string; aspect_ratio?: string }) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  loadStageData: (projectId: string, stageId: string) => Promise<void>;
  saveCurrentStageData: (projectId: string, stageId: string, data: Record<string, unknown>) => Promise<void>;
  loadScript: (projectId: string) => Promise<void>;
  saveCurrentScript: (projectId: string, originalText: string, purifiedText?: string) => Promise<void>;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  stageData: {},
  script: null,
  loading: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await fetchProjects();
      set({ projects, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  loadProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const project = await fetchProject(id);
      set({ currentProject: project, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createNewProject: async (params) => {
    set({ loading: true, error: null });
    try {
      const project = await createProject(params);
      set((state) => ({
        projects: [project, ...state.projects],
        currentProject: project,
        loading: false,
      }));
      return project;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateCurrentProject: async (updates) => {
    const { currentProject } = get();
    if (!currentProject) throw new Error('No current project');
    set({ loading: true, error: null });
    try {
      await updateProject(currentProject.id, updates);
      set((state) => ({
        currentProject: state.currentProject
          ? { ...state.currentProject, ...updates, updated_at: new Date().toISOString() }
          : null,
        projects: state.projects.map((p) =>
          p.id === currentProject.id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
        ),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  removeProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await deleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  loadStageData: async (projectId: string, stageId: string) => {
    try {
      const data = await fetchStageData(projectId, stageId);
      set((state) => ({
        stageData: { ...state.stageData, [stageId]: data || {} },
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  saveCurrentStageData: async (projectId: string, stageId: string, data: Record<string, unknown>) => {
    try {
      await saveStageData(projectId, stageId, data);
      set((state) => ({
        stageData: { ...state.stageData, [stageId]: data },
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  loadScript: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const script = await fetchScript(projectId);
      set({ script, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  saveCurrentScript: async (projectId: string, originalText: string, purifiedText?: string) => {
    try {
      await saveScript(projectId, originalText, purifiedText);
      set({ script: { original_text: originalText, purified_text: purifiedText || '' } });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  clearError: () => set({ error: null }),
}));
