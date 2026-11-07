import { pluralRu } from '../../../../shared/src/utils/pluralRu';

/** «3 слова» под письмом — число склоняется (QA 2026-11: было «3 слов»). */
export function wordsLabel(text: string): string {
  const n = text.split(/\s+/).filter(Boolean).length;
  return `${n} ${pluralRu(n, 'слово', 'слова', 'слов')}`;
}
