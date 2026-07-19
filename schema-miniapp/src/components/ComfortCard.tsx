// Секция «Комфорт» на экране «Профиль» (дизайн-макет, волна 2 нейродизайна).
// Сенсорные и «комфортные» контролы — в один тап, а не в глубине настроек:
// тема и «меньше движения» переключаются на месте; тонкая настройка
// уведомлений — по шеврону в настройки. Правило «управление там, где
// пользователь и так идёт».
import { useState } from 'react';
import { getTheme, toggleTheme, Theme } from '../utils/theme';
import { useReducedMotionPref } from '../hooks/useReducedMotionPref';
import { pressable } from '../utils/a11y';

function Row({
  emoji,
  label,
  value,
  onClick,
  divider,
}: {
  emoji: string;
  label: string;
  value: React.ReactNode;
  onClick: () => void;
  divider?: boolean;
}) {
  return (
    <div
      {...pressable(onClick)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        borderTop: divider ? '1px solid var(--border-color)' : undefined,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{emoji}</span>
      <span style={{ flex: 1, fontSize: 15, color: 'var(--text)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function ComfortCard({
  onOpenNotifications,
}: {
  onOpenNotifications: () => void;
}) {
  const [theme, setTheme] = useState<Theme>(getTheme);
  const motion = useReducedMotionPref();

  return (
    <div>
      <div className="section-label" style={{ margin: '4px 4px 8px' }}>
        Комфорт
      </div>
      <div className="card" style={{ borderRadius: 18, overflow: 'hidden' }}>
        <Row
          emoji={theme === 'dark' ? '🌙' : '☀️'}
          label="Тема"
          value={theme === 'dark' ? 'Тёмная' : 'Светлая'}
          onClick={() => setTheme(toggleTheme())}
        />
        <Row
          emoji="🍃"
          label="Меньше движения"
          value={motion.reduced ? 'Вкл' : 'Выкл'}
          onClick={motion.toggle}
          divider
        />
        <Row
          emoji="🔔"
          label="Мягкие напоминания"
          value={<span aria-hidden>›</span>}
          onClick={onOpenNotifications}
          divider
        />
      </div>
    </div>
  );
}
