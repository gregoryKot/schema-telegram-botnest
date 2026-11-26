// Русские подписи блока «Страница ссылок» в /stats: язык без терминов
// (правило №8). Ключи — из белых списков события links_page_click.
import {
  LINKS_PAGE_FROM,
  LINKS_PAGE_TARGETS,
} from '../analytics/links-page.constants';

export const TARGET_LABELS: Record<
  (typeof LINKS_PAGE_TARGETS)[number],
  string
> = {
  booking: 'запись на консультацию',
  project: '«Всё по схеме»',
  project_tg: '«Всё по схеме» в Телеграме',
  project_max: '«Всё по схеме» в Макс',
  channel_ha: '«Здоровый Взрослый» в Телеграме',
  ha_threads: '«Здоровый Взрослый» в Тредс',
  ha_vk: '«Здоровый Взрослый» во ВКонтакте',
  ha_max: '«Здоровый Взрослый» в Макс',
  channel_schema: 'канал о схема-терапии в Телеграме',
  schema_max: 'канал о схема-терапии в Макс',
  about: 'обо мне',
  articles: 'статьи',
  write: 'написать лично',
};

export const FROM_LABELS: Record<(typeof LINKS_PAGE_FROM)[number], string> = {
  telegram: 'Телеграм',
  instagram: 'Инстаграм',
  max: 'Макс',
  vk: 'ВКонтакте',
  youtube: 'Ютуб',
  other: 'другая метка',
  direct: 'без метки',
};
