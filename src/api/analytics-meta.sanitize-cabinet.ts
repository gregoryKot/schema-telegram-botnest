import {
  SEARCH_RESULT_KINDS,
  TASK_ASSIGN_SOURCES,
} from '../analytics/cabinet-events.constants';
import { sanitizePathMeta } from './analytics-meta.sanitize-path';
import { PLAN_RUBRICS } from '../therapy/therapy-plan.types';

type Meta = Record<string, unknown>;

const RUBRIC_SET = new Set<string>(PLAN_RUBRICS);
const TASK_SOURCE_SET = new Set<string>(TASK_ASSIGN_SOURCES);
const SEARCH_KIND_SET = new Set<string>(SEARCH_RESULT_KINDS);
const SESSION_WORK_KINDS = ['technique', 'exercise', 'custom'];

// Заметка «О клиенте»: только длина и «очистил», сам текст в meta не едет.
function sanitizeMemoSaved(meta: Meta): Meta | undefined {
  const { length, cleared } = meta;
  if (!Number.isInteger(length) || typeof cleared !== 'boolean')
    return undefined;
  return { length: Math.min(Math.max(length as number, 0), 5000), cleared };
}

// «Что делали» в итогах сессии: число пунктов и виды, без названий и текста.
function sanitizeSessionWork(meta: Meta): Meta | undefined {
  const { items, kinds } = meta;
  if (!Number.isInteger(items) || !Array.isArray(kinds)) return undefined;
  return {
    items: Math.min(Math.max(items as number, 1), 12),
    kinds: SESSION_WORK_KINDS.filter((k) => kinds.includes(k)),
  };
}

/** События, чью meta разбирает sanitizeCabinetMeta. */
export const hasCabinetMeta = (name: string): boolean =>
  /^(cabinet_session_work|cabinet_client_memo_saved|task_assign_source|search_result_open|therapy_plan_item_\w+|therapy_path_\w+|therapy_plan_session_marked)$/.test(
    name,
  );

// События кабинета терапевта с meta (правило №7/№8): только известные поля и только значения
// из allow-list; чего-то нет или оно чужое — meta отбрасывается целиком. Текст пункта плана,
// клиент и статья справочника сюда не попадают.
export function sanitizeCabinetMeta(
  name: string,
  meta: Meta,
): Meta | undefined {
  if (name === 'cabinet_session_work') return sanitizeSessionWork(meta);
  if (name === 'cabinet_client_memo_saved') return sanitizeMemoSaved(meta);
  if (name === 'therapy_plan_item_added') {
    const { rubric, fromGuide } = meta;
    if (typeof rubric !== 'string' || !RUBRIC_SET.has(rubric)) return undefined;
    return typeof fromGuide === 'boolean' ? { rubric, fromGuide } : undefined;
  }
  if (
    /^(therapy_path_|therapy_plan_session_marked|therapy_plan_item_status)/.test(
      name,
    )
  )
    return sanitizePathMeta(name, meta);
  if (name === 'task_assign_source') {
    const { source } = meta;
    return typeof source === 'string' && TASK_SOURCE_SET.has(source)
      ? { source }
      : undefined;
  }
  if (name === 'search_result_open') {
    // Вид результата, «был ли запрос» и «из недавнего»; сам запрос сюда не доходит.
    // Клиент старой сборки поля recent не шлёт — это «не из недавнего».
    const { kind, typed, recent } = meta;
    if (typeof kind !== 'string' || !SEARCH_KIND_SET.has(kind))
      return undefined;
    return typeof typed === 'boolean'
      ? { kind, typed, recent: recent === true }
      : undefined;
  }
  return undefined;
}
