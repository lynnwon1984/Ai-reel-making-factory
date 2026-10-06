import type { StageConfig, PipelineSettings, StageId } from './types.ts';
import auditSkill from '../../skills/audit.md?raw';
import analyzeSkill from '../../skills/analyze.md?raw';
import diagnoseSkill from '../../skills/diagnose.md?raw';
import repairSkill from '../../skills/repair.md?raw';
import decomposeSkill from '../../skills/decompose.md?raw';
import promptgenSkill from '../../skills/promptgen.md?raw';
import qualitySkill from '../../skills/quality.md?raw';
import decomposeCheckSkill from '../../skills/decompose-check.md?raw';
import promptgenCheckSkill from '../../skills/promptgen-check.md?raw';
import repairFinalSkill from '../../skills/repair_final.md?raw';
// ===== Seedance 标准词汇表 =====

export const SHOT_TYPES = [
  '微距特写', '特写', '中近景', '中景', '全景', '远景', '俯拍全景'
] as const;

export const CAMERA_ANGLES = [
  '低机位', '高机位', '俯拍', '仰拍', '平视', '45度角', '侧后方', '正面'
] as const;

export const CAMERA_MOVEMENTS = [
  '定镜', '缓慢推近', '快速拉远', '环绕镜头', '焦点转移',
  '侧向跟拍', '手持跟拍', '航拍', '轨道推进', '升降镜头',
  '延时摄影', '慢动作', '希区柯克变焦'
] as const;

export const TRANSITIONS = [
  '硬切', '淡入淡出', '叠化', '划变', '匹配剪辑'
] as const;

// ===== Seedance 音频标记 =====

export const AUDIO_MARKERS = {
  backgroundMusic: { prefix: '配乐：(', suffix: ')', description: '背景音乐' },
  ambientSound: { prefix: '[', suffix: ']', description: '环境音效' },
  dialogue: { prefix: '{', suffix: '}', description: '人物台词' },
  subtitle: { prefix: '【', suffix: '】', description: '画面字幕' },
} as const;

// ===== 风格预设 =====

export const STYLE_PRESETS = [
  { id: 'cinematic', name: '电影感', description: '低饱和色调，侧光勾勒主体轮廓，背景大面积压暗' },
  { id: 'short_video', name: '短视频', description: '高饱和、快节奏、强对比，适合竖屏' },
  { id: 'commercial', name: '广告', description: '产品特写为主，干净背景，商业质感' },
  { id: 'documentary', name: '纪录片', description: '自然光线，手持跟拍质感，真实感' },
  { id: 'custom', name: '自定义', description: '用户自定义风格' },
] as const;

// ===== 7 阶段默认配置 =====

export const STAGE_CONFIGS: StageConfig[] = [
  {
    id: 'audit',
    name: '剧本审计与净化',
    description: '查重、逻辑修复、剔除噪音、统一角色名、打散分集结构，输出纯净连续剧本',
    defaultSystemPrompt: auditSkill,
    availableVariables: ['scriptText'],
    outputFormat: 'PurifiedScript JSON',
  },
  {
    id: 'analyze',
    name: '剧本深度分析',
    description: '提取角色档案、关系图谱、剧情结构、道具追踪、风格判断',
    defaultSystemPrompt: analyzeSkill,
    availableVariables: ['purifiedScript'],
    outputFormat: 'ScriptAnalysis JSON',
  },
  {
    id: 'diagnose',
    name: '剧本诊断',
    description: '基于分析结果检测剧本中的逻辑断链、角色问题、节奏缺陷',
    defaultSystemPrompt: diagnoseSkill,
    availableVariables: ['analysis', 'scriptText'],
    outputFormat: 'DiagnosisResult JSON',
  },
  {
    id: 'repair',
    name: '剧本修复',
    description: '根据诊断结果自动修复剧本缺陷',
    defaultSystemPrompt: repairSkill,
    availableVariables: ['diagnosis', 'scriptText'],
    outputFormat: 'RepairResult JSON',
  },
  {
    id: 'decompose',
    name: '分镜设计',
    description: '将场景拆解为镜头，遵循 Seedance 标准（景别、运镜、音频标记）',
    defaultSystemPrompt: decomposeSkill,
    availableVariables: ['purifiedScript', 'analysis', 'currentBatchScenes', 'previousBatchSummary'],
    outputFormat: 'BatchResult JSON (shots[] + batchSummary)',
  },
  {
    id: 'prompt_gen',
    name: 'Seedance Prompt 生成',
    description: '将分镜数据转换为 Seedance 可直接使用的 prompt',
    defaultSystemPrompt: promptgenSkill,
    availableVariables: ['shots', 'analysis', 'targetVersion'],
    outputFormat: 'SeedancePrompt[] JSON',
  },
  {
    id: 'quality_check',
    name: '质检与格式化',
    description: '统计摘要、连贯性检查、Seedance 质量评分、最终输出',
    defaultSystemPrompt: qualitySkill,
    availableVariables: ['shots', 'analysis', 'seedancePrompts'],
    outputFormat: 'QualityReport JSON',
  },
  {
    id: 'decompose_check',
    name: '分镜质检',
    description: '检查分镜设计结果的合规性和完整性',
    defaultSystemPrompt: decomposeCheckSkill,
    availableVariables: ['shots', 'analysis'],
    outputFormat: 'DecomposeCheckResult JSON',
  },
  {
    id: 'promptgen_check',
    name: 'Seedance Prompt 质检',
    description: '检查 Seedance Prompt 的格式合规性和可执行性',
    defaultSystemPrompt: promptgenCheckSkill,
    availableVariables: ['seedancePrompts', 'targetVersion'],
    outputFormat: 'PromptgenCheckResult JSON',
  },
  {
    id: 'repair_final',
    name: '最终修复与格式化',
    description: '基于质检报告修复分镜问题，并格式化为标准分镜头剧本输出',
    defaultSystemPrompt: repairFinalSkill,
    availableVariables: ['qualityReport', 'shots', 'analysis'],
    outputFormat: 'RepairFinalResult JSON (fixedIssues + manualReviewItems + formatCompliance + finalStoryboardText)',
  },
];

// ===== 默认设置 =====

export const DEFAULT_SETTINGS: PipelineSettings = {
  temperature: 0.3,
  maxTokens: 8192,
  targetSeedanceVersion: '2.5',
  batchSize: 3,
  tokenBudget: 80000,
  customPrompts: {} as Record<StageId, string>,
  stylePreset: 'cinematic',
};

// ===== 流水线步骤定义（有序） =====

export const PIPELINE_STEPS: { id: StageId; name: string }[] = [
  { id: 'audit', name: '剧本审计与净化' },
  { id: 'analyze', name: '剧本深度分析' },
  { id: 'decompose', name: '分镜设计' },
  { id: 'prompt_gen', name: 'Seedance Prompt 生成' },
  { id: 'quality_check', name: '质检与格式化' },
];
