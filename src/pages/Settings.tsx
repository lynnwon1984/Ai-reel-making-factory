import { useSearchParams } from 'react-router-dom';
import SettingsPanel from '../components/SettingsPanel';

export default function Settings() {
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('moduleId') || undefined;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-200 mb-2">设置</h1>
      <p className="text-sm text-gray-500 mb-6" style={{ textAlign: 'left' }}>
        配置 AI 模型参数和分镜生成偏好
      </p>
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl">
        <SettingsPanel moduleId={moduleId} />
      </div>
    </div>
  );
}
