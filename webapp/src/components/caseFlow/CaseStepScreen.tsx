// Рамка шага «Что случилось» (редизайн 2026-11, docs/design/APP_2026-11.md, b09): один лист шалфея
// с лентой на всех шагах — тот же, что квадрат «Что случилось» на главной, со второго шага компактнее
// (compact). На компьютере — разворот: лист слева колонкой, под ним «Что собрали» из ответов до этого
// шага (CaseCollectedProvider кладёт строки, экраны шагов их не пробрасывают); форма — справа. Итог
// подменяет вид листа (бумага группы режима и своя сцена — look, heroArt). «Самопомощь» у героя —
// строкой под кнопками (ExScreen). Запись истории — одна на поток (useHistorySheet в CaseFlowScreen).
import { createContext, useContext, type ReactNode } from 'react';
import type { EntityId, SheetLook } from '../../../../shared/src/theme/entityLook';
import type { QuickResultRow } from '../../../../shared/src/case/quick/caseQuick';
import { ExScreen } from '../exercises/ExScreen';
import { glue } from '../../../../shared/src/utils/typo';
import { CaseSummaryAside } from './CaseSummaryAside';
import '../../styles/case-quick.css';

const Collected = createContext<QuickResultRow[]>([]);

/** Ответы, собранные к текущему шагу (collectedRows) — для листа «Что собрали» в колонке разворота. */
export function CaseCollectedProvider({ rows, children }: { rows: QuickResultRow[]; children: ReactNode }) {
  return <Collected.Provider value={rows}>{children}</Collected.Provider>;
}

interface Props {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  onBack: () => void;
  backLabel?: string;
  /** Второй и следующие шаги — лист полосой. */
  compact?: boolean;
  /** «Самопомощь, не замена терапии» — только на входе в поток. */
  caution?: boolean;
  /** Вид листа: по умолчанию «Что случилось» (шалфей, лента); итог — бумага группы режима. */
  look?: EntityId | SheetLook;
  heroArt?: ReactNode;
  /** Разворот на компьютере; экран-развилка без формы стоит одной колонкой. */
  spread?: boolean;
  children: ReactNode;
}

/** Строка — с неразрывными пробелами (тире и «·» не начинают строку, «1 из 3» не рвётся). */
const typo = (text: ReactNode) => (typeof text === 'string' ? glue(text) : text);

export function CaseStepScreen({ look = 'case', spread = true, backLabel = 'Назад', children, eyebrow, title, lede, ...head }: Props) {
  const rows = useContext(Collected);
  const aside = rows.length > 0 ? <CaseSummaryAside rows={rows} className="cq-summary--aside" /> : undefined;
  return (
    <ExScreen {...head} eyebrow={typo(eyebrow)} title={typo(title)} lede={typo(lede)} look={look} spread={spread} backLabel={backLabel} aside={spread ? aside : undefined}>
      <div className="cq-step">{children}</div>
    </ExScreen>
  );
}
