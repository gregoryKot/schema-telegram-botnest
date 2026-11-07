// Журнал техник (#995): отметки «Делали сегодня» всех режимов и схем клиента
// одним списком — блок «На сессиях» вкладки «Задания» карточки клиента
// (webapp/src/components/therapist/TechniqueJournalBlock.tsx). Источник — те же
// поля `done` связей концептуализации (techniqueMarks.ts), своих данных у
// журнала нет. Чистые функции без React.
import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import {
  getModeById,
  getSchemaById,
} from '../../schemaTherapy/schemaTherapyData';
import type { GuideFrom } from './conceptGuide';
import { modeName } from './conceptDigestModel';
import { normalizeTechniqueMarks } from './techniqueMarks';

export interface TechniqueJournalEntry {
  /** Местный день терапевта, `YYYY-MM-DD`. */
  day: string;
  techniqueId: string;
  /** Чья связь: режима или схемы. */
  from: GuideFrom;
  /** Как режим называет клиент (alias связи); у схемы и без слов клиента — нет. */
  alias?: string;
}

/**
 * Связи концептуализации → журнал: новые дни сверху. Внутри дня — режимы,
 * затем схемы, в порядке связей; у одной связи — поздняя отметка выше
 * (отметки дописываются в конец `done`). Битые отметки выбрасывает
 * normalizeTechniqueMarks; связей нет — пустой список.
 */
export function techniqueJournal({
  modeLinks = [],
  schemaLinks = [],
}: {
  modeLinks?: readonly ConceptModeLink[];
  schemaLinks?: readonly ConceptSchemaLink[];
}): TechniqueJournalEntry[] {
  const entries: TechniqueJournalEntry[] = [];
  for (const link of modeLinks) {
    const alias = link.alias.trim();
    for (const m of normalizeTechniqueMarks(link.done).reverse()) {
      const from: GuideFrom = { kind: 'mode', id: link.modeId };
      entries.push({ ...m, from, ...(alias ? { alias } : {}) });
    }
  }
  for (const link of schemaLinks) {
    for (const m of normalizeTechniqueMarks(link.done).reverse()) {
      entries.push({ ...m, from: { kind: 'schema', id: link.schemaId } });
    }
  }
  // Сортировка устойчивая: внутри дня порядок сборки сохраняется.
  // `YYYY-MM-DD` сравнивается строкой: порядок строк совпадает с порядком дней.
  return entries.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/**
 * Чья отметка словами: название из справочника, со словами клиента — как в
 * «Коротко» («Судья (Карающий Критик)»). Нет в справочнике — пусто.
 */
export function journalFromName({
  from,
  alias,
}: TechniqueJournalEntry): string {
  const name =
    (from.kind === 'mode' ? getModeById(from.id) : getSchemaById(from.id))
      ?.name ?? '';
  if (!name) return '';
  return modeName({ name, alias: alias ?? '' });
}

export interface TechniqueJournalDay {
  day: string;
  entries: TechniqueJournalEntry[];
}

/** Журнал по дням для показа: день один раз, под ним его техники, порядок журнала. */
export function journalDays(
  entries: readonly TechniqueJournalEntry[],
): TechniqueJournalDay[] {
  const days: TechniqueJournalDay[] = [];
  for (const e of entries) {
    const last = days[days.length - 1];
    if (last?.day === e.day) last.entries.push(e);
    else days.push({ day: e.day, entries: [e] });
  }
  return days;
}
