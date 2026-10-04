import { useState } from 'react';
import type { Storyboard, Shot } from '../lib/types';
import { SHOT_TYPES, CAMERA_ANGLES, CAMERA_MOVEMENTS, TRANSITIONS } from '../lib/constants';

interface StoryboardTableProps {
  storyboard: Storyboard | null;
  onShotUpdate?: (sceneIdx: number, shotIdx: number, field: keyof Shot, value: string | number) => void;
}

const COLUMNS: { key: keyof Shot; label: string; width: string; editable?: boolean; options?: readonly string[] }[] = [
  { key: 'shotNumber', label: '镜号', width: 'w-14' },
  { key: 'shotType', label: '景别', width: 'w-18', editable: true, options: SHOT_TYPES },
  { key: 'angle', label: '机位', width: 'w-18', editable: true, options: CAMERA_ANGLES },
  { key: 'movement', label: '运镜', width: 'w-18', editable: true, options: CAMERA_MOVEMENTS },
  { key: 'visual', label: '画面描述', width: 'min-w-[200px]', editable: true },
  { key: 'dialogue', label: '台词/旁白', width: 'min-w-[160px]', editable: true },
  { key: 'soundEffect', label: '音效', width: 'min-w-[120px]', editable: true },
  { key: 'duration', label: '时长(s)', width: 'w-18', editable: true },
  { key: 'transition', label: '转场', width: 'w-22', editable: true, options: TRANSITIONS },
  { key: 'notes', label: '备注', width: 'min-w-[120px]', editable: true },
];

function EditableCell({ value, options, onSave }: { value: string | number; options?: readonly string[]; onSave: (v: string | number) => void }) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(String(value));

  if (editing) {
    if (options) {
      return (
        <select
          value={tempValue}
          onChange={(e) => { setTempValue(e.target.value); onSave(e.target.value); setEditing(false); }}
          onBlur={() => { onSave(tempValue); setEditing(false); }}
          autoFocus
          className="text-xs border border-blue-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full"
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={() => {
          const num = Number(tempValue);
          onSave(isNaN(num) ? tempValue : num);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const num = Number(tempValue);
            onSave(isNaN(num) ? tempValue : num);
            setEditing(false);
          }
          if (e.key === 'Escape') setEditing(false);
        }}
        autoFocus
        className="text-xs border border-blue-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full"
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-text hover:bg-blue-50 rounded px-1 py-0.5 block min-h-[20px]"
      title="点击编辑"
    >
      {value || '-'}
    </span>
  );
}

export default function StoryboardTable({ storyboard, onShotUpdate }: StoryboardTableProps) {
  if (!storyboard) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">🎬</div>
          <p>暂无分镜数据</p>
          <p className="text-xs mt-1">请先输入剧本并执行转译</p>
        </div>
      </div>
    );
  }

  const allShots = storyboard.scenes.flatMap(s => s.shots);
  const totalDuration = allShots.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 border-b border-gray-300">
              {COLUMNS.map(col => (
                <th key={col.key} className={`${col.width} px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200 last:border-r-0`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {storyboard.scenes.map((scene, sceneIdx) => (
              <>
                {/* Scene Header */}
                <tr key={`scene-${scene.sceneNumber}`} className="bg-indigo-50 border-y border-indigo-200">
                  <td colSpan={COLUMNS.length} className="px-3 py-2">
                    <span className="font-semibold text-indigo-800 text-xs">
                      场景 {scene.sceneNumber}：{scene.location} · {scene.time}
                    </span>
                    <span className="text-indigo-500 ml-2 text-xs">{scene.summary}</span>
                  </td>
                </tr>
                {/* Shots */}
                {scene.shots.map((shot, shotIdx) => (
                  <tr
                    key={shot.shotNumber}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    {COLUMNS.map(col => (
                      <td
                        key={col.key}
                        className={`${col.width} px-2 py-1.5 border-r border-gray-100 last:border-r-0 text-gray-700`}
                      >
                        {col.editable && onShotUpdate ? (
                          <EditableCell
                            value={shot[col.key] as string | number}
                            options={col.options}
                            onSave={(v) => onShotUpdate(sceneIdx, shotIdx, col.key, v)}
                          />
                        ) : (
                          <span>{shot[col.key] as string | number}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      <div className="flex items-center gap-6 px-4 py-2.5 border-t border-gray-200 bg-white text-xs text-gray-500">
        <span>总镜头数：<strong className="text-gray-800">{allShots.length}</strong></span>
        <span>总时长：<strong className="text-gray-800">{totalDuration}s</strong></span>
        <span>场景数：<strong className="text-gray-800">{storyboard.scenes.length}</strong></span>
      </div>
    </div>
  );
}
