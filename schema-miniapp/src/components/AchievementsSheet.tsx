import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Achievement } from '../api';

const ACHIEVEMENT_META: Record<string, { emoji: string; title: string; desc: string }> = {
  first_day:  { emoji: '🌱', title: 'Первый шаг',     desc: 'Заполнил дневник первый раз' },
  streak_3:   { emoji: '🔥', title: 'Начало серии',   desc: '3 дня подряд' },
  streak_7:   { emoji: '⭐', title: 'Неделя',          desc: '7 дней подряд' },
  streak_14:  { emoji: '💫', title: 'Две недели',      desc: '14 дней подряд' },
  streak_30:  { emoji: '🏆', title: 'Месяц',           desc: '30 дней подряд' },
  streak_100: { emoji: '👑', title: 'Сотня',           desc: '100 дней подряд' },
  total_10:   { emoji: '📅', title: '10 дней',         desc: '10 дней всего' },
  total_50:   { emoji: '📆', title: '50 дней',         desc: '50 дней всего' },
  high_day:   { emoji: '✨', title: 'Хороший день',    desc: 'Средний индекс выше 8' },
  all_above7: { emoji: '🎯', title: 'Баланс',          desc: 'Все потребности выше 7 в один день' },
  comeback:        { emoji: '🔄', title: 'Возвращение',     desc: 'Вернулся после перерыва в 3+ дня' },
  growth:          { emoji: '📈', title: 'Рост',            desc: 'Потребность выросла на 3+ за неделю' },
  pair_connected:  { emoji: '🫂', title: 'Не одни',         desc: 'Отслеживаете потребности вместе с другом' },
};

interface Props {
  achievements: Achievement[];
  onClose: () => void;
}

export function AchievementsSheet({ achievements, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const earned = achievements.filter(a => a.earned).length;
  const meta = selected ? ACHIEVEMENT_META[selected] : null;

  async function shareOne() {
    if (!meta || !selected) return;
    const text = `${meta.emoji} Получил достижение «${meta.title}» в дневнике потребностей!\n\nt.me/SchemaLabBot`;
    try {
      try { if (navigator.share) { await navigator.share({ text }); return; } } catch {}
      try { await navigator.clipboard.writeText(text); } catch {}
    } catch {}
  }

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Достижения</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{earned} / {achievements.length}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {achievements.map(a => {
            const m = ACHIEVEMENT_META[a.id];
            if (!m) return null;
            return (
              <div
                key={a.id}
                onClick={() => a.earned && setSelected(a.id)}
                style={{
                  background: a.earned ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'rgba(var(--fg-rgb),0.03)',
                  border: `1px solid ${a.earned ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'rgba(var(--fg-rgb),0.06)'}`,
                  borderRadius: 16, padding: '14px 12px',
                  cursor: a.earned ? 'pointer' : 'default',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8, filter: a.earned ? 'none' : 'grayscale(1) opacity(0.3)' }}>
                  {m.emoji}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: a.earned ? 'var(--text)' : 'rgba(var(--fg-rgb),0.25)', marginBottom: 4 }}>
                  {m.title}
                </div>
                <div style={{ fontSize: 11, color: a.earned ? 'rgba(var(--fg-rgb),0.45)' : 'rgba(var(--fg-rgb),0.18)', lineHeight: 1.4 }}>
                  {m.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded card overlay */}
      {selected && meta && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32,
            animation: 'fadeIn 0.18s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(145deg, color-mix(in srgb, var(--accent) 20%, transparent), rgba(79,163,247,0.1))',
              border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
              borderRadius: 24,
              padding: '36px 28px 24px',
              width: '100%',
              maxWidth: 320,
              textAlign: 'center',
              animation: 'popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>{meta.emoji}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{meta.title}</div>
            <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: 28 }}>{meta.desc}</div>
            <button
              onClick={shareOne}
              style={{
                width: '100%', padding: '14px 0', border: 'none', borderRadius: 14,
                background: 'var(--accent)', color: 'var(--text)',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Поделиться
            </button>
          </div>

          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes popIn { from { transform: scale(0.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }
          `}</style>
        </div>
      )}
    </BottomSheet>
  );
}
