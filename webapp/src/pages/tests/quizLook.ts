import type { ReactElement } from 'react';
import type { ArtProps } from '../../components/art/paper';
import { Strokes } from '../../components/art/PaperArt';
import { Cluster, Talk } from '../../components/art/PaperArtSigns';
import { Looming } from '../../components/art/GuideSigns';

// Знак мини-теста по id — тот же язык, что в приложении (docs/design/PAPER_2026-11.md,
// «Мотив → смысл»). Тексты тестов живут на сервере (src/quiz/quiz-*.data.ts); у каждого
// теста оттуда есть знак — сверка в quizLook.test.ts. Теста без знака (новый, ещё не
// нарисованный) показываем его эмодзи из контента, а не чужой знак.
const QUIZ_SIGN: Record<string, (p: ArtProps) => ReactElement> = {
  critic: Looming,  // «Кто твой внутренний критик?» — круг Критика навис сверху
  voice: Talk,      // «Критик или Здоровый Взрослый?» — две реплики, две части спорят
  battery: Strokes, // «Чем зарядить батарейку?» — пять полосок-потребностей
  drives: Cluster,  // «Кто сегодня у руля?» — части по очереди у руля
};

/** Бумага строк списка по очереди: персик, небо, шалфей, слива, солома — соседи не совпадают. */
const QUIZ_HUE = [45, 240, 135, 300, 70] as const;

export const QUIZ_SIGN_IDS = Object.keys(QUIZ_SIGN);

export function quizLook(id: string, index: number): { Art: ((p: ArtProps) => ReactElement) | null; hue: number } {
  const i = ((index % QUIZ_HUE.length) + QUIZ_HUE.length) % QUIZ_HUE.length;
  return { Art: QUIZ_SIGN[id] ?? null, hue: QUIZ_HUE[i] };
}
