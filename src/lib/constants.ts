import type { PipelineSettings } from './types';

export const SHOT_TYPES = ['远景', '全景', '中景', '近景', '特写'] as const;

export const CAMERA_ANGLES = ['平视', '俯拍', '仰拍', '斜侧'] as const;

export const CAMERA_MOVEMENTS = ['固定', '推', '拉', '摇', '移', '跟', '升', '降', '环绕'] as const;

export const TRANSITIONS = ['硬切', '淡入淡出', '叠化', '划变', '闪白', '闪黑'] as const;

export const STYLE_PRESETS = ['电影感', '短视频', '广告', '纪录片', '自定义'] as const;

export const SCRIPT_TYPES = ['短剧', '电影', '广告', 'MV', '纪录片', '其他'] as const;

export const DEFAULT_SETTINGS: PipelineSettings = {
  temperature: 0.7,
  maxTokens: 4096,
  stylePreset: '电影感',
};

export const PIPELINE_STEPS = [
  { id: 1, name: '剧本分析', description: '识别剧本类型、角色、风格基调' },
  { id: 2, name: '场景拆分', description: '按场景拆分剧本，标注地点、时间、角色' },
  { id: 3, name: '镜头分解', description: '将每个场景拆解为具体镜头' },
  { id: 4, name: '格式化输出', description: '生成统计摘要，检查连贯性' },
];
