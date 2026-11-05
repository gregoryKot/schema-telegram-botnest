// Блок «Здесь и сейчас» раздела «Практика»: три быстрые практики на одну-три
// минуты. Раздел жил только в мини-аппе, пока сайт до готовых роутов
// /api/practice-session(s) не доставал. Логика и контент — общие
// (shared/src/practices), здесь только вёрстка сайта.
//
// Онбординг (правило «откуда это и зачем»): подпись над практиками отвечает,
// что это и зачем, до первого действия — на самом пути, а не в спрятанном
// «About». Счётчик прохождений — из реальных данных: пока он не приехал,
// в подписи строки стоит её обычный текст, а не выдуманный ноль.
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../api';
import { BreathingCard } from '../../components/practice/BreathingCard';
import { QuickPracticeSheet } from '../../components/practice/QuickPracticeSheet';
import { practiceCountLabel } from '../../../../shared/src/practices/practiceCountLabel';
import type { QuickPracticeId } from '../../../../shared/src/practices/quickPractices';
import { pressable } from '../../utils/a11y';
import { Breath } from '../../components/art/PaperArt';
import { HereAndNowIntro } from './HereAndNowIntro';
import '../../styles/client-practice.css';

type Counts = Record<QuickPracticeId, number>;

const ROWS: { id: QuickPracticeId; label: string; sub: string }[] = [
  {
    id: 'grounding',
    label: 'Заземление 5-4-3-2-1',
    sub: 'вернуться в тело и в комнату',
  },
  {
    id: 'stop',
    label: 'Техника «Стоп»',
    sub: 'пауза между импульсом и действием',
  },
];

/** compact — телефон: строки со шевроном, extraRows дописываются в список. */
export function HereAndNowBlock({ compact = false, extraRows }: { compact?: boolean; extraRows?: ReactNode }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [active, setActive] = useState<QuickPracticeId | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getPracticeSessions()
      .then((c) => {
        if (!ignore) setCounts(c);
      })
      .catch((e) => console.error('getPracticeSessions failed', e));
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <HereAndNowIntro compact={compact} />

      <div className="cp-open-card"><BreathingCard /></div>

      <div className="ds-label">Если нужно больше</div>
      {ROWS.map((row) => (
        <div
          key={row.id}
          className="ds-card ds-card--row ds-card--nav ds-card--hover cp-task"
          {...pressable(() => setActive(row.id))}
        >
          <span className="pp-row-art"><Breath size="row" /></span>
          <div className="cp-task-body">
            <div className="cp-task-title">{row.label}</div>
            <div className="ds-sub">
              {practiceCountLabel(counts?.[row.id] ?? null) ?? row.sub}
            </div>
          </div>
          {compact
            ? <span className="ds-chev" aria-hidden="true" />
            : <span className="ds-link">начать →</span>}
        </div>
      ))}
      {extraRows}

      {active && (
        <QuickPracticeSheet id={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}
