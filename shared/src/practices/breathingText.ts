// Тексты карточки дыхания 4-4-6 — одни на обе вёрстки (мини-апп и сайт),
// чтобы обещание «одна минута» и итог не разъехались между площадками.
import {
  BREATH_PHASE_LABEL,
  BREATH_SESSION_CYCLES,
  type BreathState,
} from './breathing';
import { pluralRu } from '../utils/pluralRu';

export type BreathStage = 'idle' | 'active' | 'finished';

export interface BreathCardText {
  title: string;
  /** Строки подписи — вёрстка ставит между ними перенос. */
  lines: string[];
  action: string;
}

export function breathCardText(
  tr: (ty: string, vy: string) => string,
  stage: BreathStage,
  st: BreathState,
): BreathCardText {
  const n = BREATH_SESSION_CYCLES;
  if (stage === 'active')
    return {
      title: BREATH_PHASE_LABEL[st.phase],
      lines: [`круг ${st.cycle} из ${n} · вдох 4 · задержка 4 · выдох 6`],
      action: 'Достаточно',
    };
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
