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

/** Бумага строк списка по очереди: персик, небо, шалфей, бирюза, солома — соседи не совпадают. */
const QUIZ_HUE = [45, 240, 135, 195, 70] as const;

export const QUIZ_SIGN_IDS = Object.keys(QUIZ_SIGN);

/** Знак теста по id; теста без знака — null (рисуем его эмодзи). */
export const quizSign = (id: string) => QUIZ_SIGN[id] ?? null;

export function quizLook(id: string, index: number): { Art: ((p: ArtProps) => ReactElement) | null; hue: number } {
  const i = ((index % QUIZ_HUE.length) + QUIZ_HUE.length) % QUIZ_HUE.length;
  return { Art: quizSign(id), hue: QUIZ_HUE[i] };
}

/** Лист сцены на панели результата — сосед оттенка теста по кругу, а не тон в тон:
 *  шалфей на шалфее читался только по тени. Шалфей берёт солому, как советует ревью. */
const SCENE_NEIGHBOR: Record<number, number> = { 45: 70, 240: 195, 135: 70, 195: 240, 70: 45 };

/** Бумага результата теста оттенка `hue`: лист сцены (`sceneHue`) и плитка «Что с этим
 *  делать» под панелью (`hintHue`) — ни то, ни другое не совпадает с панелью: под тёплой
 *  панелью подсказка бирюзовая, под холодной — соломенная. */
export function resultHues(hue: number): { sceneHue: number; hintHue: number } {
  const warm = hue >= 30 && hue <= 100;
  return { sceneHue: SCENE_NEIGHBOR[hue] ?? (warm ? 135 : 70), hintHue: warm ? 195 : 70 };
}
