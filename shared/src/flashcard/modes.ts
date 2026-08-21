// Контент карточки схемы (режимы/потребности/шаги) — единственная копия
// (правило №3 CLAUDE.md, В10 аудита 2026-08). Раньше webapp дублировал
// buildModes/NEEDS/STEPS инлайном в SchemaFlashcard.tsx, а miniapp — в
// components/schemaFlashcard/constants.ts; здесь и жил ты/вы-баг режима
// «Злой Ребёнок», не обёрнутого в tr() в одной из копий (см.
// shared/src/flashcard/modes.test.ts — тест теперь покрывает оба фронтенда).
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
      'Здоровый Взрослый слышит тебя: твоя боль настоящая, и справляться с ней в одиночку не нужно. Позволь себе побыть в этом — без самокритики.',
      'Здоровый Взрослый слышит вас: ваша боль настоящая, и справляться с ней в одиночку не нужно. Позвольте себе побыть в этом — без самокритики.',
    ),
    color: '#60a5fa',
  },
  {
    id: 'angry_child',
    emoji: '😡',
    label: 'Злой Ребёнок',
    desc: 'Злость, раздражение, хочется взорваться',
    response: tr(
      'Злость — сигнал, что нарушено что-то важное. Не нужно ни давить её, ни выплёскивать. Давай выясним, что за ней стоит.',
      'Злость — сигнал, что нарушено что-то важное. Не нужно ни давить её, ни выплёскивать. Давайте выясним, что за ней стоит.',
    ),
    color: '#f87171',
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
    color: '#94a3b8',
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

export function loadLocal(): FlashcardEntry[] {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    ) as FlashcardEntry[];
  } catch {
    return [];
  }
}
