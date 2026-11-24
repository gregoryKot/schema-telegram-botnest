// Логика отметок «Про клиента» (#1484) без React. Импорт адресов — только формат и таблица смыслов:
// модуль адресов целиком тянет тексты справочника, они едут отдельным чанком (guideLoader).
import { formatAddress, parseAddress, type GuideArticleKind } from '../../../../../../shared/src/schemaTherapy/guide/address/addressFormat';
import { addressTarget } from '../../../../../../shared/src/schemaTherapy/guide/address/addressTargets';
import type { Guide } from '../../../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { Tr } from '../../../../../../shared/src/schemaTherapy/guide/types';
import type { GuideMark } from '../../../../../../shared/src/therapy/guideMarks/guideMarksApi';

/** Раздел отмечается здесь: адрес разбирается и ложится в GuideMark (копинг схемы — в схему случая, PR 3). */
export function isMarkableAddress(address: string | undefined): address is string {
  return !!address && !!parseAddress(address) && addressTarget(address) === 'guideMark';
}

/** Адреса разделов статьи: путь — поле статьи в types.ts (сверка — guideSectionOnly.test.ts). */
export function articleAddress(kind: GuideArticleKind, articleId: string): (path: string) => string {
  return (path) => formatAddress({ kind, articleId, path });
}

/** Текст без разницы в пробелах: тот же фрагмент, выделенный дважды, — одна отметка (как fragmentKeyOf на сервере). */
export const sameText = (a: string, b: string): boolean => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();

/** Отметка того же места: раздел целиком по адресу или фрагмент по адресу и тексту. */
export function sameMark(m: GuideMark, address: string, fragment?: string): boolean {
  if (m.address !== address) return false;
  return fragment === undefined ? !m.fragment : !!m.fragment && sameText(m.snapshot, fragment);
}

export const findMark = (list: readonly GuideMark[] | null | undefined, address: string, fragment?: string): GuideMark | undefined =>
  list?.find((m) => sameMark(m, address, fragment));

/** Новая или поправленная отметка встаёт на место старой того же места, иначе — в конец. */
export function upsertMark(list: readonly GuideMark[], mark: GuideMark): GuideMark[] {
  const i = list.findIndex((m) => sameMark(m, mark.address, mark.fragment ? mark.snapshot : undefined));
  return i < 0 ? [...list, mark] : list.map((m, j) => (j === i ? mark : m));
}

export function dropMark(list: readonly GuideMark[], id: number): GuideMark[] {
  return list.filter((m) => m.id !== id);
}

/** Сколько отметок у статьи: ключ `schema:<id>` / `mode:<id>` — как узел холста. */
export function markCounts(marks: readonly GuideMark[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of marks) {
    const p = parseAddress(m.address);
    if (!p) continue;
    const key = `${p.kind}:${p.articleId}`;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

export interface GuideMarkEntry {
  mark: GuideMark;
  /** «Покорность · В кабинете»; раздела нет — заголовок пути по адресу. */
  title: string;
  /** Текст раздела сейчас или, если раздел переписан, сохранённый при отметке. */
  text: string;
  changed: boolean;
  /** Выделенный фрагмент: text — он сам, раздел «изменился» не бывает. */
  fragment: boolean;
}

/** Строки блока «Из справочника»: адрес не находит раздел — сохранённый текст с пометкой. */
export function markEntries(marks: readonly GuideMark[], guide: Guide, tr: Tr): GuideMarkEntry[] {
  return marks.map((mark) => {
    const found = guide.resolveAddress(mark.address, tr);
    const fragment = !!mark.fragment;
    if (found) return { mark, title: `${found.articleTitle} · ${found.sectionTitle}`, text: fragment ? mark.snapshot : found.text, changed: false, fragment };
    const p = parseAddress(mark.address);
    return { mark, title: p ? guide.sectionTitle(p.kind, p.path) : mark.address, text: mark.snapshot, changed: !fragment, fragment };
  });
}
