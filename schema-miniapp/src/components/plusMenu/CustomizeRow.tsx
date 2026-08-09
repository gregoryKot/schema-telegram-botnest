import { ToggleRow } from '../todayCustomize/ToggleRow';
import { MoveArrows } from './MoveArrows';

// Одна строка листа настройки: ToggleRow (скрыть/показать) + MoveArrows
// (порядок). Аналитика — инъекцией через колбэки (не хардкожена здесь):
// quick actions трекают quick_action_toggle/move в QuickActionCustomizeSheet,
// экранные блоки — screen_block_toggle/move в useScreenBlocks/*Order — общий
// для обоих листов (правило «одна механика — один компонент»). Стрелки
// снаружи ToggleRow — общий компонент не трогаем, у него есть второй
// потребитель (TodayCustomizeSheet).
export function CustomizeRow({
  emoji,
  label,
  sub,
  hidden,
  onToggle,
  disabledUp,
  disabledDown,
  onMoveUp,
  onMoveDown,
  highlighted,
}: {
  emoji: string;
  label: string;
  sub: string;
  hidden: boolean;
  onToggle: () => void;
  disabledUp: boolean;
  disabledDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  highlighted?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ToggleRow
          emoji={emoji}
          title={label}
          sub={sub}
          on={!hidden}
          onToggle={onToggle}
          highlighted={highlighted}
        />
      </div>
      <MoveArrows
        disabledUp={disabledUp}
        disabledDown={disabledDown}
        onUp={onMoveUp}
        onDown={onMoveDown}
      />
    </div>
  );
}
