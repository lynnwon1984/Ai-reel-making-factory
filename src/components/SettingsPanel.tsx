import { useState, useEffect } from 'react';
import type { PipelineSettings } from '../lib/types';
import { DEFAULT_SETTINGS, STYLE_PRESETS } from '../lib/constants';
import { getModule } from '../modules/registry';

const SETTINGS_STORAGE_KEY = 'storyboard-forge-settings';

export function loadSettings(): PipelineSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: PipelineSettings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

const STYLE_LABELS: Record<string, string> = {
  cinematic: '电影感',
  short_video: '短视频',
  commercial: '广告',
  documentary: '纪录片',
  custom: '自定义',
  // 模块级预设
  '古装风': '古装风',
  '现代都市': '现代都市',
  '悬疑': '悬疑',
  '日漫风': '日漫风',
  '国漫风': '国漫风',
  '赛博朋克': '赛博朋克',
  '奇幻': '奇幻',
};

interface SettingsPanelProps {
  settings?: PipelineSettings;
  onChange?: (settings: PipelineSettings) => void;
  compact?: boolean;
  moduleId?: string;
}

export default function SettingsPanel({ settings: externalSettings, onChange, compact = false, moduleId }: SettingsPanelProps) {
  const [settings, setSettings] = useState<PipelineSettings>(externalSettings || loadSettings);

  useEffect(() => {
    if (externalSettings) setSettings(externalSettings);
  }, [externalSettings]);

  const update = (partial: Partial<PipelineSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    saveSettings(next);
    onChange?.(next);
  };

  const resetDefaults = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    saveSettings({ ...DEFAULT_SETTINGS });
    onChange?.({ ...DEFAULT_SETTINGS });
  };

  // Resolve style presets: module-level or global fallback
  const moduleDef = moduleId ? getModule(moduleId) : undefined;
  const stylePresets = moduleDef
    ? moduleDef.stylePresets.map((name) => ({ id: name, name: STYLE_LABELS[name] || name }))
    : STYLE_PRESETS.map((p) => ({ id: p.id, name: p.name }));

  const padding = compact ? 'p-4' : 'p-6';

  return (
    <div className={`space-y-6 ${padding}`}>
      {/* Seedance Version */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Seedance 版本</label>
        <div className="flex items-center bg-gray-800 rounded-md p-0.5">
          <button
            onClick={() => update({ targetSeedanceVersion: '2.0' })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              settings.targetSeedanceVersion === '2.0'
                ? 'bg-gray-700 text-cyan-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Seedance 2.0
          </button>
          <button
            onClick={() => update({ targetSeedanceVersion: '2.5' })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              settings.targetSeedanceVersion === '2.5'
                ? 'bg-gray-700 text-cyan-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Seedance 2.5
          </button>
        </div>
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Temperature: <span className="text-blue-400 font-mono">{settings.temperature.toFixed(1)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.temperature}
          onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>精确 0</span>
          <span>创意 1</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Max Tokens</label>
        <input
          type="number"
          min={256}
          max={16384}
          step={256}
          value={settings.maxTokens}
          onChange={(e) => update({ maxTokens: parseInt(e.target.value) || 4096 })}
          className="w-full px-3 py-2 border border-gray-600 rounded-lg text-sm bg-gray-800 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <p className="text-xs text-gray-500 mt-1">推荐范围：2048 - 8192</p>
      </div>

      {/* Batch Size */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          每批场景数: <span className="text-blue-400 font-mono">{settings.batchSize}</span>
        </label>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={settings.batchSize}
          onChange={(e) => update({ batchSize: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1 场景/批</span>
          <span>5 场景/批</span>
        </div>
      </div>

      {/* Token Budget */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Token 预算（每批）</label>
        <input
          type="number"
          min={10000}
          max={200000}
          step={10000}
          value={settings.tokenBudget}
          onChange={(e) => update({ tokenBudget: parseInt(e.target.value) || 80000 })}
          className="w-full px-3 py-2 border border-gray-600 rounded-lg text-sm bg-gray-800 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <p className="text-xs text-gray-500 mt-1">默认 80000</p>
      </div>

      {/* Style Preset */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">分镜风格预设</label>
        <div className="grid grid-cols-3 gap-2">
          {stylePresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => update({ stylePreset: preset.id })}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                settings.stylePreset === preset.id
                  ? 'border-blue-500/50 bg-blue-900/20 text-blue-400 shadow-sm'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:bg-gray-800'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <div className="pt-2 border-t border-gray-700">
        <button
          onClick={resetDefaults}
          className="px-4 py-2 text-sm text-gray-400 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          恢复默认设置
        </button>
      </div>
    </div>
  );
}
