// Блоки экрана «Сегодня», которые человек включает/выключает и переставляет
// («Настроить экран»). Один реестр на оба фронтенда (правило №3): id — это
// generic-контракт screen_order_today с бэком (SCREEN_BLOCK_IDS, мини-апп
// сверяет их screenBlocks.test.ts), ключ хранения — тот же, что в мини-аппе,
// поэтому выбор один на обе площадки.
//
// Видимость блоков регулируют исторические today_*-ключи (todayFocus.ts):
// у `focus` её нет (главная карточка не скрывается, только переставляется).

export const TODAY_BLOCK_IDS = [
  'therapist_banner',
  'streak',
  'focus',
  'phrase',
  'secondary',
] as const;

export type TodayBlockId = (typeof TODAY_BLOCK_IDS)[number];

/** Порядок по умолчанию — он же порядок строк в листе настройки. */
export const TODAY_BLOCK_ORDER: TodayBlockId[] = [...TODAY_BLOCK_IDS];

/** Ключ localStorage с порядком блоков. */
export const TODAY_ORDER_KEY = 'screen_order_today';

/** Какую строку подсветить при открытии листа (долгое нажатие на блок). */
export type CustomizeHighlight = 'practice' | 'streak' | 'phrase';

export interface TodayBlockMeta {
  title: string;
  sub: string;
  /** Есть ли у блока тумблер (у «Фокуса дня» нет — он только переставляется). */
  toggleable: boolean;
}

/** Подписи строк листа. Названия нейтральные — вилка ты/вы не нужна. */
export const TODAY_BLOCK_META: Record<TodayBlockId, TodayBlockMeta> = {
  streak: {
    title: 'Карточка серии',
    sub: 'можно убрать, если счёт дней давит',
    toggleable: true,
  },
  focus: {
    title: 'Фокус дня',
    sub: 'главное дело — выбирается выше',
    toggleable: false,
  },
  phrase: {
    title: 'Фраза для себя',
    sub: 'цитата Здорового Взрослого на главном',
    toggleable: true,
  },
  secondary: {
    title: '«Что ещё можно сегодня»',
    sub: 'потребности и дневник под сворачиванием',
    toggleable: true,
  },
  therapist_banner: {
    title: 'Кабинет терапевта',
    sub: 'баннер входа в кабинет на главном',
    toggleable: true,
  },
};

/** Подсвеченная строка листа по поводу открытия («practice» — это «focus»). */
export function highlightedBlock(
  highlight: CustomizeHighlight | undefined,
): TodayBlockId | undefined {
  return highlight === 'practice' ? 'focus' : highlight;
}

/** Строки листа: у не-терапевта баннера кабинета нет — драг идёт по видимым. */
export function visibleTodayBlocks(
  orderedIds: TodayBlockId[],
  showTherapistBanner: boolean,
): TodayBlockId[] {
  return orderedIds.filter(
    (id) => id !== 'therapist_banner' || showTherapistBanner,
  );
}
