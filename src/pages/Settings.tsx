import SettingsPanel from '../components/SettingsPanel';

export default function Settings() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">设置</h1>
      <p className="text-sm text-gray-500 mb-6" style={{ textAlign: 'left' }}>
        配置 AI 模型参数和分镜生成偏好
      </p>
      <div className="bg-white border border-gray-200 rounded-xl">
        <SettingsPanel />
      </div>
    </div>
  );
}
