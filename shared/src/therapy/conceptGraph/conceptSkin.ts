import { createContext, useContext } from 'react';
import type { DisclosureClasses } from '../../components/Disclosure';

/** Классы вида концептуализации. Сайт кладёт их контекстом, а не пропом: чип лежит на глубине
 *  ConceptGraph → редактор → выбор → чип. Без контекста — инлайн-дефолты (conceptInlineStyles.ts). */
export interface ConceptSkin {
  seg: { group: string; btn: string };
  chip: string;
  tag: string;
  dot: string;
  label: string;
  link: string;
  card: string;
  fold: { root: string; btn: string; chev: string; body: string };
  /** Раскладка сводки «Коротко» (ConceptDigest): заголовок и метка идут вместе с label. */
  digest: Record<'title' | 'list' | 'row' | 'term' | 'value', string>;
}

export const ConceptSkinContext = createContext<ConceptSkin | null>(null);

/** Классы сайта или null (мини-апп: инлайн-дефолты). */
export function useConceptSkin(): ConceptSkin | null {
  return useContext(ConceptSkinContext);
}

/** Классы раскрывашки для «Как читать схему» и «Подсказки»: один хелпер на оба. */
export function useFoldClasses(): DisclosureClasses | undefined {
  const skin = useConceptSkin();
  return skin ? { ...skin.fold, label: skin.label } : undefined;
}
