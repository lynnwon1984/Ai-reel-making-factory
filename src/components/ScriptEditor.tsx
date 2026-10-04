import { useState, useRef, useCallback } from 'react';

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const SAMPLE_SCRIPT = `【第一幕：咖啡馆 - 日 - 内】

（镜头缓缓推进，阳光透过落地窗洒在木质桌面上。小雨坐在角落，低头看着手机。）

小雨：（轻声）你来了。

李明：（推门而入，略显匆忙）抱歉，路上堵车。

（李明坐下，两人对视片刻。）

小雨：我想了很久，这件事不能再拖了。

李明：（紧张地握紧杯子）你说。

小雨：我要离开这座城市了。

（李明手中的咖啡杯微微颤抖。）

【第二幕：街道 - 夜 - 外】

（小雨独自走在霓虹灯下，身后是喧嚣的城市。镜头从背后缓缓拉远。）

小雨（旁白）：有些告别，注定只能一个人走完。

（她停下脚步，抬头望向天空。远处传来火车的汽笛声。）

【第三幕：火车站 - 晨 - 内】

（小雨拖着行李箱走进大厅。广播响起："前往南方的列车即将发车。"）

（她回头看了一眼，似乎期待某个人出现。人群中没有那张熟悉的面孔。）

（小雨转身走向检票口。镜头定格在她的背影上。）

小雨（旁白）：再见，这座承载了所有回忆的城市。`;

export default function ScriptEditor({ value, onChange }: ScriptEditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  const handleFileUpload = useCallback((file: File) => {
    if (!file.name.match(/\.(txt|md)$/i)) {
      alert('仅支持 .txt 或 .md 文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onChange(text);
    };
    reader.readAsText(file);
  }, [onChange]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  const fillSample = () => onChange(SAMPLE_SCRIPT);
  const clearAll = () => onChange('');

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            📂 上传文件
          </button>
          <button
            onClick={fillSample}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
          >
            📝 示例剧本
          </button>
          <button
            onClick={clearAll}
            disabled={!value}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🗑️ 清空
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
        <div className="text-xs text-gray-400">
          {charCount} 字符 · {wordCount} 词
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          placeholder={'在此粘贴或输入您的剧本文本...\n\n支持拖拽 .txt / .md 文件到此处'}
          className={`w-full h-full resize-none p-4 text-sm leading-relaxed font-mono bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none ${
            isDragging ? 'ring-2 ring-blue-500 ring-inset' : ''
          }`}
          style={{ textAlign: 'left' }}
        />
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 rounded-lg px-6 py-3 text-sm font-medium text-blue-700 shadow-lg">
              释放文件以上传
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
