// Настраиваемый экран «Сегодня» (волна 2 нейродизайна): пользователь выбирает
// главную практику фокус-карточки и может скрыть карточку серии (для кого
// стрик — источник тревоги, а не мотивации). Хранение per-device в
// localStorage, как тема и reduce_motion. Чистая логика — под тестом.

export type FocusPractice = 'tracker' | 'schema' | 'mode' | 'gratitude';

const PRACTICE_KEY = 'today_focus_practice';
const STREAK_KEY = 'today_streak_hidden';
const SECONDARY_KEY = 'today_secondary_hidden';
const THERAPIST_BANNER_KEY = 'today_therapist_banner_hidden';

export const FOCUS_OPTIONS: {
  id: FocusPractice;
  emoji: string;
  label: string;
  sub: string;
}[] = [
  {
    id: 'tracker',
    emoji: '📊',
    label: 'Трекер потребностей',
    sub: 'пять оценок дня · ≈1 мин',
  },
  {
    id: 'schema',
    emoji: '🧩',
    label: 'Дневник схем',
    sub: 'заметить момент схемы · ≈2 мин',
  },
  {
    id: 'mode',
    emoji: '🔄',
    label: 'Дневник режимов',
    sub: 'какой режим включался · ≈2 мин',
  },
  {
    id: 'gratitude',
    emoji: '🙏',
    label: 'Благодарность',
    sub: 'три хорошие вещи · ≈1 мин',
  },
];

/** Чистая логика: разбор сырого значения localStorage. */
export function parseFocusPractice(raw: string | null): FocusPractice {
  return raw === 'schema' || raw === 'mode' || raw === 'gratitude'
    ? raw
    : 'tracker';
}

export function getFocusPractice(): FocusPractice {
  return parseFocusPractice(localStorage.getItem(PRACTICE_KEY));
}

export function setFocusPractice(p: FocusPractice): void {
  if (p === 'tracker') localStorage.removeItem(PRACTICE_KEY);
  else localStorage.setItem(PRACTICE_KEY, p);
}

export function isStreakHidden(): boolean {
  return localStorage.getItem(STREAK_KEY) === '1';
}

export function setStreakHidden(hidden: boolean): void {
  if (hidden) localStorage.setItem(STREAK_KEY, '1');
  else localStorage.removeItem(STREAK_KEY);
}

// Скрывать ли второстепенное («Что ещё можно сегодня») под сворачиванием.
// По умолчанию — да (собранный экран, меньше нагрузки).
export function isSecondaryHidden(): boolean {
  return localStorage.getItem(SECONDARY_KEY) !== '0';
}

export function setSecondaryHidden(hidden: boolean): void {
  if (hidden) localStorage.removeItem(SECONDARY_KEY);
  else localStorage.setItem(SECONDARY_KEY, '0');
}

// Скрывать ли баннер «Кабинет терапевта» с главного (только роль THERAPIST).
export function isTherapistBannerHidden(): boolean {
  return localStorage.getItem(THERAPIST_BANNER_KEY) === '1';
}

export function setTherapistBannerHidden(hidden: boolean): void {
  if (hidden) localStorage.setItem(THERAPIST_BANNER_KEY, '1');
  else localStorage.removeItem(THERAPIST_BANNER_KEY);
}

export interface FocusCardContent {
  chip: string;
  title: string;
  sub: string;
  buttonLabel: string;
  /** Подпись done-состояния (для трекера собирается на месте с индексом) */
  doneSub: string;
}

/** Чистая логика: контент фокус-карточки для выбранной практики. */
export function focusCardContent(
  practice: FocusPractice,
  ratedCount: number,
  total: number,
): FocusCardContent {
  switch (practice) {
    case 'schema':
      return {
        chip: '⏱ ≈2 мин',
        title: 'Заметить момент схемы',
        sub: 'Одна запись: что случилось и какая схема включилась.',
        buttonLabel: 'Записать',
        doneSub: 'Запись в дневнике схем сделана.',
      };
    case 'mode':
      return {
        chip: '⏱ ≈2 мин',
        title: 'Отметить режим дня',
        sub: 'Какой режим сегодня включался — одна запись.',
        buttonLabel: 'Записать',
        doneSub: 'Запись в дневнике режимов сделана.',
      };
    case 'gratitude':
      return {
        chip: '⏱ ≈1 мин',
        title: 'Три хорошие вещи',
        sub: 'Маленькая практика благодарности — прямо сейчас.',
        buttonLabel: 'Записать',
        doneSub: 'Благодарности на сегодня записаны.',
      };
    default:
      return {
        chip: '⏱ ≈1 мин',
        title: 'Заполнить трекер потребностей',
        sub:
          ratedCount > 0
            ? `Осталось ${total - ratedCount} из ${total} — сохраняется само`
            : 'Пять оценок о том, как прошёл день. Сохраняется само.',
        buttonLabel: ratedCount > 0 ? 'Продолжить' : 'Начать',
        doneSub: '',
      };
  }
}

/** Чистая логика: выполнена ли выбранная практика сегодня. */
export function isFocusDone(
  practice: FocusPractice,
  ctx: {
    allRated: boolean;
    todayDone: Record<'schema' | 'mode' | 'gratitude', boolean>;
  },
): boolean {
  return practice === 'tracker' ? ctx.allRated : ctx.todayDone[practice];
}
