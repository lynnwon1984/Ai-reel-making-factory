import { useState, useEffect } from 'react';
import type { PipelineSettings } from '../lib/types';
import { DEFAULT_SETTINGS, STYLE_PRESETS } from '../lib/constants';

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

interface SettingsPanelProps {
  settings?: PipelineSettings;
  onChange?: (settings: PipelineSettings) => void;
  compact?: boolean;
}

export default function SettingsPanel({ settings: externalSettings, onChange, compact = false }: SettingsPanelProps) {
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

  const padding = compact ? 'p-4' : 'p-6';

  return (
    <div className={`space-y-6 ${padding}`}>
      {/* Temperature */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Temperature: <span className="text-blue-600 font-mono">{settings.temperature.toFixed(1)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.temperature}
          onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>精确 0</span>
          <span>创意 1</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
        <input
          type="number"
          min={256}
          max={16384}
          step={256}
          value={settings.maxTokens}
          onChange={(e) => update({ maxTokens: parseInt(e.target.value) || 4096 })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
        />
        <p className="text-xs text-gray-400 mt-1">推荐范围：2048 - 8192</p>
      </div>

      {/* Style Preset */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">分镜风格预设</label>
        <div className="grid grid-cols-3 gap-2">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => update({ stylePreset: preset })}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                settings.stylePreset === preset
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">自定义 Prompt 模板</label>
        <textarea
          value={settings.customPrompt || ''}
          onChange={(e) => update({ customPrompt: e.target.value })}
          rows={4}
          placeholder="输入自定义指令，将追加到每个 AI 调用的 system prompt 中..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none resize-y font-mono"
          style={{ textAlign: 'left' }}
        />
      </div>

      {/* Reset */}
      <div className="pt-2 border-t border-gray-200">
        <button
          onClick={resetDefaults}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          恢复默认设置
        </button>
      </div>
    </div>
  );
}
