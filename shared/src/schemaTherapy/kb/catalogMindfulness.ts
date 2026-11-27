// Темы каталога-цели из книги ван Фресвайк (карта docs/guide-sources/ван-Фресвайк.md).
// Отдельный файл: catalogTechniques.ts и catalogPractice.ts под храповиком размера.
import type { CatalogTopic } from './catalog';

export type { CatalogTopic };

/** Строка «written»: запись в справочнике есть, id темы = id записи. */
export const w = (id: string): CatalogTopic => ({ id, status: 'written' });

const vf = (id: string, title: string, chapters: string[]): CatalogTopic => ({
  id,
  title,
  status: 'planned',
  source: 'ван Фресвайк',
  chapters,
});

export const VF_TECHNIQUES: readonly CatalogTopic[] = [
  w('three_minute_breathing_space'),
  w('mindfulness_practices'),
  w('schema_awareness_practice'),
  w('healthy_modes_mindfulness'),
  vf(
    'mindful_juggling',
    'Осознанное жонглирование: копинг и схемы в действии',
    ['гл. 6', 'гл. 9'],
  ),
  vf(
    'mindful_talk_with_close_ones',
    'Осознанное общение с близкими: пауза в споре и разговор о схемах',
    ['гл. 9'],
  ),
];

export const VF_PRACTICE: readonly CatalogTopic[] = [
  w('mbst_protocol'),
  w('mbst_sessions'),
  vf('mbst_suitability', 'Кому подходит тренинг осознанности', [
    'гл. 1',
    'гл. 5',
  ]),
  vf('mbst_group_difficulties', 'Трудности в группе осознанности', ['гл. 7']),
  w('mindfulness_programs'),
];
