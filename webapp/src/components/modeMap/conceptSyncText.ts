// Тексты строки связи холста с концептуализацией (#963). Без обращения и без рода — ни ты/вы,
// ни «добавил(а)»; имена режимов и схем — из справочника сайта, а не id.
import { getModeById, getSchemaById } from '../../schemaTherapyData';
import type { ConceptAppendBody } from '../../../../shared/src/therapy/conceptAppend';
import type { ConceptMissing } from './conceptSync';
import type { ConceptSyncState } from './conceptSyncContext';

export type SyncLineState = 'off' | 'couple' | 'error' | 'loading' | 'failed' | 'added' | 'missing' | 'synced';
/** text — строка в одну линию; full — она же со всеми именами (title и раскрытие по тапу), есть только у списков. */
export interface SyncLineView { state: SyncLineState; text: string; full?: string; action?: 'retry' | 'add' }

const MAX_NAMES = 3;
const modeName = (id: string) => getModeById(id)?.name ?? id;
const schemaName = (id: string) => getSchemaById(id)?.name ?? id;

/** «A, B, C и ещё 2»: строка над холстом не растёт вместе с концептуализацией; max = Infinity — все имена. */
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
 * Что сказать над холстом: ошибка записи, загрузка, «Добавлено…» (гаснет после «Добавить на карту»), «Нет на
 * карте N…» (обе части в одну строку, если вместе), иначе «Совпадает». Число впереди: хвост режет многоточие.
 */
export function syncLineView(s: ViewInput): SyncLineView {
  if (!s.active) return { state: 'off', text: '' };
  if (s.couple) return { state: 'couple', text: 'Карта пары в концептуализацию не пишет' };
  if (s.status === 'failed') return { state: 'error', text: 'Не записалось в концептуализацию', action: 'retry' };
  if (s.concept === null) return { state: 'loading', text: '' };
  if (s.concept === 'failed' || !s.missing) return { state: 'failed', text: 'Концептуализация не загрузилась' };
  const missing = missingNames(s.missing);
  const line = (max: number) => [
    s.lastAdded && `Добавлено в концептуализацию: ${listNames(addedNames(s.lastAdded), max)}`,
    missing.length && `Нет на карте ${missing.length} из концептуализации: ${listNames(missing, max)}`,
  ].filter(Boolean).join('. ');
  const text = line(MAX_NAMES);
  if (missing.length) return { state: 'missing', text, full: line(Infinity), action: 'add' };
  if (s.lastAdded) return { state: 'added', text, full: line(Infinity) };
  return { state: 'synced', text: 'Карта совпадает с концептуализацией' };
}
