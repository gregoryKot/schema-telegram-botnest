// «Что делали» в итогах сессии (#1330): серверная копия каталога пунктов.
// Копия shared/src/therapy/sessionWork/, а НЕ импорт: rootDir бэкенда — ./src.
// Ключи, границы и поведение нормализации сверяет session-work.sync.spec.ts.
import { TECHNIQUE_WORK_KEYS } from './session-work-technique-keys';

export const WORK_ITEMS_MAX = 12;
export const WORK_VALUE_MAX = 600;
export const WORK_CUSTOM_NAME_MAX = 80;
export const WORK_IDS_MAX = 12;
export const WORK_ID_MAX = 64;

export interface SessionWorkItem {
  id: string;
  kind: 'technique' | 'exercise' | 'custom';
  refId?: string;
  customName?: string;
  modeIds: string[];
  schemaIds: string[];
  needIds: string[];
  fields: Record<string, string>;
}

/** Ключи полей по виду: `technique:<TechniqueId>`, `exercise:<ExId>`, `custom`. */
export const SESSION_WORK_KEYS: Readonly<Record<string, readonly string[]>> = {
  ...TECHNIQUE_WORK_KEYS,
  'exercise:belief': ['belief', 'evidence', 'result'],
  'exercise:schema': ['learned', 'fresh'],
  'exercise:mode': ['learned', 'fresh'],
  'exercise:letter': ['main', 'reading'],
  'exercise:safe': ['place', 'way', 'after'],
  'exercise:wheel': ['unmet', 'discussed'],
  'exercise:warm': ['words', 'response'],
  'exercise:phrase': ['phrases', 'insight'],
  custom: ['what', 'result'],
};

type Raw = Record<string, unknown>;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function ids(value: unknown): string[] {
  const out: string[] = [];
  for (const id of Array.isArray(value) ? value : []) {
    if (typeof id !== 'string' || !id || id.length > WORK_ID_MAX) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out.slice(0, WORK_IDS_MAX);
}

function catalogKey(raw: Raw): string | null {
  if (raw.kind === 'custom') return 'custom';
  if (raw.kind !== 'technique' && raw.kind !== 'exercise') return null;
  if (typeof raw.refId !== 'string') return null;
  const key = `${raw.kind}:${raw.refId}`;
  return Object.hasOwn(SESSION_WORK_KEYS, key) ? key : null;
}

function toItem(raw: Raw): SessionWorkItem | null {
  const id = text(raw.id, WORK_ID_MAX);
  const key = catalogKey(raw);
  if (!id || !key) return null;
  const given = (raw.fields ?? {}) as Raw;
  const fields: Record<string, string> = {};
  for (const name of SESSION_WORK_KEYS[key]) {
    const value = text(given[name], WORK_VALUE_MAX);
    if (value) fields[name] = value;
  }
  const customName = text(raw.customName, WORK_CUSTOM_NAME_MAX);
  return {
    id,
    kind: raw.kind as SessionWorkItem['kind'],
    modeIds: ids(raw.modeIds),
    schemaIds: ids(raw.schemaIds),
    needIds: ids(raw.needIds),
    fields,
    ...(key === 'custom'
      ? customName && { customName }
      : { refId: raw.refId as string }),
  };
}

/** Канонический вид пунктов: незнакомый вид, техника и ключ поля отбрасываются. */
export function normalizeSessionWork(value: unknown): SessionWorkItem[] {
  const out: SessionWorkItem[] = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const item = raw && typeof raw === 'object' ? toItem(raw as Raw) : null;
    if (item) out.push(item);
  }
  return out.slice(0, WORK_ITEMS_MAX);
}
