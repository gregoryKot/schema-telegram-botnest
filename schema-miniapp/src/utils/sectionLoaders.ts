// Импорт-функции четырёх главных экранов — общий источник и для
// React.lazy() (components/LazySections.tsx), и для фоновой предзагрузки в
// простое (preloadSections.ts). Вынесено отдельно, чтобы обе стороны звали
// РОВНО ОДИН литерал спецификатора import() — бандлер кэширует Promise по
// нему, значит секция, догруженная preloadSections в простое, не потянет
// повторный сетевой запрос, когда до неё дойдёт React.lazy при переключении
// вкладки (замер 2026-08-22: без разбиения единый чанк — 1,26 МБ, 2,3 c до
// первого рендера на 3G).
export const SECTION_LOADERS = {
  today: () => import('../sections/TodaySection'),
  schemas: () => import('../sections/SchemasSection'),
  help: () => import('../sections/HelpSection'),
  profile: () => import('../sections/ProfileSection'),
} as const;

export type SectionKey = keyof typeof SECTION_LOADERS;
