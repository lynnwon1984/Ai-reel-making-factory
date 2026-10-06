import { useState } from 'react';
import type { Storyboard, Shot } from '../lib/types';
import { SHOT_TYPES, CAMERA_ANGLES, CAMERA_MOVEMENTS, TRANSITIONS } from '../lib/constants';

interface StoryboardTableProps {
  storyboard: Storyboard | null;
  onShotUpdate?: (shotIdx: number, field: keyof Shot, value: string | number) => void;
}

interface ColumnDef {
  key: keyof Shot;
  label: string;
  width: string;
  editable?: boolean;
  options?: readonly string[];
  visible?: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'shotNumber', label: '镜号', width: 'w-12' },
  { key: 'sceneId', label: '场景', width: 'w-12' },
  { key: 'shotType', label: '景别', width: 'w-20', editable: true, options: SHOT_TYPES },
  { key: 'angle', label: '机位', width: 'w-18', editable: true, options: CAMERA_ANGLES },
  { key: 'movement', label: '运镜', width: 'w-20', editable: true, options: CAMERA_MOVEMENTS },
  { key: 'visual', label: '画面描述', width: 'min-w-[200px]', editable: true },
  { key: 'subject', label: '主体', width: 'min-w-[120px]', editable: true },
  { key: 'action', label: '动作链', width: 'min-w-[120px]', editable: true },
  { key: 'dialogue', label: '台词/旁白', width: 'min-w-[140px]', editable: true },
  { key: 'lighting', label: '灯光', width: 'min-w-[100px]', editable: true },
  { key: 'audio', label: '音频设计', width: 'min-w-[140px]', editable: true },
  { key: 'duration', label: '时长(s)', width: 'w-16', editable: true },
  { key: 'transition', label: '转场', width: 'w-20', editable: true, options: TRANSITIONS },
  { key: 'constraints', label: '约束条件', width: 'min-w-[100px]', editable: true },
  { key: 'notes', label: '备注', width: 'min-w-[100px]', editable: true },
];

const DEFAULT_VISIBLE: (keyof Shot)[] = [
  'shotNumber', 'sceneId', 'shotType', 'angle', 'movement', 'visual',
  'dialogue', 'audio', 'duration', 'transition',
];

function EditableCell({
  value,
  options,
  onSave,
}: {
  value: string | number;
  options?: readonly string[];
  onSave: (v: string | number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(String(value));

  if (editing) {
    if (options) {
      return (
        <select
          value={tempValue}
          onChange={(e) => {
            setTempValue(e.target.value);
            onSave(e.target.value);
            setEditing(false);
          }}
          onBlur={() => {
            onSave(tempValue);
            setEditing(false);
          }}
          autoFocus
          className="text-xs border border-blue-500/40 rounded px-1 py-0.5 bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
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
        className="text-xs border border-blue-500/40 rounded px-1 py-0.5 bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-text hover:bg-gray-700/50 rounded px-1 py-0.5 block min-h-[20px]"
      title="点击编辑"
    >
      {value || '-'}
    </span>
  );
}

export default function StoryboardTable({ storyboard, onShotUpdate }: StoryboardTableProps) {
  const [visibleColumns, setVisibleColumns] = useState<Set<keyof Shot>>(
    new Set(DEFAULT_VISIBLE),
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const toggleColumn = (key: keyof Shot) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const columns = ALL_COLUMNS.filter((c) => visibleColumns.has(c.key));

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
  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);

  // Group shots by sceneId
  const sceneGroups = new Map<number, Shot[]>();
  for (const shot of shots) {
    const id = shot.sceneId;
    if (!sceneGroups.has(id)) sceneGroups.set(id, []);
    sceneGroups.get(id)!.push(shot);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Column picker toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50 bg-gray-800/50">
        <span className="text-xs text-gray-400">
          {shots.length} 个镜头 · {totalDuration}s
        </span>
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="px-2 py-1 text-xs text-gray-400 bg-gray-700/50 rounded hover:bg-gray-700 transition-colors"
          >
            列选择 ▾
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1 max-h-64 overflow-auto">
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-0"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-800 border-b border-gray-700">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${col.width} px-2 py-2 text-left font-semibold text-gray-400 border-r border-gray-700/50 last:border-r-0`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(sceneGroups.entries()).map(([sceneId, sceneShots]) => (
              <SceneGroup
                key={sceneId}
                sceneId={sceneId}
                shots={sceneShots}
                columns={columns}
                onShotUpdate={onShotUpdate}
                allShots={shots}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-6 px-4 py-2 border-t border-gray-700/50 bg-gray-800/50 text-xs text-gray-500">
        <span>
          总镜头数：<strong className="text-gray-300">{shots.length}</strong>
        </span>
        <span>
          总时长：<strong className="text-gray-300">{totalDuration}s</strong>
        </span>
        <span>
          场景数：<strong className="text-gray-300">{sceneGroups.size}</strong>
        </span>
      </div>
    </div>
  );
}

function SceneGroup({
  sceneId,
  shots,
  columns,
  onShotUpdate,
  allShots,
}: {
  sceneId: number;
  shots: Shot[];
  columns: ColumnDef[];
  onShotUpdate?: (shotIdx: number, field: keyof Shot, value: string | number) => void;
  allShots: Shot[];
}) {
  return (
    <>
      {/* Scene Header */}
      <tr className="bg-indigo-950/30 border-y border-indigo-500/20">
        <td colSpan={columns.length} className="px-3 py-1.5">
          <span className="font-semibold text-indigo-400 text-xs">场景 {sceneId}</span>
          <span className="text-indigo-500/60 ml-2 text-xs">{shots.length} 个镜头</span>
        </td>
      </tr>
      {/* Shots */}
      {shots.map((shot) => {
        const globalIdx = allShots.indexOf(shot);
        return (
          <tr
            key={shot.shotNumber}
            className="border-b border-gray-700/30 hover:bg-gray-800/50 transition-colors"
          >
            {columns.map((col) => (
              <td
                key={col.key}
                className={`${col.width} px-2 py-1.5 border-r border-gray-700/20 last:border-r-0 text-gray-400`}
              >
                {col.editable && onShotUpdate ? (
                  <EditableCell
                    value={shot[col.key] as string | number}
                    options={col.options}
                    onSave={(v) => onShotUpdate(globalIdx, col.key, v)}
                  />
                ) : (
                  <span>{shot[col.key] as string | number}</span>
                )}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}
