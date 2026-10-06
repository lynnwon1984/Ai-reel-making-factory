import type { ProjectModuleDefinition } from '../types';

const config: ProjectModuleDefinition = {
  id: 'anime-vertical',
  name: 'AI 动漫',
  subtitle: '竖屏',
  description: '将动漫剧本转化为 AI 可生成的分镜脚本，动漫风格 prompt 预设',
  icon: '✨',
  aspectRatio: '9:16',
  color: 'from-emerald-600 to-teal-600',
  promptOverrides: {},
  stylePresets: ['日漫风', '国漫风', '赛博朋克', '奇幻', '自定义'],
};

export default config;
