// Герой результата YSQ (бумага теста) над первой группой потребности (бумага NEED_HUE): «Привязанность» под глиной
// на телефоне и 768 читалась тем же листом (ревью g5 r3). Близкие оттенки (hueTooNear) — герой берёт белый лист с
// тенью-слоем (pa-sheet--white), как вход в тест; в развороте ≥1024 он колонкой слева, и CSS возвращает ему бумагу.
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { hueTooNear } from '../../../../shared/src/theme/hueGap';
import type { NeedId } from '../../../../shared/src/needs/types';
import type { ResultView } from '../../hooks/useYsqTest';
import { NEED_HUE } from '../../lib/tone';

/** Первая группа результата близкой бумаги — герой на белом листе; групп нет (выраженных схем нет) — бумага. */
export function resultHeroWhite(view: Pick<ResultView, 'activeByDomain'>): boolean {
  const first = view.activeByDomain[0]?.needId as NeedId | undefined;
  return hueTooNear(ENTITY_LOOK.ysq.hue, first ? NEED_HUE[first] : null);
}
