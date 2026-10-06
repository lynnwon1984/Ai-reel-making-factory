import type { ProjectModuleDefinition } from '../types';

const config: ProjectModuleDefinition = {
  id: 'anime-horizontal',
  name: 'AI 动漫',
  subtitle: '横屏',
  description: '将动漫剧本转化为 AI 可生成的横屏分镜脚本，宽画幅构图优化',
  icon: '🌟',
  aspectRatio: '16:9',
  color: 'from-indigo-600 to-violet-600',
  promptOverrides: {},
  stylePresets: ['日漫风', '国漫风', '赛博朋克', '奇幻', '自定义'],
};

export default config;
