import type { WeekPatternTop } from '../../../../shared/src/pattern/patternsSummary';
import { weekTopText } from '../../../../shared/src/pattern/weekPatternText';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { EntitySheet } from '../../components/paper/EntitySheet';
import { patternLook } from '../../components/patternSheet/patternHue';
import { pressable } from '../../utils/a11y';

interface Props { top: WeekPatternTop | null; onOpen: (kind: MyCardsKind, id: string) => void }

/**
 * «Паттерн недели»: что чаще всего звучало по дневнику — герой раздела (редизайн 2026-11, b15):
 * лист бумаги домена схемы или группы режима и её знак крупно, как герои «Сегодня». Весь лист —
 * тап-цель к экрану паттерна. Нет записей за 7 дней — ничего.
 */
export function WeekPatternCard({ top, onOpen }: Props) {
  const text = top && weekTopText(top.kind, top);
  if (!top || !text) return null;
  const look = patternLook(top.kind, top.id) ?? ENTITY_LOOK[top.kind === 'mode' ? 'modes' : 'schemas'];
  return (
    <div {...pressable(() => onOpen(top.kind, top.id))} className="cs-week">
      <EntitySheet look={look} label={text.label} title={text.title} sub={text.sub} />
    </div>
  );
}
