import { SignGroup } from '../../components/schemaSheets/SignGroup';
import { FreqMark, FreqHint } from './FreqMark';
import { mineGroupLook, type MineGroup } from './mineGroups';
import type { WeekPatternKind } from '../../../../shared/src/pattern/patternsSummary';

interface Props {
  kind: WeekPatternKind;
  groups: MineGroup[];
  nameOf: (id: string) => string | undefined;
  /** Кнопка «+ Добавить …» под группами; без неё — добавление в шапке блока (компьютер). */
  addLabel?: string;
  onAdd: () => void;
  onOpen: (id: string) => void;
  statusFor?: (id: string) => string;
  freq?: Record<string, number>;
}

/**
 * «Мои схемы / Мои режимы» — группы на бумаге домена или группы режимов со знаком у подписи
 * (SignGroup, редизайн 2026-11), внутри белый список «название + статус карточки + частота».
 * Одна механика на схемы и режимы, телефон и компьютер: на широкой колонке группы встают в две-три
 * колонки (контейнер .sg-cols), внизу на телефоне — «+ Добавить …» (ds-btn--secondary ds-btn--lg, #906).
 */
export function MineGroupsList({ kind, groups, nameOf, addLabel, onAdd, onOpen, statusFor, freq }: Props) {
  return (
    <section className="cs-block">
      {freq && <FreqHint kind={kind} freq={freq} />}
      {groups.length > 0 && (
        <div className="sg-cols-box"><div className="sg-cols">
          {groups.map(g => (
            <SignGroup key={g.id} look={mineGroupLook(kind, g.id)} title={g.title} aside={g.ids.length} rowsClassName="cs-grp">
              {g.ids.map(id => {
                const name = nameOf(id);
                if (!name) return null;
                return (
                  <button key={id} type="button" className="ds-list-row ds-list-row--nav ds-list-row--hover cs-mine-row" onClick={() => onOpen(id)}>
                    <span className="ds-list-body"><span className="ds-list-title">{name}</span>{statusFor && <span className="ds-list-sub">{statusFor(id)}</span>}</span>
                    <span className="cs-grp-right">{freq && <FreqMark freq={freq[id] ?? 0} />}<span className="ds-chev" aria-hidden="true" /></span>
                  </button>
                );
              })}
            </SignGroup>
          ))}
        </div></div>
      )}
      {addLabel && <button type="button" className="ds-btn ds-btn--secondary ds-btn--lg" onClick={onAdd}>{addLabel}</button>}
    </section>
  );
}
