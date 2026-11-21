// Вкладка «Запросы»: статьи о том, с чем приходят клиенты (shared/…/guide/concerns/). Одна сворачиваемая группа, её подпись
// и подсказка отвечают «что это и зачем» до первого тапа; бумага — своя бирюза, знак — свой у статьи (CONCERN_SIGN).
import type { ConcernGuide } from '../../../../shared/src/schemaTherapy/guide';
import { PAPER_HUE, type PaperHue, type SheetLook } from '../../../../shared/src/theme/entityLook';
import type { GuideSign } from '../../components/art/guideSignsModel';
import type { ReferenceGroup } from './guideReferenceModel';

export const CONCERNS_HUE: PaperHue = PAPER_HUE.teal;

/** Знак статьи: ПРЛ — Ribbon, чувства и отношения закручивает из крайности в крайность. */
export const CONCERN_SIGN: Record<string, GuideSign> = {
  bpd: 'ribbon',
};

export const concernGuideLook = (id: string): SheetLook => ({
  hue: CONCERNS_HUE,
  sign: Object.hasOwn(CONCERN_SIGN, id) ? CONCERN_SIGN[id] : undefined,
});

export const CONCERNS_TITLE = 'С чем приходят клиенты';
export const CONCERNS_HINT = 'Как запрос выглядит в жизни, откуда берётся, с чем его путают и что о нём знают исследования';

/** Статьи вкладки одной группой; пустую отсеет buildReference. */
export function concernGroups(guides: ConcernGuide[]): ReferenceGroup[] {
  return [{
    key: 'concerns', title: CONCERNS_TITLE, hint: CONCERNS_HINT, fold: true, look: { hue: CONCERNS_HUE },
    items: guides.map((c) => ({ kind: 'concern', id: c.id, name: c.name, sub: c.goal, sign: concernGuideLook(c.id).sign })),
  }];
}
