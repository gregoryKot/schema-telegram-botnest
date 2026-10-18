import { useTr } from '../../utils/addressForm';
import { ysqRowText } from './ysqRowText';

interface Props {
  progressAnswered: number | null;
  completedAt: string | null;
  onStart: () => void;
}

/** Светлая компактная строка про тест YSQ (телефон): подпись слева, действие справа. */
export function YsqTestRow({ progressAnswered, completedAt, onStart }: Props) {
  const tr = useTr();
  const t = ysqRowText(progressAnswered, completedAt, tr);
  return (
    <div className="ds-card cs-testrow">
      <div className="cs-testrow-text">
        <div className="cs-testrow-title">Тест на схемы</div>
        <div className="cs-testrow-sub">{t.sub}</div>
      </div>
      <button className={`ds-btn ${t.primary ? 'ds-btn--accent' : 'ds-btn--secondary'}`} onClick={onStart}>{t.action}</button>
    </div>
  );
}
