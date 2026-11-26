import {
  PATH_ITEMS_MAX,
  PATH_PHASE_KEYS,
  PATH_TEMPLATE_IDS,
} from '../analytics/path-events.constants';
import { PLAN_STATUSES } from '../therapy/therapy-plan.types';

type Meta = Record<string, unknown>;

const TEMPLATE_SET = new Set<string>(PATH_TEMPLATE_IDS);
const STATUS_SET = new Set<string>(PLAN_STATUSES);
const PHASE_SET = new Set<string>(PATH_PHASE_KEYS);

const count = (v: unknown, min: number): number | undefined =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= PATH_ITEMS_MAX
    ? (v as number)
    : undefined;

/** События пути клиента с meta; чужое поле или значение — meta отбрасывается (правило №7). */
export function sanitizePathMeta(name: string, meta: Meta): Meta | undefined {
  if (name === 'therapy_path_created') {
    const { template } = meta;
    return typeof template === 'string' && TEMPLATE_SET.has(template)
      ? { template }
      : undefined;
  }
  if (
    name === 'therapy_path_phase_started' ||
    name === 'therapy_path_phase_finished'
  ) {
    const { phase } = meta;
    return typeof phase === 'string' && PHASE_SET.has(phase)
      ? { phase }
      : undefined;
  }
  if (name === 'therapy_plan_item_status') {
    // inPhase — пункт лежит в фазе пути; у событий старой сборки поля нет.
    const { status, inPhase } = meta;
    if (typeof status !== 'string' || !STATUS_SET.has(status)) return undefined;
    return typeof inPhase === 'boolean' ? { status, inPhase } : { status };
  }
  if (name === 'therapy_path_draft_built') {
    const picked = count(meta.picked, 0);
    return picked === undefined ? undefined : { picked };
  }
  if (name === 'therapy_plan_session_marked') {
    const items = count(meta.items, 1);
    return items === undefined ? undefined : { items };
  }
  return undefined;
}
