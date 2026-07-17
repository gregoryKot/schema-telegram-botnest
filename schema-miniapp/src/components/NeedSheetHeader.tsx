import { Need } from '../types';
import { NeedExtra } from '../needData';

interface Props {
  need: Need;
  data: NeedExtra;
  color: string;
  onClose: () => void;
  /** История-шит даёт клавиатурный доступ (role/tabIndex/aria/Enter-Space);
   * шит "сегодня" — нет. Разница исходная, не трогаем. */
  keyboardAccessible?: boolean;
}

// Шапка шита потребности (эмодзи, заголовок, теги, крестик) — общая для
// NeedHistorySheet и NeedTodaySheet (правило №11 CLAUDE.md, jscpd-свип).
export function NeedSheetHeader({
  need,
  data,
  color,
  onClose,
  keyboardAccessible,
}: Props) {
  const a11yProps = keyboardAccessible
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-label': 'Закрыть',
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClose();
          }
        },
      }
    : {};

  return (
    <div
      onClick={onClose}
      {...a11yProps}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        marginBottom: 24,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          flexShrink: 0,
          background: color + '26',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        {data.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.2,
            marginBottom: 8,
          }}
        >
          {need.chartLabel}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {data.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 20,
                background: color + '1f',
                color,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          fontSize: 20,
          color: 'var(--text-faint)',
          flexShrink: 0,
          lineHeight: 1,
          paddingTop: 2,
        }}
      >
        ✕
      </div>
    </div>
  );
}
