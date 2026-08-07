// Лист «Настроить экран»: скрыть/показать блоки текущего экрана. Generic по
// CustomizableScreen — сейчас «Профиль», следующим шагом «Паттерны» тем же
// компонентом (правило «одна механика — один компонент»). Каркас — общий
// CustomizeSheetShell (второй потребитель — QuickActionCustomizeSheet), строки
// — ToggleRow напрямую: здесь нет порядка/стрелок, только видимость.
import { ToggleRow } from '../todayCustomize/ToggleRow';
import { CustomizeSheetShell } from '../CustomizeSheetShell';
import {
  SCREEN_BLOCK_ORDER,
  BLOCK_META,
  type CustomizableScreen,
  type ScreenBlockId,
} from '../../utils/screenBlocks';

interface Props {
  screen: CustomizableScreen;
  hidden: string[];
  highlight?: ScreenBlockId;
  onToggle: (id: ScreenBlockId) => void;
  onClose: () => void;
}

export function ScreenCustomizeSheet({
  screen,
  hidden,
  highlight,
  onToggle,
  onClose,
}: Props) {
  return (
    <CustomizeSheetShell
      title="Настроить экран"
      subtitle="Скрытые блоки можно вернуть в любой момент"
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SCREEN_BLOCK_ORDER[screen].map((id) => {
          const meta = BLOCK_META[id];
          if (!meta) return null;
          return (
            <ToggleRow
              key={id}
              emoji={meta.emoji}
              title={meta.label}
              sub={meta.sub}
              on={!hidden.includes(id)}
              onToggle={() => onToggle(id)}
              highlighted={highlight === id}
            />
          );
        })}
      </div>
    </CustomizeSheetShell>
  );
}
