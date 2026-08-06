// Лист кнопки «плюс»: действия из единого реестра utils/quickActions.ts,
// сгруппированные, с возможностью скрыть пункты (utils/quickActionPrefs.ts).
// Раньше 4 пункта были зашиты прямо в FloatingPill — теперь любое действие
// реестра открывается отсюда (правило «одна механика — один компонент»).
import { useState } from 'react';
import { BottomSheet } from '../BottomSheet';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { buildPlusActions, type QuickActionId } from '../../utils/quickActions';
import {
  getHiddenActions,
  setActionHidden,
  PLUS_ACTIONS_HIDDEN_KEY,
} from '../../utils/quickActionPrefs';
import { QuickActionCustomizeSheet } from './QuickActionCustomizeSheet';

interface Props {
  onAction: (id: QuickActionId) => void;
  onClose: () => void;
}

export function PlusMenuSheet({ onAction, onClose }: Props) {
  const tr = useTr();
  const groups = buildPlusActions(tr);
  const [hidden, setHidden] = useState<string[]>(() =>
    getHiddenActions(PLUS_ACTIONS_HIDDEN_KEY),
  );
  const [showCustomize, setShowCustomize] = useState(false);

  function handleToggle(id: string, nextHidden: boolean) {
    setActionHidden(PLUS_ACTIONS_HIDDEN_KEY, id, nextHidden);
    setHidden((prev) =>
      nextHidden ? [...prev, id] : prev.filter((x) => x !== id),
    );
  }

  function handleAction(id: QuickActionId) {
    api.trackEvent('plus_action', { action: id });
    onClose();
    onAction(id);
  }

  const visibleGroups = groups
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
            <button
              onClick={() => setShowCustomize(true)}
              style={{
                minHeight: 44,
                padding: '6px 10px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--accent)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Изменить
            </button>
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
              <div key={g.id} style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ margin: '0 4px 8px' }}>
                  {g.title}
                </div>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {g.actions.map((a) => (
                    <ActionRow
                      key={a.id}
                      emoji={a.emoji}
                      label={a.label}
                      sub={a.sub}
                      onClick={() => handleAction(a.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </BottomSheet>

      {showCustomize && (
        <QuickActionCustomizeSheet
          title="Что показывать в «плюсе»"
          surface="plus"
          actions={groups.flatMap((g) => g.actions)}
          hidden={hidden}
          onToggle={handleToggle}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </>
  );
}

// Строка действия: эмодзи + название + подпись. Перенесена из FloatingPill
// (была DiaryTypeButton) — единственная копия (правило «одна механика — один
// компонент»), добавлена только иконка.
function ActionRow({
  emoji,
  label,
  sub,
  onClick,
}: {
  emoji: string;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 60,
        padding: '14px 16px',
        borderRadius: 16,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{emoji}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
          {sub}
        </div>
      </div>
    </button>
  );
}
