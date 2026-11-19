// Вышедшие главы «Недели» по порядку: хук ведёт в следующую, скрытый хеш (#wed) открывает главу сразу.
import type { Chapter } from './chapter';
import { MONDAY } from './monday';
import { WEDNESDAY } from './wednesday';

export const CHAPTERS: Chapter[] = [MONDAY, WEDNESDAY];

/** Глава по id; неизвестная — хук. */
export const chapterById = (id: string | undefined): Chapter => CHAPTERS.find(c => c.id === id) ?? MONDAY;
/** Следующая вышедшая глава (нет — продолжение скоро). */
export const nextChapter = (ch: Chapter): Chapter | undefined => CHAPTERS[CHAPTERS.indexOf(ch) + 1];
/** Глава из хеша адреса: «#wed» — среда, остальное (#week, пусто) — хук. */
export const chapterFromHash = (hash: string): Chapter => chapterById(hash.replace(/^#/, ''));
