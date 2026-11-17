import { workFields } from './fields';
import {
  SESSION_WORK_KINDS,
  WORK_CUSTOM_NAME_MAX,
  WORK_FIELDS_MAX,
  WORK_ID_MAX,
  WORK_IDS_MAX,
  WORK_ITEMS_MAX,
  WORK_VALUE_MAX,
  type SessionWorkItem,
} from './types';

const cut = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

function idList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const ids = v.filter(
    (x): x is string =>
      typeof x === 'string' && x !== '' && x.length <= WORK_ID_MAX,
  );
  return [...new Set(ids)].slice(0, WORK_IDS_MAX);
}

function normalizeItem(raw: unknown): SessionWorkItem | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = cut(r.id, WORK_ID_MAX);
  const kind = SESSION_WORK_KINDS.find((k) => k === r.kind);
  if (!id || !kind) return null;
  const defs = workFields(kind, r.refId);
  if (!defs) return null;
  const src = (
    r.fields !== null && typeof r.fields === 'object' ? r.fields : {}
  ) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const [key] of defs.slice(0, WORK_FIELDS_MAX)) {
    const text = cut(src[key], WORK_VALUE_MAX);
    if (text) fields[key] = text;
  }
  const item: SessionWorkItem = {
    id,
    kind,
    modeIds: idList(r.modeIds),
    schemaIds: idList(r.schemaIds),
    needIds: idList(r.needIds),
    fields,
  };
  const name = cut(r.customName, WORK_CUSTOM_NAME_MAX);
  if (kind !== 'custom') item.refId = r.refId as string;
  else if (name) item.customName = name;
  return item;
}

/**
 * Пункты «Что делали» в каноническом виде: незнакомый вид, техника или ключ
 * поля отбрасываются, пустые поля не хранятся, лишнее режется по границам.
 * Зовётся перед отправкой и при чтении; бэкенд делает то же своей копией.
 */
export function normalizeSessionWork(raw: unknown): SessionWorkItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeItem)
    .filter((x): x is SessionWorkItem => x !== null)
    .slice(0, WORK_ITEMS_MAX);
}
