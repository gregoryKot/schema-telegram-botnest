import { parseAddress, type GuideArticleKind } from './addressFormat';

/** Куда ложится отметка «Про клиента»: копинг — в схему случая, прочее — в таблицу GuideMark. */
export type GuideAddressTarget = 'schemaLinks' | 'guideMark';

export interface GuideAddressTargetRule {
  kind: GuideArticleKind;
  /** Начало пути раздела: `coping.` — все стили копинга. */
  pathPrefix: string;
  target: Exclude<GuideAddressTarget, 'guideMark'>;
}

/**
 * Таблица смыслов адреса (#1484). Новый вид смысла — строка здесь;
 * адрес без строки идёт в `guideMark`, поэтому новый раздел работает сразу.
 */
export const GUIDE_ADDRESS_TARGETS: readonly GuideAddressTargetRule[] = [
  { kind: 'schema', pathPrefix: 'coping.', target: 'schemaLinks' },
];

export function addressTarget(address: string): GuideAddressTarget {
  const parts = parseAddress(address);
  if (!parts) return 'guideMark';
  const rule = GUIDE_ADDRESS_TARGETS.find(
    (r) => r.kind === parts.kind && parts.path.startsWith(r.pathPrefix),
  );
  return rule?.target ?? 'guideMark';
}
