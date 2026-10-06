import { supabase } from '../lib/supabase';

export interface ProjectRow {
  id: string;
  name: string;
  module_id: string;
  aspect_ratio: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectDataRow {
  id: string;
  project_id: string;
  stage_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// 创建项目
export async function createProject(params: {
  name: string;
  module_id: string;
  aspect_ratio?: string;
}): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: params.name,
      module_id: params.module_id,
      aspect_ratio: params.aspect_ratio || '9:16',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 获取项目列表
export async function fetchProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// 获取单个项目
export async function fetchProject(id: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data;
}

// 更新项目
export async function updateProject(
  id: string,
  updates: Partial<Pick<ProjectRow, 'name' | 'status' | 'aspect_ratio'>>
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// 删除项目（级联删除 project_data 和 project_scripts）
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 保存阶段数据（upsert）
export async function saveStageData(
  projectId: string,
  stageId: string,
  data: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('project_data')
    .upsert(
      {
        project_id: projectId,
        stage_id: stageId,
        data,
      },
      {
        onConflict: 'project_id,stage_id',
      }
    );

  if (error) throw error;
}

// 获取阶段数据
export async function fetchStageData(
  projectId: string,
  stageId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('project_data')
    .select('data')
    .eq('project_id', projectId)
    .eq('stage_id', stageId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data?.data || null;
}

// 保存剧本文本
export async function saveScript(
  projectId: string,
  originalText: string,
  purifiedText?: string
): Promise<void> {
  const { error } = await supabase
    .from('project_scripts')
    .upsert(
      {
        project_id: projectId,
        original_text: originalText,
        purified_text: purifiedText || '',
      },
      {
        onConflict: 'project_id',
      }
    );

  if (error) throw error;
}

// 获取剧本文本
export async function fetchScript(
  projectId: string
): Promise<{ original_text: string; purified_text: string } | null> {
  const { data, error } = await supabase
    .from('project_scripts')
    .select('original_text, purified_text')
    .eq('project_id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}
