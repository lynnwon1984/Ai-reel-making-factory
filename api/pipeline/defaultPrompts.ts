import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { StageId } from '../../src/lib/types.ts';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve skills directory relative to this file's location
const SKILL_DIR = path.resolve(__dirname, '../../skills');

function loadSkill(stageId: string): string {
  const skillPath = path.join(SKILL_DIR, `${stageId}.md`);
  console.log(`[defaultPrompts] Loading skill: ${stageId} from ${skillPath}`);
  return fs.readFileSync(skillPath, 'utf-8');
}

export function getDefaultPrompt(stageId: StageId): string {
  try {
    const prompt = loadSkill(stageId);
    console.log(`[defaultPrompts] Skill '${stageId}' loaded: ${prompt.length} chars`);
    return prompt;
  } catch (err) {
    console.error(`[defaultPrompts] Failed to load skill '${stageId}':`, err);
    return '';
  }
}

export function getEffectivePrompt(stageId: StageId, customPrompt?: string): string {
  return customPrompt || getDefaultPrompt(stageId);
}
