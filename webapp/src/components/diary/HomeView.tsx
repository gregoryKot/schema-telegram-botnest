import type { DiaryType } from '../../types';
import { fmtDateLong } from '../../utils/format';

interface DiaryMeta {
  type: DiaryType;
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  count: number;
  lastDate?: string;
}

interface Props {
  schemaDiaryCount: number;
  modeDiaryCount: number;
  gratitudeDiaryCount: number;
  lastSchemaDiaryDate?: string;
  lastModeDiaryDate?: string;
  lastGratitudeDiaryDate?: string;
  onOpen: (type: DiaryType) => void;
  onClose?: () => void;
}

export function HomeView({ schemaDiaryCount, modeDiaryCount, gratitudeDiaryCount, lastSchemaDiaryDate, lastModeDiaryDate, lastGratitudeDiaryDate, onOpen, onClose: _onClose }: Props) {
  const diaries: DiaryMeta[] = [
    {
      type: 'schema',
      emoji: '📓',
      title: 'Дневник схем',
      subtitle: 'Что-то триггернуло? Запиши — ситуацию, чувства, мысли, поведение',
      color: 'var(--c-rose)',
      count: schemaDiaryCount,
      lastDate: lastSchemaDiaryDate,
    },
    {
      type: 'mode',
      emoji: '🔄',
      title: 'Дневник режимов',
      subtitle: 'Поймал себя в знакомом состоянии? Запиши — кто взял управление',
      color: 'var(--c-slate)',
      count: modeDiaryCount,
      lastDate: lastModeDiaryDate,
    },
    {
      type: 'gratitude',
      emoji: '🌱',
      title: 'Дневник благодарности',
      subtitle: 'Три вещи, за которые можно сказать спасибо сегодня',
      color: 'var(--c-moss)',
      count: gratitudeDiaryCount,
      lastDate: lastGratitudeDiaryDate,
    },
  ];

  return (
    <div className="page-inner">
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.6px', color: 'var(--text)', marginBottom: 10 }}>
          Дневник
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.6, maxWidth: 520 }}>
          Замечай паттерны, фиксируй моменты. Веди один или все три — как тебе удобно.
        </p>
      </div>

      {/* Diary cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
        {diaries.map(meta => (
          <div
            key={meta.type}
            onClick={() => onOpen(meta.type)}
            style={{
              display: 'flex', alignItems: 'center', gap: 18,
              padding: '20px 20px',
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
          >
            {/* Accent bar */}
            <div style={{ width: 4, height: 48, borderRadius: 4, background: meta.color, flexShrink: 0, opacity: 0.75 }} />

            {/* Icon */}
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}>
              {meta.emoji}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{meta.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.4 }}>{meta.subtitle}</div>
              {meta.count > 0 && (
                <div style={{ fontSize: 12, color: meta.color, marginTop: 5, fontWeight: 500 }}>
                  {meta.count} {meta.count === 1 ? 'запись' : meta.count < 5 ? 'записи' : 'записей'}
                  {meta.lastDate && ` · последняя ${fmtDateLong(meta.lastDate)}`}
                </div>
              )}
            </div>

            <span style={{ fontSize: 18, color: 'var(--text-ghost)', flexShrink: 0 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
