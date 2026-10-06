import type { ProjectModuleDefinition } from '../types';

const config: ProjectModuleDefinition = {
  id: 'domestic-drama-horizontal',
  name: '国产剧',
  subtitle: '横屏',
  description: '将国产横屏影视剧转化为专业分镜脚本，针对横屏构图优化',
  icon: '📺',
  aspectRatio: '16:9',
  color: 'from-amber-600 to-orange-600',
  promptOverrides: {},
  stylePresets: ['电影感', '古装风', '现代都市', '悬疑', '自定义'],
};

export default config;
