// Лист кнопки «плюс»: действия из единого реестра utils/quickActions.ts,
// сгруппированные, с возможностью скрыть пункты (utils/quickActionPrefs.ts).
// Раньше 4 пункта были зашиты прямо в FloatingPill — теперь любое действие
// реестра открывается отсюда (правило «одна механика — один компонент»).
import { useState } from 'react';
import { notifyPrefsChanged } from '../../utils/uiPrefsSync';
import { BottomSheet } from '../BottomSheet';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import type { QuickActionId } from '../../../../shared/src/quickActions/quickActions';
import { usePlusMenuState } from '../../../../shared/src/quickActions/usePlusMenuState';
import { withDragRange } from '../../../../shared/src/quickActions/quickActionOrder';
import { QuickActionCustomizeSheet } from './QuickActionCustomizeSheet';
import { PlusActionGroup } from './PlusActionGroup';
import { CustomizeButton } from './CustomizeButton';

interface Props {
  onAction: (id: QuickActionId) => void;
  onClose: () => void;
}

export function PlusMenuSheet({ onAction, onClose }: Props) {
  const tr = useTr();
  const { orderedGroups, visibleGroups, hidden, toggle, onReorder } =
    usePlusMenuState(tr, notifyPrefsChanged);
  const [showCustomize, setShowCustomize] = useState(false);

  function handleAction(id: QuickActionId) {
    api.trackEvent('plus_action', { action: id });
    onClose();
    onAction(id);
  }

  return (
    <>
      <BottomSheet onClose={onClose} zIndex={200}>
        <div style={{ paddingTop: 4, paddingBottom: 8 }}>
          <div className="u-between-mb10">
            <div className="d-caps">Быстрое действие</div>
            <CustomizeButton
              label="Изменить"
              ariaLabel="Настроить меню быстрых действий"
              onClick={() => setShowCustomize(true)}
            />
          </div>

          {visibleGroups.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                lineHeight: 1.5,
                padding: '8px 4px 4px',
              }}
            >
              Все пункты скрыты. Вернуть их можно через «Изменить» выше.
            </div>
          ) : (
            visibleGroups.map((g) => (
              <PlusActionGroup
                key={g.id}
                title={g.title}
                actions={g.actions}
                onAction={handleAction}
              />
            ))
          )}
        </div>
      </BottomSheet>

      {showCustomize && (
        <QuickActionCustomizeSheet
          title="Что показывать в «плюсе»"
          surface="plus"
          actions={withDragRange(orderedGroups.map((g) => g.actions))}
          hidden={hidden}
          onToggle={toggle}
          onReorder={onReorder}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </>
  );
}
