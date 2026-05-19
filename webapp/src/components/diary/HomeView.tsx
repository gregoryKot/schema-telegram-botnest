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
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 8 }}>
        Дневник
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 48 }}>
        Замечай паттерны, фиксируй моменты. Веди один или все три — как тебе удобно.
      </p>

      {/* Diary list */}
      <div className="section">
        <div className="section-head">
          <h3>Типы записей</h3>
        </div>
        {diaries.map(meta => (
          <div key={meta.type} className="list-line" onClick={() => onOpen(meta.type)} style={{ cursor: 'pointer' }}>
            <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: meta.color, flexShrink: 0, opacity: 0.8 }} />
            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              {meta.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.25 }}>{meta.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2, lineHeight: 1.4 }}>{meta.subtitle}</div>
              {meta.count > 0 && (
                <div style={{ fontSize: 11, color: meta.color, marginTop: 4, fontWeight: 500 }}>
                  {meta.count} {meta.count === 1 ? 'запись' : meta.count < 5 ? 'записи' : 'записей'}
                  {meta.lastDate && ` · последняя ${fmtDateLong(meta.lastDate)}`}
                </div>
              )}
            </div>
            <span style={{ fontSize: 16, color: 'var(--text-ghost)', flexShrink: 0 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
