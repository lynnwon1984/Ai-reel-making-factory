// API Route: /api/projects/[id]
// GET - Get project by ID
// PUT - Update project
// DELETE - Delete project

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface MockProject {
  id: string;
  name: string;
  scriptText: string;
  status: string;
  scriptType: string;
  createdAt: string;
  updatedAt: string;
}

// In-memory store (replace with Supabase later)
const store = new Map<string, MockProject>();

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const projectId = Array.isArray(id) ? id[0] : id;

  if (!projectId) {
    return res.status(400).json({ error: 'Missing project ID' });
  }

  if (req.method === 'GET') {
    const project = store.get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    return res.status(200).json(project);
  }

  if (req.method === 'PUT') {
    const existing = store.get(projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const updates = req.body || {};
    const updated: MockProject = {
      ...existing,
      ...updates,
      id: projectId,
      updatedAt: new Date().toISOString(),
    };
    store.set(projectId, updated);
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    if (!store.has(projectId)) return res.status(404).json({ error: 'Project not found' });
    store.delete(projectId);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
