import { useState } from 'react';
import type { Storyboard, Shot } from '../lib/types';

interface StoryboardCardProps {
  storyboard: Storyboard | null;
  onShotUpdate?: (sceneIdx: number, shotIdx: number, field: keyof Shot, value: string | number) => void;
}

const SCENE_COLORS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
  'from-violet-500 to-violet-600',
  'from-cyan-500 to-cyan-600',
];

function ShotCard({
  shot,
  sceneIdx,
  shotIdx,
  colorClass,
  onShotUpdate,
}: {
  shot: Shot;
  sceneIdx: number;
  shotIdx: number;
  colorClass: string;
  onShotUpdate?: (sceneIdx: number, shotIdx: number, field: keyof Shot, value: string | number) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (field: string, value: string) => {
    setEditing(field);
    setEditValue(value);
  };

  const saveEdit = (field: keyof Shot) => {
    if (onShotUpdate) {
      onShotUpdate(sceneIdx, shotIdx, field, editValue);
    }
    setEditing(null);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Color Bar */}
      <div className={`h-1.5 bg-gradient-to-r ${colorClass}`} />

      <div className="p-3.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
              #{shot.shotNumber}
            </span>
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-medium">
              {shot.shotType}
            </span>
          </div>
          <span className="text-xs text-gray-400">{shot.duration}s</span>
        </div>

        {/* Visual Description - Main Area */}
        <div
          className="mb-3 p-2.5 bg-gray-50 rounded-md min-h-[60px] cursor-text hover:bg-blue-50/50 transition-colors"
          onClick={() => startEdit('visual', shot.visual)}
        >
          {editing === 'visual' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveEdit('visual')}
              onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
              autoFocus
              className="w-full text-xs bg-white border border-blue-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
              rows={3}
            />
          ) : (
            <p className="text-xs text-gray-700 leading-relaxed" style={{ textAlign: 'left' }}>
              {shot.visual || '暂无画面描述'}
            </p>
          )}
        </div>

        {/* Details */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 shrink-0 w-10">机位</span>
            <span className="text-gray-700">{shot.angle} · {shot.movement}</span>
          </div>
          {shot.dialogue && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400 shrink-0 w-10">台词</span>
              <span className="text-gray-600 italic" style={{ textAlign: 'left' }}>{shot.dialogue}</span>
            </div>
          )}
          {shot.soundEffect && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400 shrink-0 w-10">音效</span>
              <span className="text-gray-600" style={{ textAlign: 'left' }}>{shot.soundEffect}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
            <span className="text-gray-400">转场：{shot.transition}</span>
            {shot.notes && (
              <span className="text-gray-400 truncate ml-2" title={shot.notes}>📝 {shot.notes}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StoryboardCard({ storyboard, onShotUpdate }: StoryboardCardProps) {
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4">
        {storyboard.scenes.map((scene, sceneIdx) => (
          <div key={scene.sceneNumber} className="mb-6">
            {/* Scene Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${SCENE_COLORS[sceneIdx % SCENE_COLORS.length]}`} />
              <h3 className="text-sm font-semibold text-gray-800">
                场景 {scene.sceneNumber}：{scene.location}
              </h3>
              <span className="text-xs text-gray-400">· {scene.time} · {scene.shots.length} 个镜头</span>
            </div>
            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {scene.shots.map((shot, shotIdx) => (
                <ShotCard
                  key={shot.shotNumber}
                  shot={shot}
                  sceneIdx={sceneIdx}
                  shotIdx={shotIdx}
                  colorClass={SCENE_COLORS[sceneIdx % SCENE_COLORS.length]}
                  onShotUpdate={onShotUpdate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Stats */}
      <div className="flex items-center gap-6 px-4 py-2.5 border-t border-gray-200 bg-white text-xs text-gray-500">
        <span>总镜头数：<strong className="text-gray-800">{storyboard.totalShots}</strong></span>
        <span>总时长：<strong className="text-gray-800">{storyboard.totalDuration}s</strong></span>
        <span>场景数：<strong className="text-gray-800">{storyboard.scenes.length}</strong></span>
      </div>
    </div>
  );
}
