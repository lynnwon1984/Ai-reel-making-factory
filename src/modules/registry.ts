import type { ProjectModuleDefinition } from './types';
import overseasDramaVertical from './overseas-drama-vertical/config';
import domesticDramaVertical from './domestic-drama-vertical/config';
import domesticDramaHorizontal from './domestic-drama-horizontal/config';
import animeVertical from './anime-vertical/config';
import animeHorizontal from './anime-horizontal/config';

const MODULES: ProjectModuleDefinition[] = [
  overseasDramaVertical,
  domesticDramaVertical,
  domesticDramaHorizontal,
  animeVertical,
  animeHorizontal,
];

export function getModule(id: string): ProjectModuleDefinition | undefined {
  return MODULES.find(m => m.id === id);
}

export function getAllModules(): ProjectModuleDefinition[] {
  return MODULES;
}
