import type { ModeMapKind, ModeMapMeta } from '../../api';

// Типы графических карт клиента (вкладка «Графические карты», #963): подписи,
// порядок в выборе типа и заголовок новой карты. Один реестр на меню «Новая
// карта», экран «нет карт» и подсказку типа на вкладке карты.

/** Порядок типов в меню «Новая карта» и на экране «нет карт». */
export const MAP_KINDS: ModeMapKind[] = ['concept', 'personality', 'problem', 'couple', 'free'];

// `personality` в базе — бывшая «Карта личности»: подпись сменилась, старые
// карты с этим заголовком не переименовываются.
export const KIND_META: Record<ModeMapKind, { label: string; hint: string }> = {
  concept:     { label: 'Концептуализация', hint: 'Соберётся из полей концептуализации клиента; дальше можно двигать и дописывать' },
  personality: { label: 'Карта режимов',    hint: 'Все основные режимы человека на одной странице — для общей ориентации' },
  problem:     { label: 'Карта ситуации',   hint: 'Конкретная цепочка: триггер → режимы → последствия' },
  couple:      { label: 'Карта пары',       hint: 'Цикл-клэш: как копинг одного партнёра запускает боль другого' },
  free:        { label: 'Свободный холст',  hint: 'Пустой холст без шаблона: всё из палитры' },
};

/** «Концептуализация · 6 нояб.» — день создания в часовом поясе терапевта: он сам видит, когда это было. */
export const conceptMapTitle = (at: Date = new Date()) =>
  `Концептуализация · ${at.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;

/**
 * Каждая карта из концептуализации — новый снимок полей, поэтому вторая за
 * день получает номер: «… · 27 окт. (2)». Раньше все снимки дня звались
 * одинаково, и в ряду карт их было не различить (QA 2026-10-26).
 */
export function distinctTitle(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

const NUMBERED: Partial<Record<ModeMapKind, string>> = { problem: 'Ситуация', couple: 'Пара', free: 'Холст' };

/** Заголовок новой карты: концептуализация — по дню, ситуации, пары и холсты — по номеру своего типа. */
export function newMapTitle(kind: ModeMapKind, maps: Pick<ModeMapMeta, 'kind' | 'title'>[], at?: Date): string {
  if (kind === 'concept') return distinctTitle(conceptMapTitle(at), maps.map(m => m.title));
  const word = NUMBERED[kind];
  if (!word) return KIND_META[kind].label;
  return `${word} ${maps.filter(m => m.kind === kind).length + 1}`;
}
