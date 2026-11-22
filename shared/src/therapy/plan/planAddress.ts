// Источник пункта плана — адрес раздела справочника (#1484). Пункты до адресов хранят вид/id/поле:
// перевод здесь один, его же повторяет SQL миграции plan_source_address (сверка — therapy-plan.types.sync.spec.ts).
// Импорт — только формат и реестр: модуль адресов целиком тянет тексты справочника (guideLoader).
import {
  formatAddress,
  parseAddress,
} from '../../schemaTherapy/guide/address/addressFormat';
import { normalizeAddress } from '../../schemaTherapy/guide/address/addressRenames';
import type { PlanItem, PlanSource } from './planItem';

const OLD_KINDS: ReadonlySet<string> = new Set(['schema', 'mode', 'technique']);

/** Старый источник → адрес (через реестр переименований); null — источника нет или он не адрес. */
export function legacyPlanSourceAddress(
  source: PlanSource | null | undefined,
  renames?: Readonly<Record<string, string>>,
): string | null {
  if (!source || !OLD_KINDS.has(source.kind)) return null;
  const address = formatAddress({
    kind: source.kind,
    articleId: source.id,
    path: source.field,
  });
  return parseAddress(address) ? normalizeAddress(address, renames) : null;
}

/** Адрес раздела, из которого взят пункт: сохранённый или переведённый из старого источника. */
export function planItemAddress(
  item: Pick<PlanItem, 'sourceAddress' | 'source'>,
): string | null {
  return item.sourceAddress ?? legacyPlanSourceAddress(item.source);
}
