// Класс «состояние одного клиента протекает в другого при смене клиента»
// (docs/INCIDENTS.md, QA-проход 2026-10-26): хук карточки клиента у
// терапевта держит черновики ввода (текст заметки, дата, имя, даты сессий),
// и любой из них, не сброшенный в openClient, переезжает к следующему
// клиенту — а кнопка «Сохранить» отправляет его уже новому. Ручной список
// «что сбросить» забывает новое поле, поэтому проверка обходит ВСЕ сеттеры,
// которые хук отдаёт наружу: каждый пачкается значением-«чужим черновиком»,
// после смены клиента состояние обязано совпасть с состоянием хука, который
// этого клиента открыл с чистого листа.

const FOREIGN = 'ЧУЖОЙ ЧЕРНОВИК';

type HookResult = Record<string, unknown>;

/** Значение того же вида, что `current`, но заведомо отличное от него. */
function foreignValue(current: unknown): unknown {
  if (typeof current === 'string') return FOREIGN;
  if (typeof current === 'boolean') return !current;
  if (typeof current === 'number') return current + 999;
  if (Array.isArray(current)) return [...current, FOREIGN];
  if (current === null) return 7; // nullable-число (номер раскрытого снимка) — других null с сеттером нет
  if (typeof current === 'object') return { ...current, goals: FOREIGN };
  return FOREIGN;
}

/** `setNewNoteText` → `newNoteText`. */
function valueKeyOf(setter: string): string {
  const rest = setter.slice(3);
  return rest.charAt(0).toLowerCase() + rest.slice(1);
}

/**
 * Зовёт каждый `setX` из результата хука значением «чужого черновика».
 * Возвращает сеттеры, которым не нашлось парного значения `x`: такой
 * сеттер проверкой не покрыт, и тест обязан на этом краснеть, а не молчать.
 */
export function dirtyEverySetter(
  hook: HookResult,
  skip: readonly string[],
): string[] {
  const unmatched: string[] = [];
  for (const [name, fn] of Object.entries(hook)) {
    if (
      !/^set[A-Z]/.test(name) ||
      typeof fn !== 'function' ||
      skip.includes(name)
    )
      continue;
    const key = valueKeyOf(name);
    if (!(key in hook)) {
      unmatched.push(name);
      continue;
    }
    (fn as (v: unknown) => void)(foreignValue(hook[key]));
  }
  return unmatched;
}

/** Всё, что видит экран: значения без функций, ref — его текущим значением. */
export function visibleState(hook: HookResult): HookResult {
  const out: HookResult = {};
  for (const [name, value] of Object.entries(hook)) {
    if (typeof value === 'function') continue;
    const isRef =
      value !== null &&
      typeof value === 'object' &&
      'current' in value &&
      Object.keys(value).length === 1;
    out[name] = isRef ? value.current : value;
  }
  return out;
}
