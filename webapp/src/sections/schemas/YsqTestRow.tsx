import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../../components/art/SignArt';
import { useTr } from '../../utils/addressForm';
import { ysqRowText } from './ysqRowText';
import { glue } from '../../../../shared/src/utils/typo';

interface Props {
  progressAnswered: number | null;
  completedAt: string | null;
  onStart: () => void;
}

const YSQ = ENTITY_LOOK.ysq;

/** Компактная строка теста YSQ (телефон): белая строка со знаком теста из ENTITY_LOOK (как строки-входы
 *  вкладки «Режимы»), подпись слева, действие справа. Не лист бумаги: под героем той же глины (вводная
 *  схем, «Покинутость») два листа подряд читались одним. */
export function YsqTestRow({ progressAnswered, completedAt, onStart }: Props) {
  const tr = useTr();
  const t = ysqRowText(progressAnswered, completedAt, tr);
  return (
    <div className="ds-card ds-card--flush cs-testrow">
      <span className="pp-row-art" aria-hidden="true"><SignArt sign={YSQ.sign} size="row" /></span>
      <div className="cs-testrow-text"><div className="cs-testrow-title">Тест на схемы</div><div className="cs-testrow-sub">{glue(t.sub)}</div></div>
      <button className="ds-btn ds-btn--secondary" onClick={onStart}>{t.action}</button>
    </div>
  );
}
