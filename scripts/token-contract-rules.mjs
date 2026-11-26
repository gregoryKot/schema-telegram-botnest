// Список токенов, которые shared/ берёт по имени, а значение задаёт сам сайт: гейт
// check-token-contract.mjs проверяет, что index.css объявляет каждое имя; тест гейта
// (src/test-support/gates/token-contract.spec.ts) берёт список отсюда.

// Токены, которые обязаны быть объявлены в index.css (на них ссылается
// shared/), а значение задаёт сам сайт (фон/поверхности, статусные цвета).
export const SHARED_NAME_ONLY_TOKENS = [
  '--accent-red',
  // Текст на залитом --accent-red: иначе следующая красная кнопка снова
  // напишет '#fff' и получит в тёмной теме 2.94:1. Контраст
  // самой ПАРЫ считает webapp/src/index.css.contrast.test.ts.
  '--on-accent-red',
  '--accent-orange',
  '--accent-yellow',
  '--accent-green',
  '--accent-blue',
  '--accent-pink',
  '--bg',
  '--surface',
  '--surface-2',
  '--text',
  '--text-sub',
  '--text-faint',
  '--line',
  '--border-color',
  '--nav-bg',
  '--sheet-bg',
  '--sheet-bg-2',
  '--track-color',
  '--fg-rgb',
  // Стили копинга: COPING_STYLES (shared/src/schemaTherapy/guide/copingStyles.ts).
  '--coping-surrender',
  '--coping-surrender-ink',
  '--coping-avoidance',
  '--coping-avoidance-ink',
  '--coping-overcompensation',
  '--coping-overcompensation-ink',
];
