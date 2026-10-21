// Лист быстрых действий «+»: группы и строки из общего реестра
// (shared/src/quickActions), видимость — из настройки пользователя. Тап по
// строке закрывает лист и зовёт onAction (AppShell открывает нужный оверлей
// теми же флагами, что и остальные входы).
import { useState } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { BottomSheetShell } from '../BottomSheetShell';
import { notifyPrefsChanged } from '../../utils/uiPrefsSync';
import { usePlusMenuState } from '../../../../shared/src/quickActions/usePlusMenuState';
import type { QuickActionId } from '../../../../shared/src/quickActions/quickActions';
import { QuickActionCustomizeSheet } from './QuickActionCustomizeSheet';
import '../../styles/quick-actions.css';

interface Props {
  onAction: (id: QuickActionId) => void;
  onClose: () => void;
}

export function PlusMenuSheet({ onAction, onClose }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const { orderedGroups, visibleGroups, hidden, toggle, onReorder } = usePlusMenuState(tr, notifyPrefsChanged);
  const [customize, setCustomize] = useState(false);

  function pick(id: QuickActionId) {
    api.trackEvent('plus_action', { action: id });
    onClose();
    onAction(id);
  }

  return (
    <>
      <BottomSheetShell goBack={goBack} zIndex={250} label="Быстрое действие">
        <div className="qa-head">
          <div className="ds-h3">Быстрое действие</div>
          <button
            type="button"
            className="qa-edit"
            aria-label="Настроить быстрые действия"
            onClick={() => setCustomize(true)}
          >
            Изменить
          </button>
        </div>
        {visibleGroups.length === 0 ? (
          <div className="ds-sub qa-empty">
            Все пункты скрыты. Вернуть их можно через «Изменить» выше.
          </div>
        ) : (
          visibleGroups.map((g) => (
            <div key={g.id} className="qa-group">
              <div className="ds-label qa-group-title">{g.title}</div>
              <div className="qa-rows">
                {g.actions.map((a) => (
                  <button key={a.id} type="button" className="qa-row" onClick={() => pick(a.id)}>
                    <span className="qa-row-label">{a.label}</span>
                    <span className="qa-row-sub">{a.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </BottomSheetShell>
      {customize && (
        <QuickActionCustomizeSheet
          groups={orderedGroups}
          hidden={hidden}
          onToggle={toggle}
          onReorder={onReorder}
          onClose={() => setCustomize(false)}
        />
      )}
    </>
  );
}
