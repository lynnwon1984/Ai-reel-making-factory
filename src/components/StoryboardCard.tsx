import { useState } from 'react';
import type { Storyboard, Shot, SeedancePrompt } from '../lib/types';

interface StoryboardCardProps {
  storyboard: Storyboard | null;
  onShotUpdate?: (shotIdx: number, field: keyof Shot, value: string | number) => void;
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
  shotIdx,
  colorClass,
  seedancePrompt,
  onShotUpdate,
}: {
  shot: Shot;
  shotIdx: number;
  colorClass: string;
  seedancePrompt?: SeedancePrompt;
  onShotUpdate?: (shotIdx: number, field: keyof Shot, value: string | number) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showSeedance, setShowSeedance] = useState(false);

  const startEdit = (field: string, value: string) => {
    setEditing(field);
    setEditValue(value);
  };

  const saveEdit = (field: keyof Shot) => {
    if (onShotUpdate) {
      onShotUpdate(shotIdx, field, editValue);
    }
    setEditing(null);
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden hover:border-gray-600/50 transition-all">
      {/* Color Bar */}
      <div className={`h-1 bg-gradient-to-r ${colorClass}`} />

      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-300 bg-gray-700/50 px-2 py-0.5 rounded">
              #{shot.shotNumber}
            </span>
            <span className="text-xs text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded font-medium">
              {shot.shotType}
            </span>
          </div>
          <span className="text-xs text-gray-500">{shot.duration}s</span>
        </div>

        {/* Visual Description */}
        <div
          className="mb-2.5 p-2 bg-gray-900/50 rounded-md min-h-[50px] cursor-text hover:bg-gray-900/70 transition-colors"
          onClick={() => startEdit('visual', shot.visual)}
        >
          {editing === 'visual' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveEdit('visual')}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(null);
              }}
              autoFocus
              className="w-full text-xs bg-gray-800 border border-blue-500/40 rounded p-1.5 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              rows={3}
            />
          ) : (
            <p className="text-xs text-gray-400 leading-relaxed" style={{ textAlign: 'left' }}>
              {shot.visual || '暂无画面描述'}
            </p>
          )}
        </div>

        {/* Details */}
        <div className="space-y-1 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-gray-500 shrink-0 w-10">机位</span>
            <span className="text-gray-400">{shot.angle} · {shot.movement}</span>
          </div>
          {shot.subject && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0 w-10">主体</span>
              <span className="text-gray-400" style={{ textAlign: 'left' }}>{shot.subject}</span>
            </div>
          )}
          {shot.dialogue && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0 w-10">台词</span>
              <span className="text-gray-400 italic" style={{ textAlign: 'left' }}>{shot.dialogue}</span>
            </div>
          )}
          {shot.lighting && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0 w-10">灯光</span>
              <span className="text-gray-400" style={{ textAlign: 'left' }}>{shot.lighting}</span>
            </div>
          )}
          {shot.audio && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0 w-10">音频</span>
              <span className="text-gray-400" style={{ textAlign: 'left' }}>{shot.audio}</span>
            </div>
          )}
          {shot.constraints && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0 w-10">约束</span>
              <span className="text-gray-400" style={{ textAlign: 'left' }}>{shot.constraints}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-700/30">
            <span className="text-gray-500">转场：{shot.transition}</span>
            {seedancePrompt && (
              <button
                onClick={() => setShowSeedance(!showSeedance)}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {showSeedance ? '收起 Prompt' : 'Seedance Prompt'}
              </button>
            )}
          </div>
        </div>

        {/* Seedance Prompt Preview */}
        {showSeedance && seedancePrompt && (
          <div className="mt-2 p-2 bg-cyan-950/20 border border-cyan-500/20 rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-cyan-400 font-medium">
                {seedancePrompt.timestampRange ?? seedancePrompt.shotLabel ?? `镜头 ${seedancePrompt.shotNumber}`}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(seedancePrompt.promptText)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                复制
              </button>
            </div>
            <p className="text-xs text-gray-400 font-mono leading-relaxed" style={{ textAlign: 'left' }}>
              {seedancePrompt.promptText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StoryboardCard({ storyboard, onShotUpdate }: StoryboardCardProps) {
  if (!storyboard) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">🎬</div>
          <p>暂无分镜数据</p>
          <p className="text-xs mt-1">请先输入剧本并执行转译</p>
        </div>
      </div>
    );
  }

  const shots = storyboard.shots;

  // Group shots by sceneId
  const sceneGroups = new Map<number, Shot[]>();
  for (const shot of shots) {
    const id = shot.sceneId;
    if (!sceneGroups.has(id)) sceneGroups.set(id, []);
    sceneGroups.get(id)!.push(shot);
  }

  // Build seedance prompt lookup
  const seedanceByShot = new Map<number, SeedancePrompt>();
  for (const sp of storyboard.seedancePrompts) {
    seedanceByShot.set(sp.shotNumber, sp);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-3">
        {Array.from(sceneGroups.entries()).map(([sceneId, sceneShots], sceneIdx) => (
          <div key={sceneId} className="mb-5">
            {/* Scene Header */}
            <div className="flex items-center gap-3 mb-2.5">
              <div
                className={`w-3 h-3 rounded-full bg-gradient-to-r ${SCENE_COLORS[sceneIdx % SCENE_COLORS.length]}`}
              />
              <h3 className="text-sm font-semibold text-gray-300">场景 {sceneId}</h3>
              <span className="text-xs text-gray-500">{sceneShots.length} 个镜头</span>
            </div>
            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {sceneShots.map((shot) => {
                const globalIdx = shots.indexOf(shot);
                return (
                  <ShotCard
                    key={shot.shotNumber}
                    shot={shot}
                    shotIdx={globalIdx}
                    colorClass={SCENE_COLORS[sceneIdx % SCENE_COLORS.length]}
                    seedancePrompt={seedanceByShot.get(shot.shotNumber)}
                    onShotUpdate={onShotUpdate}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Stats */}
      <div className="flex items-center gap-6 px-4 py-2 border-t border-gray-700/50 bg-gray-800/50 text-xs text-gray-500">
        <span>
          总镜头数：<strong className="text-gray-300">{shots.length}</strong>
        </span>
        <span>
          总时长：<strong className="text-gray-300">{shots.reduce((s, sh) => s + sh.duration, 0)}s</strong>
        </span>
        <span>
          场景数：<strong className="text-gray-300">{sceneGroups.size}</strong>
        </span>
      </div>
    </div>
  );
}
