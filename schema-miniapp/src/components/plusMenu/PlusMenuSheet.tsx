// Лист кнопки «плюс»: действия из единого реестра utils/quickActions.ts,
// сгруппированные, с возможностью скрыть пункты (utils/quickActionPrefs.ts).
// Раньше 4 пункта были зашиты прямо в FloatingPill — теперь любое действие
// реестра открывается отсюда (правило «одна механика — один компонент»).
import { useState } from 'react';
import { BottomSheet } from '../BottomSheet';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { buildPlusActions, type QuickActionId } from '../../utils/quickActions';
import { PLUS_ACTIONS_HIDDEN_KEY } from '../../utils/quickActionPrefs';
import { useHiddenActions } from '../../utils/useHiddenActions';
import {
  PLUS_ACTIONS_ORDER_KEY,
  withMoveFlags,
} from '../../utils/quickActionOrder';
import { useQuickActionOrder } from '../../utils/useQuickActionOrder';
import { QuickActionCustomizeSheet } from './QuickActionCustomizeSheet';
import { PlusActionGroup } from './PlusActionGroup';
import { CustomizeButton } from './CustomizeButton';

interface Props {
  onAction: (id: QuickActionId) => void;
  onClose: () => void;
}

export function PlusMenuSheet({ onAction, onClose }: Props) {
  const tr = useTr();
  const groups = buildPlusActions(tr);
  const [hidden, handleToggle] = useHiddenActions(PLUS_ACTIONS_HIDDEN_KEY);
  const [showCustomize, setShowCustomize] = useState(false);
  const { ordered, onMove } = useQuickActionOrder(
    PLUS_ACTIONS_ORDER_KEY,
    groups.map((g) => g.actions),
  );
  const orderedGroups = groups.map((g, i) => ({ ...g, actions: ordered[i] }));

  function handleAction(id: QuickActionId) {
    api.trackEvent('plus_action', { action: id });
    onClose();
    onAction(id);
  }

  const visibleGroups = orderedGroups
    .map((g) => ({
      ...g,
      actions: g.actions.filter((a) => !hidden.includes(a.id)),
    }))
    .filter((g) => g.actions.length > 0);

  return (
    <>
      <BottomSheet onClose={onClose} zIndex={200}>
        <div style={{ paddingTop: 4, paddingBottom: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
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
          actions={orderedGroups.flatMap((g) => withMoveFlags(g.actions))}
          hidden={hidden}
          onToggle={handleToggle}
          onMove={onMove}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </>
  );
}
