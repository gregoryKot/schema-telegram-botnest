// Блок «Здесь и сейчас» раздела «Практика»: три быстрые практики на одну-три
// минуты. Парный по смыслу с schema-miniapp/src/sections/helpSection/
// HereAndNow.tsx — раздел жил только в мини-аппе и стоял осознанным долгом в
// scripts/feature-parity-baseline.json, пока сайт до готовых роутов
// /api/practice-session(s) не доставал (правило №16). Логика и контент —
// общие (shared/src/practices), здесь только вёрстка сайта.
//
// Онбординг (правило «откуда это и зачем»): подпись над практиками отвечает,
// что это и зачем, до первого действия — на самом пути, а не в спрятанном
// «About». Счётчик прохождений — из реальных данных: пока он не приехал,
// в подписи строки стоит её обычный текст, а не выдуманный ноль.
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { BreathingCard } from '../../components/practice/BreathingCard';
import { QuickPracticeSheet } from '../../components/practice/QuickPracticeSheet';
import { practiceCountLabel } from '../../../../shared/src/practices/PracticeDoneFooter';
import type { QuickPracticeId } from '../../../../shared/src/practices/quickPractices';
import { pressable } from '../../utils/a11y';

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

export function HereAndNowBlock() {
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
    <div className="section">
      <div className="section-head">
        <h3>Здесь и сейчас</h3>
      </div>
      <p className="text-sm muted" style={{ lineHeight: 1.6, marginBottom: 20 }}>
        Три коротких практики самопомощи из КПТ и ДБТ — на одну-три минуты,
        для того момента, когда накрыло. Дыхание 4-4-6 успокаивает тело,
        заземление по пяти чувствам возвращает в комнату, «Стоп» ставит паузу
        между импульсом и действием. После нескольких заходов счётчик покажет,
        какая практика выручает чаще.
      </p>

      <BreathingCard />

      <div className="eyebrow" style={{ margin: '24px 0 4px' }}>
        Если нужно больше
      </div>
      {ROWS.map((row) => (
        <div
          key={row.id}
          className="list-line"
          style={{ cursor: 'pointer' }}
          {...pressable(() => setActive(row.id))}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="text-md" style={{ fontWeight: 500 }}>
              {row.label}
            </div>
            <div className="text-sm muted" style={{ marginTop: 'var(--space-4)' }}>
              {practiceCountLabel(counts?.[row.id] ?? null) ?? row.sub}
            </div>
          </div>
          <span className="link">начать →</span>
        </div>
      ))}

      {active && (
        <QuickPracticeSheet id={active} onClose={() => setActive(null)} />
      )}
    </div>
  );
}
