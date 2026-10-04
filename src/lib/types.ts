// 剧本分析结果（Step 1）
export interface ScriptAnalysis {
  scriptType: '短剧' | '电影' | '广告' | 'MV' | '纪录片' | '其他';
  characters: Character[];
  estimatedScenes: number;
  style: string;
  mood: string;
  summary: string;
}

export interface Character {
  name: string;
  description: string;
  role: '主角' | '配角' | '群演';
}

// 场景（Step 2）
export interface Scene {
  sceneNumber: number;
  location: string;
  time: '日' | '夜' | '晨' | '黄昏';
  characters: string[];
  summary: string;
  scriptContent: string;
}

// 镜头（Step 3）
export interface Shot {
  shotNumber: number;
  sceneNumber: number;
  shotType: '远景' | '全景' | '中景' | '近景' | '特写';
  angle: '平视' | '俯拍' | '仰拍' | '斜侧';
  movement: '固定' | '推' | '拉' | '摇' | '移' | '跟' | '升' | '降' | '环绕';
  visual: string;
  dialogue: string;
  soundEffect: string;
  duration: number; // 秒
  transition: '硬切' | '淡入淡出' | '叠化' | '划变' | '闪白' | '闪黑';
  notes: string;
}

// 分镜剧本（最终输出）
export interface Storyboard {
  title: string;
  totalShots: number;
  totalDuration: number;
  scenes: SceneWithShots[];
  summary: string;
}

export interface SceneWithShots extends Scene {
  shots: Shot[];
  sceneDuration: number;
}

// 项目
export interface Project {
  id: string;
  name: string;
  scriptText: string;
  scriptType: string;
  analysis: ScriptAnalysis | null;
  scenes: Scene[] | null;
  shots: Shot[] | null;
  storyboard: Storyboard | null;
  status: ProjectStatus;
  settings: PipelineSettings;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'draft' | 'analyzing' | 'scene-breaking' | 'decomposing' | 'formatting' | 'done' | 'error';

// 流水线设置
export interface PipelineSettings {
  temperature: number;
  maxTokens: number;
  stylePreset: '电影感' | '短视频' | '广告' | '纪录片' | '自定义';
  customPrompt?: string;
}

// 流水线步骤状态
export type PipelineStepStatus = 'idle' | 'running' | 'done' | 'error';

export interface PipelineStep {
  id: number;
  name: string;
  description: string;
  status: PipelineStepStatus;
  output?: any;
  error?: string;
}

// 导出格式
export type ExportFormat = 'json' | 'markdown';
