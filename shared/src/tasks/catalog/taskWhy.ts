// «Зачем» у задания из справочника — текст для клиента (экран «Задания») и для терапевта в разделе
// «Из справочника». Ключ — id записи каталога (catalogTaskId, он же UserTask.catalogId): сверка с
// каталогом — taskWhy.test.ts, с реестром бэкенда — src/therapy/task-catalog-ids.parity.spec.ts.
import { buildModeTaskWhy } from './taskWhyModes';
import { buildSchemaTaskWhy } from './taskWhySchemas';

export type WhyTr = (ty: string, vy: string) => string;

export function buildTaskWhy(tr: WhyTr): Record<string, string> {
  return { ...buildModeTaskWhy(tr), ...buildSchemaTaskWhy(tr) };
}

/** «Зачем» по id каталога; задание не из каталога или незнакомый id — null. */
export function taskWhy(
  catalogId: string | null | undefined,
  tr: WhyTr,
): string | null {
  if (!catalogId) return null;
  const all = buildTaskWhy(tr);
  return Object.hasOwn(all, catalogId) ? all[catalogId] : null;
}

/** Текст задания из каталога у клиента: первая строка — название, остальное — «что делать». */
export function catalogTaskParts(text: string): {
  title: string;
  what: string;
} {
  const [title, ...rest] = text.trim().split('\n');
  return { title: title.trim(), what: rest.join('\n').trim() };
}

/** Текст взят из каталога, пока его не стёрли целиком: дописанное задание остаётся заданием каталога. */
export function catalogIdAfterEdit(
  catalogId: string | null,
  text: string,
): string | null {
  return text.trim() === '' ? null : catalogId;
}
