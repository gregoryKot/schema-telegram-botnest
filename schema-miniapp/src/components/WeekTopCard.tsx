// Карточка недельной сводки («Чаще всего звучит/включается», дизайн-макет).
// Одна на схемы и режимы — правило «одна механика — один компонент».
import { pressable } from '../utils/a11y';

interface Props {
  label: string;
  color: string;
  title: string;
  sub: string;
  onClick: () => void;
}

export function WeekTopCard({ label, color, title, sub, onClick }: Props) {
  return (
    <div
      className="card"
      {...pressable(onClick)}
      style={{
        padding: 18,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        animation: 'slide-up 0.3s ease both',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sub)' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 19,
          fontWeight: 800,
          marginTop: 6,
          color,
          lineHeight: 1.25,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          marginTop: 6,
          lineHeight: 1.45,
        }}
      >
        {sub}
      </div>
    </div>
  );
}
