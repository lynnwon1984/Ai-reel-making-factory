// API Route: /api/projects
// GET - List all projects
// POST - Create a new project

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

// Mock data store (replace with Supabase later)
const mockProjects: MockProject[] = [
  {
    id: 'demo-1',
    name: '示例项目 - 短片分镜',
    scriptText: '',
    status: 'draft',
    scriptType: '短剧',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ projects: mockProjects });
  }

  if (req.method === 'POST') {
    const { name, scriptText, scriptType } = req.body || {};
    const now = new Date().toISOString();
    const newProject: MockProject = {
      id: `proj-${Date.now()}`,
      name: name || '未命名项目',
      scriptText: scriptText || '',
      status: 'draft',
      scriptType: scriptType || '短剧',
      createdAt: now,
      updatedAt: now,
    };
    mockProjects.unshift(newProject);
    return res.status(201).json(newProject);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
