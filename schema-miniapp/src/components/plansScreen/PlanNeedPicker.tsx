// Прямой путь к плану с пустого экрана «Планов» (QA 2026-11, B-М8): раньше
// подпись обещала кнопку «Запланировать практику», которой нет, а настоящий
// путь шёл через трекер и ответ «Совсем нет». Строка потребности открывает
// тот же лист плана, что и трекер (PlanSheet). Пара сайта —
// webapp/src/components/plans/PlanNeedPicker.tsx.
import { useState } from 'react';
import { NEED_ORDER, useNeedData } from '../../needData';
import { NEED_COLORS } from '../../types';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { plansEmptyText } from '../../../../shared/src/practices/plansCopy';
import { PlanSheet } from '../PlanSheet';

export function PlanNeedPicker({ onPlanned }: { onPlanned: () => void }) {
  const NEED_DATA = useNeedData();
  const [needId, setNeedId] = useState<string | null>(null);
  const picked = needId ? NEED_DATA[needId] : undefined;
  const tr = useTr();
  return (
    <div className="u-col10" role="group" aria-label="Потребность для плана">
      <div
        style={{
          fontSize: 14,
          color: 'var(--text-sub)',
          lineHeight: 1.65,
          maxWidth: 320,
          margin: '0 auto 14px',
        }}
      >
        {plansEmptyText(tr)}
      </div>
      {NEED_ORDER.filter((id) => NEED_DATA[id]).map((id) => (
        <div
          key={id}
          className="card"
          {...pressable(() => setNeedId(id))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-8)',
            borderRadius: 'var(--r-16)',
            padding: '14px 16px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <IdentityDot id={id} size={11} />
          <span style={{ flex: 1, fontSize: 15, color: 'var(--text)' }}>
            {NEED_DATA[id].name}
          </span>
          <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
            ›
          </span>
        </div>
      ))}
      {needId && picked && (
        <PlanSheet
          needId={needId}
          needLabel={picked.name}
          color={NEED_COLORS[needId] ?? '#888'}
          onClose={() => setNeedId(null)}
          onSaved={() => {
            setNeedId(null);
            onPlanned();
          }}
        />
      )}
    </div>
  );
}
