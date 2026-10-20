// Что показывает «Подсказка сверху» на вкладке «Режимы»: одно решение и все
// тексты для обеих площадок (правило №3). Мини-апп и сайт рисуют по-своему
// (карточки, цвета), но выбор состояния и слова — отсюда, чтобы не разъехались.
import type { WeekTopSummary } from './patternsSummary';
import {
  diaryIntro,
  modeIntro,
  weekTopText,
  type PatternIntro,
  type WeekTopText,
} from './weekPatternText';

type Tr = (ty: string, vy: string) => string;

export interface ModesHeroRow {
  label: string;
  sub: string;
}

export type ModesHeroModel =
  /** Режимов нет: знакомство с Критиком + два тихих входа. */
  | {
      kind: 'intro';
      intro: PatternIntro;
      buttonLabel: string;
      library: ModesHeroRow;
      manual: ModesHeroRow;
    }
  /** Режимы есть и за неделю есть записи: «Чаще всего включается». */
  | { kind: 'week'; id: string; text: WeekTopText }
  /** Режимы есть, записей за неделю нет: куда идти, чтобы картина появилась. */
  | { kind: 'diary'; row: ModesHeroRow }
  /** Показывать нечего (неизвестный режим в сводке, дневник недоступен). */
  | { kind: 'none' };

interface Input {
  hasModes: boolean;
  summary: WeekTopSummary | null;
  /** Есть ли куда вести из строки «дневник» (на сайте и в мини-аппе — не всегда). */
  canOpenDiary: boolean;
}

export function modesHeroModel(tr: Tr, { hasModes, summary, canOpenDiary }: Input): ModesHeroModel {
  if (!hasModes) {
    return {
      kind: 'intro',
      intro: modeIntro(tr),
      buttonLabel: 'Познакомиться',
      library: { label: 'Что такое режимы', sub: 'части, которые включаются по очереди' },
      manual: {
        label: 'Отметить свои',
        sub: tr('если уже знаешь свои режимы', 'если уже знаете свои режимы'),
      },
    };
  }
  if (summary) {
    const text = weekTopText('mode', summary);
    return text ? { kind: 'week', id: summary.id, text } : { kind: 'none' };
  }
  if (!canOpenDiary) return { kind: 'none' };
  return {
    kind: 'diary',
    row: {
      label: diaryIntro(tr).title,
      sub: tr(
        'замечай моменты, когда режим включился',
        'замечайте моменты, когда режим включился',
      ),
    },
  };
}
