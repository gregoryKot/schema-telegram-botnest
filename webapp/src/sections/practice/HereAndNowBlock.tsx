// Блок «Здесь и сейчас» раздела «Практика»: три быстрые практики на одну-три
// минуты. Логика и контент — общие (shared/src/practices), здесь только вёрстка
// сайта: вводная, герой «Дыши со мной» (BreathingCard) и квадраты бумаги
// заземления, «Стопа» и — на компьютере — «Мне плохо» (QuickSquares).
//
// Онбординг (правило «откуда это и зачем»): вводная над практиками отвечает,
// что это и зачем, до первого действия — на самом пути, а не в спрятанном
// «About». Мета квадратов — из реальных данных (useQuickCounts): пока она не
// приехала — плашка-скелетон, не пришла — квадрат без меты, а не выдуманный ноль.
import { useState, type ReactNode } from 'react';
import { BreathingCard } from '../../components/practice/BreathingCard';
import { QuickPracticeSheet } from '../../components/practice/QuickPracticeSheet';
import type { QuickPracticeId } from '../../../../shared/src/practices/quickPractices';
import { HereAndNowIntro } from './HereAndNowIntro';
import { QuickSquares } from './QuickSquares';
import { useQuickCounts } from './useQuickCounts';
import '../../styles/client-practice.css';

/** compact — телефон (вводная короче, заголовок несёт шапка страницы); onSos — квадрат «Мне плохо»;
 *  extraRows — кризисные строки телефона под квадратами (PhoneHelpRows). */
export function HereAndNowBlock({ compact = false, onSos, extraRows }: { compact?: boolean; onSos?: () => void; extraRows?: ReactNode }) {
  const counts = useQuickCounts(!!onSos);
  const [active, setActive] = useState<QuickPracticeId | null>(null);
  return (
    <>
      <HereAndNowIntro compact={compact} />
      {/* Заголовок героя — уровнем ниже заголовка блока: на телефоне блок называет h1 шапки, на компьютере — h3. */}
      <div className="cp-open-card"><BreathingCard titleAs={compact ? 'h2' : 'h4'} /></div>
      <QuickSquares counts={counts} onOpen={setActive} onSos={onSos} />
      {extraRows}
      {active && <QuickPracticeSheet id={active} onClose={() => setActive(null)} />}
    </>
  );
}
