import type { FlashcardEntry, ModeData, NeedData, Step } from './types';

export const STORAGE_KEY = 'schema_flashcards';

export const buildModes = (
  tr: (ty: string, vy: string) => string,
): ModeData[] => [
  {
    id: 'vulnerable_child',
    emoji: '😢',
    label: 'Уязвимый Ребёнок',
    desc: 'Грустно, страшно, одиноко, беспомощно',
    response: tr(
      'Здоровый Взрослый слышит тебя: твоя боль настоящая, и ты не один. Позволь себе побыть в этом — без самокритики.',
      'Здоровый Взрослый слышит вас: ваша боль настоящая, и вы не один. Позвольте себе побыть в этом — без самокритики.',
    ),
    color: '#60a5fa',
  },
  {
    id: 'angry_child',
    emoji: '😡',
    label: 'Злой Ребёнок',
    desc: 'Злость, раздражение, хочется взорваться',
    response:
      'Злость — сигнал, что нарушено что-то важное. Не нужно ни давить её, ни выплёскивать. Давай выясним, что за ней стоит.',
    color: '#f87171',
  },
  {
    id: 'detached',
    emoji: '🔇',
    label: 'Отстранённый Защитник',
    desc: 'Пусто, онемело, всё равно, хочется исчезнуть',
    response: tr(
      'Ты отключился, чтобы не было больно — это понятно. Но ты в безопасности прямо сейчас. Можно чуть-чуть вернуться.',
      'Вы отключились, чтобы не было больно — это понятно. Но вы в безопасности прямо сейчас. Можно чуть-чуть вернуться.',
    ),
    color: '#94a3b8',
  },
  {
    id: 'critic',
    emoji: '🪓',
    label: 'Внутренний Критик',
    desc: 'Стыд, «я облажался», «я недостаточно хорош»',
    response: tr(
      'Критик думает, что защищает тебя, но причиняет боль. Здоровый Взрослый говорит: ты достаточно хорош — прямо сейчас.',
      'Критик думает, что защищает вас, но причиняет боль. Здоровый Взрослый говорит: вы достаточно хороши — прямо сейчас.',
    ),
    color: '#fb923c',
  },
];

export const NEEDS: NeedData[] = [
  { id: 'attachment', emoji: '💙', label: 'Привязанность' },
  { id: 'autonomy', emoji: '🔑', label: 'Автономия' },
  { id: 'expression', emoji: '🎨', label: 'Выражение' },
  { id: 'play', emoji: '🎉', label: 'Игра и радость' },
  { id: 'limits', emoji: '🛡️', label: 'Границы' },
];

export const STEPS: Step[] = ['mode', 'response', 'need', 'action'];
export const _STEP_LABELS = ['Режим', 'Ответ', 'Потребность', 'Действие'];

export function loadLocal(): FlashcardEntry[] {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    ) as FlashcardEntry[];
  } catch {
    return [];
  }
}
