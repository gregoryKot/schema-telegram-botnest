import { useState } from 'react';
import { useIsMobile } from '../useIsMobile';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { BottomSheetShell } from '../BottomSheetShell';
import { WORK_OPTION_GROUPS, type WorkOption } from '../../../../shared/src/therapy/sessionWork/names';
import { filterWorkGroups } from '../../../../shared/src/therapy/sessionWork/pickerFilter';

/** Телефон: выбор вида пункта «Что делали» листом — поиск и свёрнутые группы вместо ленты из 60+ кнопок. */
export function SessionWorkPickerSheet({ onPick, onClose }: { onPick: (o: WorkOption) => void; onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const searching = q.trim() !== '';
  const groups = filterWorkGroups(WORK_OPTION_GROUPS, q);
  return (
    <BottomSheetShell goBack={goBack} zIndex={300} label="Что делали: выбор">
      <div className="sw-sheet">
        <div className="ds-label">Что делали</div>
        <input
          className="ds-input" type="search" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Найти технику или упражнение" aria-label="Поиск"
        />
        {groups.length === 0 && <div className="tb-meta">Ничего не нашлось</div>}
        {groups.map(group => {
          const expanded = searching || open === group.title || group.options.length === 1;
          const single = group.options.length === 1;
          return (
            <div key={group.title} role="group" aria-label={group.title} className="sw-sheet-group">
              {!single && (
                <button type="button" className="sw-sheet-head" aria-expanded={expanded} disabled={searching}
                        onClick={() => setOpen(open === group.title ? null : group.title)}>
                  <span>{group.title}</span><span className="tb-meta">{group.options.length}</span>
                </button>
              )}
              {expanded && group.options.map(o => (
                <button key={o.refId ?? o.kind} type="button" className="sw-sheet-row" onClick={() => onPick(o)}>{o.name}</button>
              ))}
            </div>
          );
        })}
        <button type="button" className="ds-btn ds-btn--secondary" onClick={goBack}>Закрыть</button>
      </div>
    </BottomSheetShell>
  );
}

/** Телефон — лист; компьютер — лента групп прямо в форме. */
export function SessionWorkPicker({ onPick, onClose }: { onPick: (o: WorkOption) => void; onClose: () => void }) {
  if (useIsMobile()) return <SessionWorkPickerSheet onPick={onPick} onClose={onClose} />;
  return (
    <div className="sw-picker" role="group" aria-label="Что делали: выбор">
    {WORK_OPTION_GROUPS.map(group => (
      <div key={group.title} role="group" aria-label={group.title}>
        <div className="tb-meta">{group.title}</div>
        <div className="sw-chips">
          {group.options.map(o => (
            <button key={o.refId ?? o.kind} type="button" className="ds-chip ds-chip--toggle sw-opt" onClick={() => onPick(o)}>{o.name}</button>
          ))}
        </div>
      </div>
    ))}
    <div><button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => onClose()}>Отмена</button></div>
    </div>
  );
}
