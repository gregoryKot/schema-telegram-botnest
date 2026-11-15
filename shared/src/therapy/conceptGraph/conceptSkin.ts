import { createContext, useContext } from 'react';

/** Классы вида концептуализации. Сайт кладёт их контекстом, а не пропом: чип лежит на глубине
 *  ConceptGraph → редактор → выбор → чип. Сайт ставит его всегда (ConceptPaperProvider); без него — только тесты. */
export interface ConceptSkin {
  seg: { group: string; btn: string };
  label: string;
  link: string;
  card: string;
  /** Раскладка сводки «Коротко» (ConceptDigest): заголовок и метка идут вместе с label. */
  digest: Record<'title' | 'list' | 'row' | 'term' | 'value', string>;
}

export const ConceptSkinContext = createContext<ConceptSkin | null>(null);

/** Классы сайта или null (тест без ConceptPaperProvider: элементы без классов). */
export function useConceptSkin(): ConceptSkin | null {
  return useContext(ConceptSkinContext);
}
