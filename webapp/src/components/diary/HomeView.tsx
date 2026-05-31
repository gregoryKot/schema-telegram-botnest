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
      subtitle: 'Что-то триггернуло? Запиши – ситуацию, чувства, мысли, поведение',
      color: 'var(--c-rose)',
      count: schemaDiaryCount,
      lastDate: lastSchemaDiaryDate,
    },
    {
      type: 'mode',
      emoji: '🔄',
      title: 'Дневник режимов',
      subtitle: 'Поймал себя в знакомом состоянии? Запиши – кто взял управление',
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
    <div className="page-inner-wide">
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          <span style={{ color: 'var(--accent)' }}>● </span>Дневник
        </div>
        <h1 className="hub-title" style={{ marginBottom: 8 }}>
          Замечай<br /><span className="it">паттерны</span>
        </h1>
        <p className="hub-sub" style={{ margin: 0 }}>Фиксируй моменты, следи за динамикой.</p>
      </div>

      {/* Diary type cards */}
      <div className="section">
        <div className="eyebrow" style={{ marginBottom: 20 }}>Что записать сегодня</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          {diaries.map(meta => (
            <div
              key={meta.type}
              onClick={() => onOpen(meta.type)}
              style={{ cursor: 'pointer', padding: '20px 0', borderTop: `2px solid ${meta.color}` }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{meta.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 8, lineHeight: 1.55, maxWidth: 280 }}>{meta.subtitle}</div>
              {meta.count > 0 ? (
                <div style={{ fontSize: 12, color: meta.color, marginTop: 10, fontWeight: 500 }}>
                  {meta.count} {meta.count === 1 ? 'запись' : meta.count < 5 ? 'записи' : 'записей'}
                  {meta.lastDate && ` · ${fmtDateLong(meta.lastDate)}`}
                </div>
              ) : (
                <span className="link" style={{ marginTop: 14, display: 'inline-block', fontSize: 13 }}>+ записать →</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
