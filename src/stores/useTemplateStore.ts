import { create } from 'zustand';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type PromptTemplate,
} from '../services/promptTemplateService';

interface TemplateState {
  templates: PromptTemplate[];
  loading: boolean;
  error: string | null;

  // Actions
  loadTemplates: (moduleId: string, stageId: string) => Promise<void>;
  addTemplate: (template: {
    name: string;
    description?: string;
    module_id: string;
    stage_id: string;
    content: string;
    is_default?: boolean;
  }) => Promise<PromptTemplate>;
  editTemplate: (
    id: string,
    updates: Partial<Pick<PromptTemplate, 'name' | 'description' | 'content' | 'is_default'>>
  ) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  loading: false,
  error: null,

  loadTemplates: async (moduleId: string, stageId: string) => {
    set({ loading: true, error: null });
    try {
      const templates = await fetchTemplates(moduleId, stageId);
      set({ templates, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  addTemplate: async (template) => {
    set({ loading: true, error: null });
    try {
      const newTemplate = await createTemplate(template);
      set((state) => ({
        templates: [newTemplate, ...state.templates],
        loading: false,
      }));
      return newTemplate;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  editTemplate: async (id, updates) => {
    try {
      await updateTemplate(id, updates);
      set((state) => ({
        templates: state.templates.map((t) =>
          t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  removeTemplate: async (id: string) => {
    try {
      await deleteTemplate(id);
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  clearError: () => set({ error: null }),
}));
