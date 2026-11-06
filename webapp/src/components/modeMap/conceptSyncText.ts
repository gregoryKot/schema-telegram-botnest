// Тексты строки связи холста с концептуализацией (#963). Без обращения и без
// рода — ни ты/вы, ни «добавил(а)»; имена режимов и схем — из справочника
// сайта, а не id.
import { getModeById, getSchemaById } from '../../schemaTherapyData';
import type { ConceptAppendBody } from '../../../../shared/src/therapy/conceptAppend';
import type { ConceptMissing } from './conceptSync';
import type { ConceptSyncState } from './conceptSyncContext';

export type SyncLineState = 'off' | 'couple' | 'error' | 'loading' | 'failed' | 'added' | 'missing' | 'synced';
export interface SyncLineView { state: SyncLineState; text: string; action?: 'retry' | 'add' }

const MAX_NAMES = 3;
const modeName = (id: string) => getModeById(id)?.name ?? id;
const schemaName = (id: string) => getSchemaById(id)?.name ?? id;

/** «A, B, C и ещё 2»: строка над холстом не растёт вместе с концептуализацией. */
export function listNames(names: readonly string[], max = MAX_NAMES): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} и ещё ${names.length - max}`;
}

export function addedNames(body: ConceptAppendBody): string[] {
  return [
    ...(body.modeIds ?? []).map(modeName),
    ...(body.schemaIds ?? []).map(schemaName),
    ...(body.modeLinks ?? []).flatMap((l) => l.schemaIds.map((s) => `${schemaName(s)} → ${modeName(l.modeId)}`)),
  ];
}

export const missingNames = (m: ConceptMissing): string[] => [...m.modeIds.map(modeName), ...m.schemaIds.map(schemaName)];

type ViewInput = Pick<ConceptSyncState, 'active' | 'couple' | 'concept' | 'missing' | 'status' | 'lastAdded'>;

/**
 * Что сказать над холстом. Порядок: ошибка записи, затем загрузка, затем
 * «Добавлено…» (гаснет после «Добавить на карту»), «есть, на карте нет» —
 * обе части в одну строку, если случились вместе, — и «Совпадает».
 */
export function syncLineView(s: ViewInput): SyncLineView {
  if (!s.active) return { state: 'off', text: '' };
  if (s.couple) return { state: 'couple', text: 'Карта пары в концептуализацию не пишет' };
  if (s.status === 'failed') return { state: 'error', text: 'Не записалось в концептуализацию', action: 'retry' };
  if (s.concept === null) return { state: 'loading', text: '' };
  if (s.concept === 'failed' || !s.missing) return { state: 'failed', text: 'Концептуализация не загрузилась' };
  const added = s.lastAdded ? `Добавлено в концептуализацию: ${listNames(addedNames(s.lastAdded))}` : '';
  const missing = missingNames(s.missing);
  if (missing.length) {
    const text = `В концептуализации есть, на карте нет: ${listNames(missing)}`;
    return { state: 'missing', text: added ? `${added}. ${text}` : text, action: 'add' };
  }
  if (added) return { state: 'added', text: added };
  return { state: 'synced', text: 'Совпадает с концептуализацией' };
}
