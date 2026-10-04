import type { Storyboard } from '../lib/types';

export function exportToJSON(storyboard: Storyboard): string {
  return JSON.stringify(storyboard, null, 2);
}

export function exportToMarkdown(storyboard: Storyboard): string {
  const lines: string[] = [];
  lines.push(`# ${storyboard.title}`);
  lines.push('');
  lines.push(`> 总镜头数：${storyboard.totalShots} | 总时长：${storyboard.totalDuration}s | 场景数：${storyboard.scenes.length}`);
  lines.push('');
  lines.push(`## 概要`);
  lines.push('');
  lines.push(storyboard.summary);
  lines.push('');

  for (const scene of storyboard.scenes) {
    lines.push(`---`);
    lines.push('');
    lines.push(`## 场景 ${scene.sceneNumber}：${scene.location} · ${scene.time}`);
    lines.push('');
    lines.push(`**角色：** ${scene.characters.join('、')}`);
    lines.push(`**时长：** ${scene.sceneDuration}s`);
    lines.push('');

    for (const shot of scene.shots) {
      lines.push(`### 镜头 #${shot.shotNumber}`);
      lines.push('');
      lines.push(`| 属性 | 内容 |`);
      lines.push(`|------|------|`);
      lines.push(`| 景别 | ${shot.shotType} |`);
      lines.push(`| 机位 | ${shot.angle} |`);
      lines.push(`| 运镜 | ${shot.movement} |`);
      lines.push(`| 时长 | ${shot.duration}s |`);
      lines.push(`| 转场 | ${shot.transition} |`);
      lines.push('');
      lines.push(`**画面描述：** ${shot.visual}`);
      if (shot.dialogue) lines.push(`**台词：** ${shot.dialogue}`);
      if (shot.soundEffect) lines.push(`**音效：** ${shot.soundEffect}`);
      if (shot.notes) lines.push(`**备注：** ${shot.notes}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJSON(storyboard: Storyboard) {
  downloadFile(exportToJSON(storyboard), `${storyboard.title || 'storyboard'}.json`, 'application/json');
}

export function downloadMarkdown(storyboard: Storyboard) {
  downloadFile(exportToMarkdown(storyboard), `${storyboard.title || 'storyboard'}.md`, 'text/markdown');
}
