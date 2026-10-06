import fs from 'fs';
import path from 'path';
import type { StageId } from '../../src/lib/types.ts';

const SKILL_DIR = path.join(process.cwd(), 'skills');

function loadSkill(stageId: string): string {
  const skillPath = path.join(SKILL_DIR, `${stageId}.md`);
  return fs.readFileSync(skillPath, 'utf-8');
}

export function getDefaultPrompt(stageId: StageId): string {
  try {
    return loadSkill(stageId);
  } catch {
    return '';
  }
}

export function getEffectivePrompt(stageId: StageId, customPrompt?: string): string {
  return customPrompt || getDefaultPrompt(stageId);
}
