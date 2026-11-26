// Вкладки листа справочника: какой раздел на какой вкладке. Лист раскладывает разделы по этой таблице
// (сверка на живых текстах — guideTabs.test.tsx), точка «Про клиента» на вкладке ищет отметки по ней же.
import { parseAddress, type GuideArticleKind } from '../../../../../shared/src/schemaTherapy/guide/address/addressFormat';

export type GuideTabId = 'brief' | 'session' | 'steps' | 'between' | 'diagnosis' | 'theory';

export const GUIDE_TAB_LABEL: Record<GuideTabId, string> = {
  brief: 'Кратко',
  session: 'На сессии',
  steps: 'Как проводить',
  between: 'Задания',
  diagnosis: 'Диагностика',
  theory: 'Теория',
};

/** Вид листа с вкладками; остальные листы короткие и идут одной лентой. */
export type TabbedKind = Extract<GuideArticleKind, 'mode' | 'schema' | 'technique' | 'concern'>;

/** Вкладки по порядку и поля статьи на них; поле не из таблицы — на «Теории». `more` и источники — всегда «Теория». */
const LAYOUT: Record<TabbedKind, [GuideTabId, string[]][]> = {
  mode: [
    ['brief', ['voice', 'goal', 'schemas']],
    ['session', ['techniques', 'moreTechniques', 'relationship', 'cognitive', 'experiential', 'behavioral']],
    ['between', ['betweenSessions']],
    ['theory', ['stuck']],
  ],
  schema: [
    ['brief', ['voice', 'need', 'modeIds']],
    ['session', ['techniques', 'moreTechniques', 'inSession', 'interventions']],
    ['between', ['betweenSessions']],
    ['theory', ['coping', 'domainNote', 'stuck']],
  ],
  technique: [
    ['brief', ['cautions', 'voice', 'when', 'pairsWith', 'usages']],
    ['steps', ['steps']],
    ['theory', ['evidence']],
  ],
  concern: [
    ['brief', ['goal', 'voice', 'modeModel', 'modeIds', 'schemaIds']],
    ['diagnosis', ['criteria', 'origins', 'comorbidity', 'differential']],
    ['session', ['techniques', 'inSession', 'relationship', 'crisis', 'psychoeducation', 'formats', 'course']],
    ['theory', ['evidence', 'stuck']],
  ],
};

export const guideTabs = (kind: TabbedKind): GuideTabId[] => LAYOUT[kind].map(([id]) => id);

/** Вкладка поля статьи: `coping/surrender` — по первому слову пути. */
export function tabOfPath(kind: TabbedKind, path: string): GuideTabId {
  const field = path.split(/[/.]/)[0];
  return LAYOUT[kind].find(([, fields]) => fields.includes(field))?.[0] ?? 'theory';
}

/** Вкладки, где у этой статьи есть отметки «Про клиента» — точка на вкладке. */
export function markedTabs(kind: TabbedKind, articleId: string, addresses: Iterable<string>): Set<GuideTabId> {
  const out = new Set<GuideTabId>();
  for (const address of addresses) {
    const p = parseAddress(address);
    if (p && p.kind === kind && p.articleId === articleId) out.add(tabOfPath(kind, p.path));
  }
  return out;
}
