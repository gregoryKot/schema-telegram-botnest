// Компактная кнопка «Поделиться» (иконка). Один примитив на кнопки шаринга
// (правило «одна механика — один компонент»): heatmapShare, AchievementsShare;
// тихая ссылка со словом — ShareLink рядом.
import { ShareIcon } from '../../../shared/src/share/ShareIcon';

export function SharePillButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        width: 44,
        borderRadius: 'var(--r-12)',
        border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
        color: 'var(--accent)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <ShareIcon />
    </button>
  );
}
