import type { ProjectModuleDefinition } from '../types';

const config: ProjectModuleDefinition = {
  id: 'domestic-drama-vertical',
  name: '国产剧',
  subtitle: '竖屏短剧',
  description: '将国产竖屏短剧转化为专业分镜脚本，针对国产剧情感表达优化',
  icon: '🎭',
  aspectRatio: '9:16',
  color: 'from-purple-600 to-pink-600',
  promptOverrides: {},
  stylePresets: ['电影感', '短视频', '古装风', '现代都市', '自定义'],
};

export default config;
