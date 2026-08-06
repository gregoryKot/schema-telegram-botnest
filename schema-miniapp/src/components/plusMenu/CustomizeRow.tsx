import { ToggleRow } from '../todayCustomize/ToggleRow';
import { MoveArrows } from './MoveArrows';
import { api } from '../../api';
import type { QuickActionSurface } from '../../utils/quickActionPrefs';

// Одна строка листа настройки: ToggleRow (скрыть/показать) + MoveArrows
// (порядок), и их аналитика (quick_action_toggle/quick_action_move) — вынесена
// сюда, чтобы сам лист (QuickActionCustomizeSheet) оставался тонким мэппером.
// Стрелки снаружи ToggleRow — общий компонент не трогаем, у него есть второй
// потребитель (TodayCustomizeSheet).
export function CustomizeRow({
  id,
  emoji,
  label,
  sub,
  hidden,
  onToggle,
  disabledUp,
  disabledDown,
  onMove,
  surface,
}: {
  id: string;
  emoji: string;
  label: string;
  sub: string;
  hidden: boolean;
  onToggle: (id: string, hidden: boolean) => void;
  disabledUp: boolean;
  disabledDown: boolean;
  onMove: (id: string, dir: 'up' | 'down') => boolean;
  surface: QuickActionSurface;
}) {
  function handleToggle() {
    const nextHidden = !hidden;
    api.trackEvent('quick_action_toggle', {
      action: id,
      hidden: nextHidden,
      surface,
    });
    onToggle(id, nextHidden);
  }

  function handleMove(dir: 'up' | 'down') {
    if (onMove(id, dir)) {
      api.trackEvent('quick_action_move', { action: id, surface, dir });
    }
  }

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ToggleRow
          emoji={emoji}
          title={label}
          sub={sub}
          on={!hidden}
          onToggle={handleToggle}
        />
      </div>
      <MoveArrows
        disabledUp={disabledUp}
        disabledDown={disabledDown}
        onUp={() => handleMove('up')}
        onDown={() => handleMove('down')}
      />
    </div>
  );
}
