// Лист «что показывать» — общий для поверхностей «плюс» и «Инструменты»
// (правило «одна механика — один компонент»). Тонкий мэппер: строка и вся её
// логика (toggle/move + аналитика) — в CustomizeRow. Порядок/дизейбл краёв
// стрелок считает родитель (у групп «плюса» и списка «Инструментов» разные
// границы) — сюда приходит уже готовый список.
import { BottomSheet } from '../BottomSheet';
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
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            marginTop: 4,
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          Скрытые пункты можно вернуть в любой момент
        </div>
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
        <button
          className="btn-primary"
          style={{ marginTop: 16 }}
          onClick={onClose}
        >
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
