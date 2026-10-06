-- ============================================
-- AI 分镜锻造工厂 - 数据库 Schema
-- ============================================

-- 1. 提示词模板表（可复用模板，跨项目/模块使用）
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                    -- 模板名称（如"海外剧审计Prompt v2"）
  description TEXT DEFAULT '',           -- 模板描述
  module_id TEXT NOT NULL DEFAULT 'overseas-drama-vertical',  -- 关联模块（如 overseas-drama-vertical, domestic-drama-vertical 等）
  stage_id TEXT NOT NULL,                -- 关联流水线阶段（audit, analyze, decompose, prompt_gen, quality）
  content TEXT NOT NULL,                 -- 提示词内容
  is_default BOOLEAN DEFAULT false,      -- 是否为该模块+阶段的默认模板
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 项目表
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                    -- 项目名称
  module_id TEXT NOT NULL,               -- 项目类型模块（overseas-drama-vertical 等）
  aspect_ratio TEXT DEFAULT '9:16',      -- 画幅比
  status TEXT DEFAULT 'draft',           -- draft / in_progress / completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 项目数据表（存储每个项目的剧本和各阶段中间结果）
CREATE TABLE IF NOT EXISTS project_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,                -- 阶段 ID（audit, analyze, decompose, prompt_gen, quality）
  data JSONB NOT NULL DEFAULT '{}',      -- 该阶段的输出数据（JSON）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, stage_id)
);

-- 4. 项目原始剧本文本（单独存储，因为可能很大）
CREATE TABLE IF NOT EXISTS project_scripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL DEFAULT '',  -- 用户上传的原始剧本
  purified_text TEXT DEFAULT '',           -- Step 1 净化后的连续剧本
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- ============================================
-- RLS (Row Level Security) 策略
-- 当前阶段：匿名读写（MVP），后续可加认证
-- ============================================

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_scripts ENABLE ROW LEVEL SECURITY;

-- 匿名读取
CREATE POLICY "Allow anonymous read prompt_templates" ON prompt_templates FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read project_data" ON project_data FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read project_scripts" ON project_scripts FOR SELECT USING (true);

-- 匿名写入
CREATE POLICY "Allow anonymous insert prompt_templates" ON prompt_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous insert projects" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous insert project_data" ON project_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous insert project_scripts" ON project_scripts FOR INSERT WITH CHECK (true);

-- 匿名更新
CREATE POLICY "Allow anonymous update prompt_templates" ON prompt_templates FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous update projects" ON projects FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous update project_data" ON project_data FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous update project_scripts" ON project_scripts FOR UPDATE USING (true);

-- 匿名删除
CREATE POLICY "Allow anonymous delete prompt_templates" ON prompt_templates FOR DELETE USING (true);
CREATE POLICY "Allow anonymous delete projects" ON projects FOR DELETE USING (true);
CREATE POLICY "Allow anonymous delete project_data" ON project_data FOR DELETE USING (true);
CREATE POLICY "Allow anonymous delete project_scripts" ON project_scripts FOR DELETE USING (true);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_prompt_templates_module ON prompt_templates(module_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_projects_module ON projects(module_id);
CREATE INDEX IF NOT EXISTS idx_project_data_project ON project_data(project_id);
