import { supabase } from '../lib/supabase';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  module_id: string;
  stage_id: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// 获取指定模块+阶段的模板列表
export async function fetchTemplates(moduleId: string, stageId: string): Promise<PromptTemplate[]> {
  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('module_id', moduleId)
    .eq('stage_id', stageId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// 创建新模板
export async function createTemplate(template: {
  name: string;
  description?: string;
  module_id: string;
  stage_id: string;
  content: string;
  is_default?: boolean;
}): Promise<PromptTemplate> {
  const { data, error } = await supabase
    .from('prompt_templates')
    .insert({
      name: template.name,
      description: template.description || '',
      module_id: template.module_id,
      stage_id: template.stage_id,
      content: template.content,
      is_default: template.is_default || false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 更新模板
export async function updateTemplate(
  id: string,
  updates: Partial<Pick<PromptTemplate, 'name' | 'description' | 'content' | 'is_default'>>
): Promise<void> {
  const { error } = await supabase
    .from('prompt_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// 删除模板
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('prompt_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
