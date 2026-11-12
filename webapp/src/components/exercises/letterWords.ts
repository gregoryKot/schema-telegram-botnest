import { pluralRu } from '../../../../shared/src/utils/pluralRu';

const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;
/** «3 слова» под письмом — число склоняется (QA 2026-11: было «3 слов»). */
export const wordsLabel = (text: string): string => `${wordCount(text)} ${pluralRu(wordCount(text), 'слово', 'слова', 'слов')}`;
/** Строки сцены письма (SceneLetter, b18): до семи слов на строку, пусто — ни одной (предел — у сцены). */
export const letterLines = (text: string): number => Math.ceil(wordCount(text) / 7);
