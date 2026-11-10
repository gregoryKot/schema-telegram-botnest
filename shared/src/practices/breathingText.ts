// Тексты карточки дыхания 4-4-6 — одни на обе вёрстки (мини-апп и сайт),
// чтобы обещание «одна минута» и итог не разъехались между площадками.
// Во время дыхания строка «круг 1 из 4 · вдох 4 · задержка 4 · выдох 6» собирается из
// частей `cycle` и BREATH_PHASES (breathPhases.ts): лист рисует их полосой фаз, где текущая выделена.
import {
  BREATH_PHASE_LABEL,
  BREATH_SESSION_CYCLES,
  type BreathState,
} from './breathing';
import { BREATH_PHASES } from './breathPhases';
import { pluralRu } from '../utils/pluralRu';

export type BreathStage = 'idle' | 'active' | 'finished';

export interface BreathCardText {
  title: string;
  /** Строки подписи — вёрстка ставит между ними перенос. */
  lines: string[];
  action: string;
  /** Во время дыхания: «круг 1 из 4» — полоса фаз рядом. */
  cycle?: string;
}

export function breathCardText(
  tr: (ty: string, vy: string) => string,
  stage: BreathStage,
  st: BreathState,
): BreathCardText {
  const n = BREATH_SESSION_CYCLES;
  if (stage === 'active') {
    const cycle = `круг ${st.cycle} из ${n}`;
    return {
      title: BREATH_PHASE_LABEL[st.phase],
      lines: [[cycle, ...BREATH_PHASES.map((p) => p.label)].join(' · ')],
      action: 'Достаточно',
      cycle,
    };
  }
  if (stage === 'finished')
    return {
      title: 'Минута позади',
      lines: [
        `${n} ${pluralRu(n, 'круг', 'круга', 'кругов')} вдоха и выдоха.`,
        tr(
          'Заметь, как сейчас дышится. Хочется ещё — продолжай.',
          'Заметьте, как сейчас дышится. Хочется ещё — продолжайте.',
        ),
      ],
      action: 'Ещё минуту',
    };
  return {
    title: tr('Дыши со мной', 'Дышите со мной'),
    lines: [
      'Вдох на 4 · задержка на 4 · выдох на 6.',
      'Одна минута — и станет легче.',
    ],
    action: 'Начать дыхание',
  };
}
