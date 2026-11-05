import { hueStyle } from '../../lib/tone';
import { FreqMark, FreqHint } from './FreqMark';
import type { MineGroup } from './mineGroups';
import type { WeekPatternKind } from '../../../../shared/src/pattern/patternsSummary';

interface Props {
  kind: WeekPatternKind;
  groups: MineGroup[];
  nameOf: (id: string) => string | undefined;
  addLabel: string;
  onAdd: () => void;
  onOpen: (id: string) => void;
  statusFor?: (id: string) => string;
  freq?: Record<string, number>;
}

/**
 * «Мои схемы / Мои режимы» на телефоне, как в мини-аппе: группы подписью капсом со счётчиком,
 * внутри строки «название + статус карточки + частота», внизу «+ Добавить» (ds-btn--secondary ds-btn--lg, #906).
 * Одна механика на схемы и режимы.
 */
export function MineGroupsList({ kind, groups, nameOf, addLabel, onAdd, onOpen, statusFor, freq }: Props) {
  return (
    <section className="cs-block">
      {freq && <FreqHint kind={kind} freq={freq} />}
      {groups.map(g => (
        <div key={g.id} className="cs-grp-wrap" style={hueStyle(g.hue)}>
          <div className="cs-grp-head tone-ink"><span>{g.title}</span><span>{g.ids.length}</span></div>
          <div className="cs-grp tone-tint tone-border">
            {g.ids.map(id => {
              const name = nameOf(id);
              if (!name) return null;
              return (
                <button key={id} type="button" className="ds-list-row ds-list-row--nav ds-list-row--hover" onClick={() => onOpen(id)}>
                  <span className="ds-list-body"><span className="ds-list-title tone-ink">{name}</span>{statusFor && <span className="ds-list-sub">{statusFor(id)}</span>}</span>
                  <span className="cs-grp-right">{freq && <FreqMark freq={freq[id] ?? 0} />}<span className="ds-chev" aria-hidden="true" /></span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button type="button" className="ds-btn ds-btn--secondary ds-btn--lg" onClick={onAdd}>{addLabel}</button>
    </section>
  );
}
