import type { Storyboard, SeedancePrompt, PurifiedScript } from '../lib/types';

export function exportToJSON(storyboard: Storyboard): string {
  return JSON.stringify(storyboard, null, 2);
}

export function exportToMarkdown(storyboard: Storyboard): string {
  const lines: string[] = [];
  const title = storyboard.metadata.title;
  const shots = storyboard.shots;
  const totalDuration = shots.reduce((s, sh) => s + sh.duration, 0);

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> 总镜头数：${shots.length} | 总时长：${totalDuration}s | Seedance ${storyboard.metadata.seedanceVersion}`);
  lines.push('');

  // Quality report
  const qr = storyboard.qualityReport;
  if (qr) {
    lines.push(`## 质检报告`);
    lines.push('');
    lines.push(`- 质量评分：${qr.seedanceQualityScore}/100`);
    lines.push(`- 总镜头数：${qr.totalShots}`);
    lines.push(`- 总时长：${qr.totalDuration}s`);
    if (qr.continuityIssues.length > 0) {
      lines.push(`- 连贯性问题：${qr.continuityIssues.join('；')}`);
    }
    lines.push('');
  }

  // Group shots by sceneId
  const sceneGroups = new Map<number, typeof shots>();
  for (const shot of shots) {
    const id = shot.sceneId;
    if (!sceneGroups.has(id)) sceneGroups.set(id, []);
    sceneGroups.get(id)!.push(shot);
  }

  // Seedance prompt lookup
  const seedanceByShot = new Map<number, SeedancePrompt>();
  for (const sp of storyboard.seedancePrompts) {
    seedanceByShot.set(sp.shotNumber, sp);
  }

  for (const [sceneId, sceneShots] of sceneGroups.entries()) {
    lines.push(`---`);
    lines.push('');
    lines.push(`## 场景 ${sceneId}（${sceneShots.length} 个镜头）`);
    lines.push('');

    for (const shot of sceneShots) {
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
      if (shot.subject) lines.push(`**主体：** ${shot.subject}`);
      if (shot.action) lines.push(`**动作链：** ${shot.action}`);
      if (shot.dialogue) lines.push(`**台词：** ${shot.dialogue}`);
      if (shot.lighting) lines.push(`**灯光：** ${shot.lighting}`);
      if (shot.audio) lines.push(`**音频设计：** ${shot.audio}`);
      if (shot.constraints) lines.push(`**约束条件：** ${shot.constraints}`);
      if (shot.notes) lines.push(`**备注：** ${shot.notes}`);

      // Seedance prompt
      const sp = seedanceByShot.get(shot.shotNumber);
      if (sp) {
        lines.push('');
        lines.push(`**Seedance Prompt (${sp.format})：**`);
        lines.push('```');
        lines.push(sp.promptText);
        lines.push('```');
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function exportSeedancePrompts(prompts: SeedancePrompt[], version: string): void {
  const filtered = prompts.filter((p) => p.format === version);
  const content = filtered
    .map((p) => {
      const header = p.timestampRange ?? p.shotLabel ?? `镜头 ${p.shotNumber}`;
      return `--- ${header} (镜号: ${p.shotNumber}, 场景: ${p.sceneId}, 时长: ${p.duration}s) ---\n\n${p.promptText}`;
    })
    .join('\n\n\n');
  downloadFile(content, `seedance-prompts-${version}.txt`, 'text/plain');
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
  downloadFile(exportToJSON(storyboard), `${storyboard.metadata.title || 'storyboard'}.json`, 'application/json');
}

export function downloadMarkdown(storyboard: Storyboard) {
  downloadFile(exportToMarkdown(storyboard), `${storyboard.metadata.title || 'storyboard'}.md`, 'text/markdown');
}

export function exportPurifiedScript(fullText: string, projectName: string): void {
  const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName || '未命名项目'}_净化剧本.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAuditReport(
  purifiedScript: PurifiedScript,
  projectName: string,
): void {
  const lines: string[] = [];
  lines.push(`# ${projectName} — 审计报告\n`);

  // Part 1: 审计摘要
  lines.push(`## 审计摘要\n`);
  lines.push(`- 原始行数：${purifiedScript.auditNotes.originalLineCount}`);
  lines.push(`- 净化后行数：${purifiedScript.auditNotes.purifiedLineCount}`);
  lines.push(`- 去重段落：${purifiedScript.auditNotes.duplicatesRemoved}`);
  lines.push(`- 噪音标记清除：${purifiedScript.auditNotes.noiseMarkersRemoved}`);
  lines.push(`- 场景合并：${purifiedScript.auditNotes.scenesMerged}`);
  lines.push(`- 总场景数：${purifiedScript.totalScenes}`);
  lines.push(`- 角色列表：${purifiedScript.characterNames.join('、')}\n`);

  // Part 2: 逻辑断链检测
  if (purifiedScript.logicIssues && purifiedScript.logicIssues.length > 0) {
    lines.push(`## 逻辑断链检测（${purifiedScript.logicIssues.length} 项）\n`);
    purifiedScript.logicIssues.forEach((issue, i) => {
      lines.push(`### ${i + 1}. [${issue.severity}] ${issue.type}`);
      lines.push(`**位置**：${issue.location}`);
      lines.push(`**描述**：${issue.description}`);
      lines.push(`**建议**：${issue.suggestion}\n`);
    });
  } else {
    lines.push(`## 逻辑断链检测\n`);
    lines.push(`未检测到逻辑断链问题。\n`);
  }

  // Part 3: 净化后连续剧本
  lines.push(`## 净化后连续剧本\n`);
  lines.push(purifiedScript.fullText);

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName || '未命名项目'}_审计报告.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
