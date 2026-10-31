// Разделы /stats: одно короткое сообщение с кнопками вместо стены из 30 блоков.
// Чистый модуль без Nest/Telegraf. Имена блоков — ровно как в
// stats-report.blocks.ts (продуктовые), stats-infra-blocks.ts (инфраструктура)
// и POOL_BLOCK_NAME; сверка — stats-sections.spec.ts (№4): новый блок без
// раздела красит тест.

/** Блок «Запас фраз канала» (собирается в telegram/stats-messages.ts). */
export const POOL_BLOCK_NAME = 'Запас фраз канала';

/** Служебные callback-id, не принадлежащие разделам. */
export const STATS_MAIN_ID = 'main';
export const STATS_ALL_ID = 'all';

export interface StatsSection {
  /** Латиница для callback_data (`stats:<id>`). */
  id: string;
  /** Текст кнопки и заголовок раздела. */
  title: string;
  /** Имена блоков; порядок внутри раздела задаёт сервис отчёта. */
  blocks: string[];
}

export const STATS_SECTIONS: StatsSection[] = [
  {
    id: 'product',
    title: '📱 Продукт',
    blocks: [
      'Как пользуются продуктом',
      'Карточки режимов',
      'Дневник режимов',
      'Тёплые слова',
      'Разбор фразы: критик или забота',
      'Кнопка плюс',
      'Настройка экранов',
      'Паттерны со вкладки Я',
      'Графическая концептуализация',
      'Игра',
    ],
  },
  {
    id: 'people',
    title: '🌉 Люди и терапевт',
    blocks: [
      'Мост к терапевту',
      'Заявки с формы знакомства',
      'Терапевты уходят',
      'Перенос данных из другого приложения',
    ],
  },
  {
    id: 'money',
    title: '💰 Деньги и записи',
    blocks: ['Деньги', 'Сессии не в рублях', 'Данные записей'],
  },
  {
    id: 'entry',
    title: '🚪 Вход и новички',
    blocks: [
      'Вход в мессенджере',
      'Вход по коду',
      'Откуда пришли новенькие',
      'Установка с сайта',
      'Баннеры-переходы',
    ],
  },
  {
    id: 'data',
    title: '🗑 Данные людей',
    blocks: ['Удаление своих записей', 'Забирают свои данные'],
  },
  {
    id: 'system',
    title: '🩺 Здоровье системы',
    blocks: [
      'Поломки на клиенте',
      'Напоминания из бота',
      'Календари',
      'Настройки',
      'Переменные',
      'Самопроверка',
      POOL_BLOCK_NAME,
    ],
  },
];

export function findStatsSection(id: string): StatsSection | undefined {
  return STATS_SECTIONS.find((s) => s.id === id);
}

export function statsSectionCallback(id: string): string {
  return `stats:${id}`;
}

export interface StatsButton {
  text: string;
  callback_data: string;
}
export interface StatsKeyboard {
  inline_keyboard: StatsButton[][];
}

const btn = (text: string, id: string): StatsButton => ({
  text,
  callback_data: statsSectionCallback(id),
});

/** Клавиатура /stats. Без `current` — главный экран: все разделы по две в ряд
 * и «Всё целиком». С `current` — экран раздела: «← Главное» и остальные
 * разделы (текущий не дублируется). */
export function statsKeyboard(current?: string): StatsKeyboard {
  const inSection = !!current && current !== STATS_MAIN_ID;
  const buttons = STATS_SECTIONS.filter((s) => s.id !== current).map((s) =>
    btn(s.title, s.id),
  );
  const rows: StatsButton[][] = [];
  if (inSection) rows.push([btn('← Главное', STATS_MAIN_ID)]);
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  if (!inSection) rows.push([btn('📄 Всё целиком', STATS_ALL_ID)]);
  return { inline_keyboard: rows };
}
