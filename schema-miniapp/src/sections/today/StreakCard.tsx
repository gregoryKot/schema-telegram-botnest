import { useTr } from '../../utils/addressForm';
import { plural } from './helpers';

// ── Стрик-карточка (макет): мягкая, без наказания за пропуск ──────────────────

export function StreakCard({ streak }: { streak: number }) {
  const tr = useTr();
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 18,
        animation: 'slide-up 0.3s ease both',
        animationDelay: '40ms',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          flexShrink: 0,
          background:
            'color-mix(in srgb, var(--accent-orange) 14%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
        }}
      >
        🔥
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          {streak} {plural(streak, 'день', 'дня', 'дней')} подряд
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 1 }}>
          {tr(
            'сбиться — не страшно, просто продолжай',
            'сбиться — не страшно, просто продолжайте',
          )}
        </div>
      </div>
    </div>
  );
}
