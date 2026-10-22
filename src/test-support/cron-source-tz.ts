// Часовой пояс из объекта опций `@Cron(выражение, { timeZone })` — для
// сверки CRON_LEASE_REGISTRY с исходниками (cron-lease-registry.spec.ts):
// проба аренд считает тики в той зоне, в которой их исполняет планировщик,
// и зона в реестре обязана совпадать с декоратором (правило №4 CLAUDE.md).
// Вынесено из cron-source-scan.ts: тот стоит в храповике размера.

const TZ_VALUE_RE =
  /\btimeZone\s*:\s*(?:(['"])((?:\\.|(?!\1).)*)\1|([A-Za-z_$][\w$]*))/;

/**
 * `undefined` — в декораторе зоны нет (планировщик берёт зону процесса).
 * Зона есть, но значение не разобрать (вычисляемое выражение, константа из
 * другого файла, сокращённая запись `{ timeZone }`) — возвращается метка
 * `<не разобрано>`: сверка краснеет, а не принимает зону процесса молча.
 */
export function cronTimeZone(
  decoratorSrc: string,
  consts: Map<string, string>,
): string | undefined {
  if (!/\btimeZone\b/.test(decoratorSrc)) return undefined;
  const m = TZ_VALUE_RE.exec(decoratorSrc);
  if (!m) return '<не разобрано>';
  if (m[2] !== undefined) return m[2];
  return consts.get(m[3]) ?? '<не разобрано>';
}
