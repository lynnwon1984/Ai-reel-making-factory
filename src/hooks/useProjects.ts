import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface ProjectMeta {
  id: string;
  name: string;
  scriptText: string;
  status: string;
  scriptType: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'project-list';

function loadProjects(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function persistProjects(projects: ProjectMeta[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectMeta[]>(loadProjects);
  const [currentProject, setCurrentProject] = useState<ProjectMeta | null>(null);

  const syncList = useCallback((updated: ProjectMeta[]) => {
    setProjects(updated);
    persistProjects(updated);
  }, []);

  const createProject = useCallback((name?: string): ProjectMeta => {
    const now = new Date().toISOString();
    const project: ProjectMeta = {
      id: uuidv4(),
      name: name || '未命名项目',
      scriptText: '',
      status: 'draft',
      scriptType: '短剧',
      createdAt: now,
      updatedAt: now,
    };
    const updated = [project, ...loadProjects()];
    syncList(updated);
    // Also persist project detail
    localStorage.setItem(`project-${project.id}`, JSON.stringify({ name: project.name, scriptText: '' }));
    setCurrentProject(project);
    return project;
  }, [syncList]);

  const deleteProject = useCallback((id: string) => {
    const updated = loadProjects().filter(p => p.id !== id);
    syncList(updated);
    localStorage.removeItem(`project-${id}`);
    if (currentProject?.id === id) setCurrentProject(null);
  }, [syncList, currentProject]);

  const renameProject = useCallback((id: string, name: string) => {
    const list = loadProjects();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return;
    list[idx] = { ...list[idx], name, updatedAt: new Date().toISOString() };
    syncList(list);
    if (currentProject?.id === id) setCurrentProject(list[idx]);
  }, [syncList, currentProject]);

  const updateProject = useCallback((id: string, updates: Partial<ProjectMeta>) => {
    const list = loadProjects();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    syncList(list);
    if (currentProject?.id === id) setCurrentProject(list[idx]);
  }, [syncList, currentProject]);

  const getProject = useCallback((id: string): ProjectMeta | undefined => {
    return loadProjects().find(p => p.id === id);
  }, []);

  const getAllProjects = useCallback((): ProjectMeta[] => {
    return loadProjects();
  }, []);

  return {
    projects,
    currentProject,
    setCurrentProject,
    createProject,
    deleteProject,
    renameProject,
    updateProject,
    getProject,
    getAllProjects,
  };
}
