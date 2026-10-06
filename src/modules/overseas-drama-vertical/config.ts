import type { ProjectModuleDefinition } from '../types';

const config: ProjectModuleDefinition = {
  id: 'overseas-drama-vertical',
  name: '海外剧',
  subtitle: '竖屏短剧',
  description: '将海外竖屏短剧转化为专业分镜脚本，针对海外剧叙事节奏优化',
  icon: '🎬',
  aspectRatio: '9:16',
  color: 'from-blue-600 to-cyan-600',
  promptOverrides: {},  // 使用全局默认 prompt
  stylePresets: ['电影感', '短视频', '纪录片', '自定义'],
};

export default config;
