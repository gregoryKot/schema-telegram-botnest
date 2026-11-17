import { PLAN_RUBRICS, PLAN_STATUSES } from '../therapy/therapy-plan.types';

type Meta = Record<string, unknown>;

const RUBRIC_SET = new Set<string>(PLAN_RUBRICS);
const STATUS_SET = new Set<string>(PLAN_STATUSES);
const SESSION_WORK_KINDS = ['technique', 'exercise', 'custom'];

// «Что делали» в итогах сессии: число пунктов и виды, без названий и текста.
function sanitizeSessionWork(meta: Meta): Meta | undefined {
  const { items, kinds } = meta;
  if (!Number.isInteger(items) || !Array.isArray(kinds)) return undefined;
  return {
    items: Math.min(Math.max(items as number, 1), 12),
    kinds: SESSION_WORK_KINDS.filter((k) => kinds.includes(k)),
  };
}

// События кабинета терапевта с meta (правило №7/№8): только известные поля и только значения
// из allow-list; чего-то нет или оно чужое — meta отбрасывается целиком. Текст пункта плана,
// клиент и статья справочника сюда не попадают.
export function sanitizeCabinetMeta(
  name: string,
  meta: Meta,
): Meta | undefined {
  if (name === 'cabinet_session_work') return sanitizeSessionWork(meta);
  if (name === 'therapy_plan_item_added') {
    const { rubric, fromGuide } = meta;
    if (typeof rubric !== 'string' || !RUBRIC_SET.has(rubric)) return undefined;
    return typeof fromGuide === 'boolean' ? { rubric, fromGuide } : undefined;
  }
  if (name === 'therapy_plan_item_status') {
    const { status } = meta;
    return typeof status === 'string' && STATUS_SET.has(status)
      ? { status }
      : undefined;
  }
  return undefined;
}
