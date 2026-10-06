// ===== Stage 配置相关 =====

export type StageId = 'audit' | 'analyze' | 'diagnose' | 'repair' | 'decompose' | 'prompt_gen' | 'quality_check' | 'decompose_check' | 'promptgen_check' | 'repair_final';

export interface StageConfig {
  id: StageId;
  name: string;                    // 用户可见的阶段名
  description: string;             // 阶段功能说明
  defaultSystemPrompt: string;     // 内置默认 prompt 模板
  customSystemPrompt?: string;     // 用户自定义（覆盖默认）
  availableVariables: string[];    // 该阶段可用的插值变量
  outputFormat: string;            // 期望输出格式说明
}

// ===== Prompt 模板变量 =====

export interface PipelineContext {
  scriptText: string;              // 原始剧本
  purifiedScript: PurifiedScript;  // Stage 1 输出
  analysis: ScriptAnalysis;        // Stage 2 输出
  shots: Shot[];                   // Stage 3 输出
  currentBatchScenes: PurifiedScene[]; // 当前批次场景
  previousBatchSummary: BatchSummary | null; // 前一批次摘要
  seedancePrompts: SeedancePrompt[]; // Stage 4 输出
  targetVersion: '2.0' | '2.5';   // Seedance 目标版本
  [key: string]: unknown;
}

// ===== Stage 1 输出：净化剧本 =====

export interface PurifiedScene {
  sceneNumber: number;
  location: string;                // 地点
  timeOfDay: string;               // 日/夜/晨/黄昏
  characters: string[];            // 在场角色
  content: string;                 // 场景正文（净化后）
}

export interface SceneIndexEntry {
  index: number;
  location: string;
  timeOfDay: string;
  characters: string[];
  textOffset: number;               // 在 fullText 中的起始位置
  textLength: number;               // 文本长度
}

export interface LogicIssue {
  type: '空间跳跃' | '情绪突变' | '信息断层' | '时间矛盾' | '角色消失重现' | '去重损伤';
  severity: '严重' | '中等' | '轻微';
  location: string;                 // 断链处文本片段
  description: string;
  suggestion: string;               // 修复建议
}


export interface PurifiedScript {
  fullText: string;                  // 连续纯净剧本文本（核心输出）
  sceneIndex: SceneIndexEntry[];     // 轻量场景索引（仅定位用）
  totalScenes: number;
  characterNames: string[];          // 统一后的角色名列表
  logicIssues: LogicIssue[];         // 逻辑断链检测结果
  auditNotes: {                      // 审计备注
    duplicatesRemoved: number;
    noiseMarkersRemoved: number;
    scenesMerged: number;
    originalLineCount: number;
    purifiedLineCount: number;
  };
}

// ===== Stage 2 输出：深度分析 =====

export interface CharacterProfile {
  name: string;
  role: '主角' | '配角' | '反派' | '龙套';
  identity: string;                // 身份/职业
  personality: string;             // 性格特征
  appearance: string;              // 外观描述（服装、关键特征）
  relationships: Record<string, string>; // 与其他角色的关系
  keyProps?: string[];             // 关键道具
}

export interface PlotStructure {
  exposition: string;              // 起
  risingAction: string;            // 承
  climax: string;                  // 转
  resolution: string;              // 合
  keyTurningPoints: string[];      // 关键转折点
}

export interface ScriptAnalysis {
  scriptType: '短剧' | '电影' | '广告' | 'MV' | '纪录片' | '其他';
  genre: string;                   // 具体类型（如"复仇爽剧"、"都市爱情"）
  characters: CharacterProfile[];
  locations: string[];             // 地点列表
  timeline: string;                // 时间线描述
  totalScenes: number;
  plotStructure: PlotStructure;
  style: string;                   // 整体风格
  moodTone: string;                // 情绪基调
  emotionalArc: string;            // 情绪曲线描述
  keyPropsTracking: Record<string, string>; // 关键道具追踪（道具名 → 描述）
  wardrobeTracking: Record<string, string[]>; // 服装追踪（角色名 → 服装列表）
}

// ===== Stage 2b 输出：诊断结果 =====

export interface DiagnosisIssue {
  type: '空间跳跃' | '情绪突变' | '信息断层' | '时间矛盾' | '角色消失' | '性格突变' | '节奏拖沓' | '结构缺陷';
  severity: '严重' | '中等' | '轻微';
  location: string;
  description: string;
  suggestion: string;
}

export interface DiagnosisResult {
  issues: DiagnosisIssue[];
  summary: {
    totalIssues: number;
    criticalCount: number;
    moderateCount: number;
    minorCount: number;
  };
}

// ===== Stage 2c 输出：修复结果 =====

export interface RepairResult {
  repairedText: string;
  fixCount: number;
}

// ===== Stage 2d 输出：最终修复结果 =====

export interface RepairFinalResult {
  fixedIssues: number;
  manualReviewItems: string[];
  formatCompliance: number;
  finalStoryboardText: string;
}

// ===== Stage 3 输出：分镜 =====

export interface Shot {
  shotNumber: number;
  sceneId: number;                 // 所属场景号
  shotType: string;                // 景别（Seedance 标准词汇）
  angle: string;                   // 机位角度
  movement: string;                // 运镜（每镜仅一个）
  visual: string;                  // 画面描述（动词优先，60-100词）
  subject: string;                 // 主体描述
  action: string;                  // 动作链
  lighting: string;                // 灯光/光线
  dialogue: string;                // 台词（含 [旁白]/[画外音] 标注）
  audio: string;                   // 音频设计（Seedance 标记体系）
  duration: number;                // 预估时长（秒）
  transition: string;              // 转场方式
  mood: string;                    // 情绪/氛围
  constraints: string;             // 约束条件
  notes: string;                   // 导演备注
}

export interface BatchSummary {
  lastShotNumber: number;
  characterStates: Record<string, string>; // 角色状态快照
  continuityNotes: string[];       // 视觉连续性要素
  narrativeProgress: string;       // 叙事进度
}

export interface BatchResult {
  shots: Shot[];
  batchSummary: BatchSummary;
}

// ===== Stage 4 输出：Seedance Prompt =====

export interface SeedancePrompt {
  shotNumber: number;              // 对应镜号
  sceneId: number;                 // 对应场景
  promptText: string;              // 可直接粘贴到 Seedance 的 prompt 文本
  format: '2.0' | '2.5';          // 格式版本
  duration: number;                // 预估时长
  timestampRange?: string;         // 2.5 格式的时间范围（如 "[00:00-00:05]"）
  shotLabel?: string;              // 2.0 格式的镜头编号（如 "镜头一"）
}


// ===== Stage 4 输出：分镜头剧本 =====

export interface StoryboardClip {
  clipNumber: number;              // Clip 编号
  shotType: string;                // 景别
  duration: number;                // 时长（秒）
  description: string;             // 60-100字自然语言描述
  promptText: string;              // Seedance 2.0 友好文本
}

export interface StoryboardScript {
  projectName: string;             // 项目名称
  totalClips: number;              // 总镜头数
  totalDuration: number;           // 总时长（秒）
  formattedText: string;           // 完整分镜头剧本文本
  clips: StoryboardClip[];         // Clip 列表
}

// ===== 质检 Clip 检查项 =====

export interface ClipCheckIssue {
  type: string;
  severity: '严重' | '中等' | '轻微';
  description: string;
  suggestion: string;
}

export interface ClipCheck {
  clipNumber: number;
  shotType: string;
  duration: number;
  charCount: number;
  cameraMovements: string[];
  compliant: boolean;
  issues: ClipCheckIssue[];
}

// ===== Stage 5 输出：最终 Storyboard =====

export interface QualityReport {
  totalClips: number;
  totalDuration: number;           // 总时长（秒）
  formatCompliance: number;        // 格式合规率（0-100）
  clipChecks: ClipCheck[];         // 逐 Clip 检查结果
  continuityIssues: string[];      // 连贯性问题
  overallScore: number;            // 总评分（0-100）
  summary: string;                 // 质检摘要
  // Legacy fields for backward compat
  totalShots?: number;
  sceneDistribution?: Record<number, number>;
  characterAppearanceCount?: Record<string, number>;
  seedanceQualityScore?: number;
  qualityNotes?: string[];
}

export interface Storyboard {
  purifiedScript: PurifiedScript;
  analysis: ScriptAnalysis;
  shots: Shot[];
  seedancePrompts: SeedancePrompt[];
  qualityReport: QualityReport;
  metadata: {
    title: string;
    createdAt: string;
    seedanceVersion: '2.0' | '2.5';
    totalBatches: number;
  };
}

// ===== 流水线状态 =====

export type PipelineStepStatus = 'idle' | 'running' | 'done' | 'error';

export interface PipelineStepState {
  id: StageId;
  name: string;
  status: PipelineStepStatus;
  streamText: string;              // 流式输出文本
  result: unknown;                 // 该步骤的输出
  error?: string;
  customPrompt?: string;           // 用户自定义 prompt
}

export interface PipelineState {
  steps: PipelineStepState[];
  isRunning: boolean;
  storyboard: Storyboard | null;
}

// ===== 项目（保留并扩展） =====

export interface Project {
  id: string;
  name: string;
  moduleId: string;                  // 关联的模块 ID
  scriptText: string;
  purifiedScript?: PurifiedScript;
  analysis?: ScriptAnalysis;
  shots?: Shot[];
  seedancePrompts?: SeedancePrompt[];
  storyboard?: Storyboard;
  status: string;
  settings: PipelineSettings;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineSettings {
  temperature: number;
  maxTokens: number;
  targetSeedanceVersion: '2.0' | '2.5';
  batchSize: number;               // 每批场景数（默认 2-3）
  tokenBudget: number;             // 每批 token 预算
  customPrompts: Record<StageId, string>; // 各阶段自定义 prompt
  stylePreset: string;
}
