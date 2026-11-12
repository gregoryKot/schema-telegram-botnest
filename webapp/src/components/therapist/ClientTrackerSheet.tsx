// Лист трекера в сайдбаре «Обзора» (b30): солома ENTITY_LOOK.tracker — «Индекс сегодня» (ClientIndexCard) и
// «Потребности сегодня». Потребность — свой знак NeedArt и цвет данных (inkVars, решение 7 «Палитра данных»):
// полоска — --need-ink, число — --need-text, как у клиента в трекере и «Истории»; красного «≤4» нет. Строки —
// на белом списке внутри листа (как SignGroup): число --need-text читается к белому ≥4.5:1. Нет данных — листа нет.
import type { CSSProperties } from 'react';
import { ClientIndexCard } from './ClientIndexCard';
import type { NeedBar } from './clientOverviewModel';
import { NeedArt } from '../art/NeedArt';
import { inkVars } from '../history/needInk';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

interface Props {
  todayIndex: number | null | undefined;
  history: readonly { index: number | null }[];
  needs: NeedBar[];
}

export function ClientTrackerSheet({ todayIndex, history, needs }: Props) {
  if (todayIndex == null && needs.length === 0) return null;
  return (
    <section className="pp-paper tk-track" style={{ '--h': ENTITY_LOOK.tracker.hue } as CSSProperties}>
      {todayIndex != null && <ClientIndexCard todayIndex={todayIndex} history={history} />}
      {needs.length > 0 && (
        <div className="tk-track-part">
          <h2 className="ds-label">Потребности сегодня</h2>
          <div className="tk-needs">
            {needs.map(n => (
              <div key={n.id} className="tk-need" style={inkVars(n.id) as CSSProperties}>
                <span className="tk-need-sign" aria-hidden="true"><NeedArt id={n.id} size="nav" /></span>
                <span className="tk-need-name">{n.label}</span>
                <span className="tk-need-bar"><span style={{ width: `${n.widthPct}%` }} /></span>
                <b>{n.value}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
