import type { Tr } from '../../../../../shared/src/schemaTherapy/guide/types';
import type { Guide } from '../../../../../shared/src/therapy/conceptGraph/guideLoader';
import { planItemAddress } from '../../../../../shared/src/therapy/plan/planAddress';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';

/** Ссылка «Из справочника» у пункта плана. */
export interface PlanSourceLink {
  /** «Уязвимый Ребёнок · Через понимание»; раздела нет — заголовок пути по адресу. */
  title: string;
  /** Адрес не находит раздел: ссылки нет, пометка «раздел изменился»; текст пункта — сохранённый. */
  changed: boolean;
  /** Статья, которую открывает ссылка; null — открыть нечем. */
  open: { kind: 'mode' | 'schema' | 'technique'; id: string } | null;
}

/**
 * Откуда пункт плана — по адресу раздела (resolveAddress, как блок «Из справочника» у отметок).
 * null — пункт свой либо тексты справочника ещё не приехали.
 */
export function planSourceLink(guide: Guide | null | undefined, tr: Tr, item: Pick<PlanItem, 'sourceAddress' | 'source'>): PlanSourceLink | null {
  const address = planItemAddress(item);
  if (!guide || !address) return null;
  const found = guide.resolveAddress(address, tr);
  if (found) {
    const open = found.kind === 'note' || found.kind === 'concern' || found.kind === 'phase' || found.kind === 'need' ? null : { kind: found.kind, id: found.articleId };
    return { title: `${found.articleTitle} · ${found.sectionTitle}`, changed: false, open };
  }
  const p = guide.parseAddress(address);
  return { title: p ? guide.sectionTitle(p.kind, p.path) : 'Раздел справочника', changed: true, open: null };
}
