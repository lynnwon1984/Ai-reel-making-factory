import type { StageId } from '../lib/types';

export interface ProjectModuleDefinition {
  id: string;                    // 'overseas-drama-vertical'
  name: string;                  // '海外剧'
  subtitle: string;              // '竖屏短剧'
  description: string;           // 卡片描述
  icon: string;                  // emoji 或图标
  aspectRatio: string;           // '9:16' | '16:9'
  color: string;                 // 卡片主题色 (Tailwind gradient class)
  promptOverrides: Partial<Record<StageId, string>>;  // 覆盖默认 prompt
  stylePresets: string[];        // 该模块的风格预设列表
}
