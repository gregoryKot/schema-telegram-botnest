// Тексты «Мой портрет» — одни на сайт и мини-апп (правило №3): раньше жили
// литералами в PortraitCard/PortraitSheet мини-аппа. Вилка ты/вы — через tr.
import { NEED_ORDER } from '../needs/types';
import { NEEDS_EXPLAINER } from '../about/aboutData';
import { pluralRu } from '../utils/pluralRu';
import type { Portrait } from './portraitData';

type Tr = (ty: string, vy: string) => string;

export function portraitTexts(tr: Tr) {
  return {
    title: 'Мой портрет',
    /** Откуда это и зачем — над барами (правило «Онбординг»). */
    hint: tr(
      'Сколько твоих активных схем стоит за каждой из пяти потребностей',
      'Сколько ваших активных схем стоит за каждой из пяти потребностей',
    ),
    emptyCard: tr(
      'Здесь соберётся твой портрет: какие схемы и режимы активны. Основа — тест на схемы и твои отметки.',
      'Здесь соберётся ваш портрет: какие схемы и режимы активны. Основа — тест на схемы и ваши отметки.',
    ),
    emptySheet: tr(
      'Отметь схемы и режимы, которые узнаёшь у себя, — или пройди тест на схемы. Здесь появятся их карточки.',
      'Отметьте схемы и режимы, которые узнаёте у себя, — или пройдите тест на схемы. Здесь появятся их карточки.',
    ),
    takeTest: 'Пройти тест',
    takeTestArrow: 'Пройти тест на схемы →',
  };
}

/** Карточка-превью «Тёплые слова» на профиле. */
export const WARM_WORDS_CARD_TITLE = 'Мои тёплые слова';
export const WARM_WORDS_CARD_SOURCE = 'из карточек и дневников';

/** «3 схемы · 2 режима» — итог в шапке карточки. */
export function portraitTotalsText(p: Portrait): string {
  return `${p.totalSchemas} ${pluralRu(p.totalSchemas, 'схема', 'схемы', 'схем')} · ${p.totalModes} ${pluralRu(p.totalModes, 'режим', 'режима', 'режимов')}`;
}

/** Дельта с прошлого теста: null — нечего показывать (нет или не изменилась). */
export function portraitDeltaText(delta: number | null): string | null {
  if (delta == null || delta === 0) return null;
  return `${delta < 0 ? delta : `+${delta}`} с прошлого теста`;
}

/** Объяснение потребности по id: NEEDS_EXPLAINER — массив без id, порядок
 *  совпадает с NEED_ORDER. */
export const NEED_EXPLAINER_TEXT: Record<string, string | undefined> =
  Object.fromEntries(NEED_ORDER.map((id, i) => [id, NEEDS_EXPLAINER[i]?.text]));
