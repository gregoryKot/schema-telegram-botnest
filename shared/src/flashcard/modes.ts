// Контент карточки схемы (режимы/потребности/шаги) — единственная копия (правило №3 CLAUDE.md).
// Цвет режима — токен его группы (группы — FLASHCARD_MODE_GROUP в modeView.ts).
import type { FlashcardEntry, ModeData, NeedData, Step } from './types';
import { MODE_GROUP_COLOR } from '../theme/modeGroupColor';

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
      'Здоровый Взрослый слышит тебя: твоя боль настоящая, и справляться с ней в одиночку не нужно. Позволь себе побыть в этом — без самокритики.',
      'Здоровый Взрослый слышит вас: ваша боль настоящая, и справляться с ней в одиночку не нужно. Позвольте себе побыть в этом — без самокритики.',
    ),
    color: MODE_GROUP_COLOR.child.css,
  },
  {
    id: 'angry_child',
    emoji: '😡',
    label: 'Сердитый Ребёнок',
    desc: 'Злость, раздражение, хочется взорваться',
    response: tr(
      'Злость — сигнал, что нарушено что-то важное. Не нужно ни давить её, ни выплёскивать. Давай выясним, что за ней стоит.',
      'Злость — сигнал, что нарушено что-то важное. Не нужно ни давить её, ни выплёскивать. Давайте выясним, что за ней стоит.',
    ),
    color: MODE_GROUP_COLOR.child.css,
  },
  {
    id: 'detached',
    emoji: '🔇',
    label: 'Отстранённый Защитник',
    desc: 'Пусто, онемело, всё равно, хочется исчезнуть',
    response: tr(
      'Это отключение — чтобы не было больно, и это понятно. Но ты в безопасности прямо сейчас. Можно чуть-чуть вернуться.',
      'Вы отключились, чтобы не было больно — это понятно. Но вы в безопасности прямо сейчас. Можно чуть-чуть вернуться.',
    ),
    color: MODE_GROUP_COLOR.coping.css,
  },
  {
    id: 'critic',
    emoji: '🪓',
    label: 'Внутренний Критик',
    desc: 'Стыд, «опять провал», «этого мало»',
    response: tr(
      'Критик думает, что защищает тебя, но причиняет боль. Здоровый Взрослый говорит: тебя достаточно — прямо сейчас.',
      'Критик думает, что защищает вас, но причиняет боль. Здоровый Взрослый говорит: вы достаточно хороши — прямо сейчас.',
    ),
    color: MODE_GROUP_COLOR.critic.css,
  },
];

export const NEEDS: NeedData[] = [
  { id: 'attachment', emoji: '💙', label: 'Привязанность' },
  { id: 'autonomy', emoji: '🔑', label: 'Автономия' },
  { id: 'expression', emoji: '🎨', label: 'Выражение' },
  { id: 'play', emoji: '🎉', label: 'Спонтанность' },
  { id: 'limits', emoji: '🛡️', label: 'Границы' },
];

export const STEPS: Step[] = ['mode', 'response', 'need', 'action'];

export function loadLocal(): FlashcardEntry[] {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    ) as FlashcardEntry[];
  } catch {
    return [];
  }
}
