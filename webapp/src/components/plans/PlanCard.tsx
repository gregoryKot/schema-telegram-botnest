// Строка плана в «Истории планов» (b20): знак потребности слева колонкой (NeedArt вместо цветного квадратика),
// над текстом — потребность читаемым тоном своего цвета и день, сам план — текстом человека. У ожидающих — две
// кнопки «Выполнено / Не вышло»; у закрытых — знак исхода справа в колонке (галочка мха или крест), а не символ
// «✓/×/·» текстом (одинокая точка у ожидающих читалась пустым статусом).
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { api, type PracticePlan } from '../../api';
import { useNeedData } from '../../needData';
import { NeedArt } from '../art/NeedArt';
import { GlyphCheck, GlyphX } from '../exercises/ExGlyphs';
import { inkVars } from '../history/needInk';
import { planDateLabel } from '../../../../shared/src/practices/plansCopy';
import { glueSpaces } from '../../../../shared/src/utils/typo';

export function PlanCard({ plan, onUpdate }: { plan: PracticePlan; onUpdate: Dispatch<SetStateAction<PracticePlan[] | null>> }) {
  const isPending = plan.done === null;
  const NEED_DATA = useNeedData();
  const needData = NEED_DATA[plan.needId];

  function checkin(done: boolean) {
    onUpdate(prev => prev?.map(p => p.id === plan.id ? { ...p, done } : p) ?? null);
    api.checkinPlan(plan.id, done).catch(() => {
      onUpdate(prev => prev?.map(p => p.id === plan.id ? { ...p, done: null } : p) ?? null);
    });
  }

  return (
    <div className={'ds-card sk-plan' + (isPending ? '' : ' is-closed')} style={inkVars(plan.needId) as CSSProperties}>
      <span className="pp-row-art">{needData && <NeedArt id={plan.needId} size="row" />}</span>
      <div className="sk-plan-body">
        <div className="sk-plan-meta">
          <span className="sk-plan-need">{needData?.name ?? plan.needId}</span>
          <span aria-hidden="true">·</span>
          <span>{planDateLabel(plan.scheduledDate)}</span>
        </div>
        <div className="sk-plan-text">{glueSpaces(plan.practiceText)}</div>
        {isPending && (
          <div className="sk-plan-actions">
            <button onClick={() => checkin(true)} className="ds-btn ds-btn--sm ds-btn--secondary">
              Выполнено
            </button>
            <button onClick={() => checkin(false)} className="ds-btn ds-btn--sm ds-btn--secondary">
              Не вышло
            </button>
          </div>
        )}
      </div>
      {!isPending && (
        <span className={'sk-plan-mark' + (plan.done ? ' is-ok' : ' is-no')} role="img" aria-label={plan.done ? 'Выполнено' : 'Не вышло'}>
          {plan.done ? <GlyphCheck /> : <GlyphX />}
        </span>
      )}
    </div>
  );
}
