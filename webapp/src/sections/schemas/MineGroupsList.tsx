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
 * внутри строки «название + статус карточки + частота», внизу «+ Добавить» пунктиром.
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
                <button key={id} className="cs-row" onClick={() => onOpen(id)}>
                  <span className="cs-row-text">
                    <span className="cs-row-name tone-ink">{name}</span>
                    {statusFor && <span className="cs-row-sub">{statusFor(id)}</span>}
                  </span>
                  {freq && <FreqMark freq={freq[id] ?? 0} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button className="cs-add" onClick={onAdd}>{addLabel}</button>
    </section>
  );
}
