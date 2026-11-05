import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../../utils/storageKeys';
import { readLocalIds } from './schemasModel';

// Единственный писатель локальных копий «моих» схем и режимов: зеркало
// User.mySchemaIds / myModeIds (GET /api/profile, PATCH /api/settings).
// Остальные места зовут эти функции, а не localStorage напрямую.

export function cacheMySchemaIds(ids: string[]): void {
  localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(ids));
}

export function cacheMyModeIds(ids: string[]): void {
  localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(ids));
}

export function readMySchemaIds(): string[] {
  return readLocalIds(localStorage.getItem(MY_SCHEMA_IDS_KEY));
}

export function readMyModeIds(): string[] {
  return readLocalIds(localStorage.getItem(MY_MODE_IDS_KEY));
}
