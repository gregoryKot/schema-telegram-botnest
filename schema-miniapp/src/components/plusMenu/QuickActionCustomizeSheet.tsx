// Лист «что показывать» — общий для поверхностей «плюс» и «Инструменты»
// (правило «одна механика — один компонент»: второй поверхностью займётся
// отдельная задача, но лист уже generic по списку действий/ключу). Строки —
// переиспользованный ToggleRow (не трогаем/не копируем его).
import { BottomSheet } from '../BottomSheet';
import { ToggleRow } from '../todayCustomize/ToggleRow';
import { api } from '../../api';
import type { QuickActionSurface } from '../../utils/quickActionPrefs';

interface CustomizeAction {
  id: string;
  emoji: string;
  label: string;
  sub: string;
}

interface Props {
  title: string;
  actions: CustomizeAction[];
  hidden: string[];
  surface: QuickActionSurface;
  onToggle: (id: string, hidden: boolean) => void;
  onClose: () => void;
}

export function QuickActionCustomizeSheet({
  title,
  actions,
  hidden,
  surface,
  onToggle,
  onClose,
}: Props) {
  function handleToggle(id: string) {
    const nextHidden = !hidden.includes(id);
    api.trackEvent('quick_action_toggle', { action: id, hidden: nextHidden, surface });
    onToggle(id, nextHidden);
  }

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
            <ToggleRow
              key={a.id}
              emoji={a.emoji}
              title={a.label}
              sub={a.sub}
              on={!hidden.includes(a.id)}
              onToggle={() => handleToggle(a.id)}
            />
          ))}
        </div>
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={onClose}>
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
