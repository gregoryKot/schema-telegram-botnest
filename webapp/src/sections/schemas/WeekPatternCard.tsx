import type { WeekPatternTop } from '../../../../shared/src/pattern/patternsSummary';
import { weekTopText } from '../../../../shared/src/pattern/weekPatternText';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

interface Props {
  top: WeekPatternTop | null;
  onOpen: (kind: MyCardsKind, id: string) => void;
}

/** «Паттерн недели»: что чаще всего звучало по дневнику. Нет записей за 7 дней — ничего. */
export function WeekPatternCard({ top, onOpen }: Props) {
  const text = top && weekTopText(top.kind, top);
  if (!top || !text) return null;
  return (
    <button className="ds-card ds-card--hover cs-week" onClick={() => onOpen(top.kind, top.id)} style={{ color: text.color }}>
      <span className="cs-week-label">{text.label}</span>
      <span className="cs-week-title">{text.title}</span>
      <span className="cs-week-sub">{text.sub}</span>
    </button>
  );
}
