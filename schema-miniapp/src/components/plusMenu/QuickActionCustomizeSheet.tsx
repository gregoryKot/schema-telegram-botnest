// Лист «что показывать» — общий для поверхностей «плюс» и «Инструменты»
// (правило «одна механика — один компонент»). Тонкий мэппер: строка и вся её
// логика (toggle/move + аналитика) — в CustomizeRow. Порядок/дизейбл краёв
// стрелок считает родитель (у групп «плюса» и списка «Инструментов» разные
// границы) — сюда приходит уже готовый список. Каркас (шапка + «Готово») —
// общий CustomizeSheetShell, второй потребитель — ScreenCustomizeSheet.
import { CustomizeSheetShell } from '../CustomizeSheetShell';
import { CustomizeRow } from './CustomizeRow';
import type { QuickActionSurface } from '../../utils/quickActionPrefs';

interface CustomizeAction {
  id: string;
  emoji: string;
  label: string;
  sub: string;
  disabledUp: boolean;
  disabledDown: boolean;
}

interface Props {
  title: string;
  actions: CustomizeAction[];
  hidden: string[];
  surface: QuickActionSurface;
  onToggle: (id: string, hidden: boolean) => void;
  onMove: (id: string, dir: 'up' | 'down') => boolean;
  onClose: () => void;
}

export function QuickActionCustomizeSheet({
  title,
  actions,
  hidden,
  surface,
  onToggle,
  onMove,
  onClose,
}: Props) {
  return (
    <CustomizeSheetShell
      title={title}
      subtitle="Скрытые пункты можно вернуть в любой момент"
      zIndex={300}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map((a) => (
          <CustomizeRow
            key={a.id}
            id={a.id}
            emoji={a.emoji}
            label={a.label}
            sub={a.sub}
            hidden={hidden.includes(a.id)}
            onToggle={onToggle}
            disabledUp={a.disabledUp}
            disabledDown={a.disabledDown}
            onMove={onMove}
            surface={surface}
          />
        ))}
      </div>
    </CustomizeSheetShell>
  );
}
