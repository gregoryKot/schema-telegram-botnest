import { DiaryType } from '../../types';
import { useSafeTop } from '../../utils/safezone';
import { fmtDateLong } from '../../utils/format';
import { haptic } from '../../haptic';

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


function DiaryCard({ meta, onOpen }: { meta: DiaryMeta; onOpen: () => void }) {
  return (
    <div
      onClick={() => { haptic.tap(); onOpen(); }}
      className="card"
      style={{
        borderRadius: 20,
        marginBottom: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'stretch',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
        transition: 'opacity 120ms',
      }}
    >
      {/* Left color accent bar */}
      <div style={{ width: 4, flexShrink: 0, background: meta.color, opacity: 0.7 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 16px', flex: 1 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: `${meta.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
        }}>
          {meta.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
            {meta.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.4 }}>
            {meta.subtitle}
          </div>
          {meta.count > 0 && (
            <div style={{ fontSize: 11, color: meta.color, marginTop: 6, fontWeight: 500 }}>
              {meta.count} {meta.count === 1 ? 'запись' : meta.count < 5 ? 'записи' : 'записей'}
              {meta.lastDate && ` · последняя ${fmtDateLong(meta.lastDate)}`}
            </div>
          )}
        </div>
        <div style={{ color: 'var(--text-faint)', fontSize: 20, flexShrink: 0 }}>›</div>
      </div>
    </div>
  );
}

export function HomeView({ schemaDiaryCount, modeDiaryCount, gratitudeDiaryCount, lastSchemaDiaryDate, lastModeDiaryDate, lastGratitudeDiaryDate, onOpen, onClose }: Props) {
  const diaries: DiaryMeta[] = [
    {
      type: 'schema',
      emoji: '📓',
      title: 'Дневник схем',
      subtitle: 'Что-то триггернуло? Запиши — ситуацию, чувства, мысли',
      color: 'var(--accent-red)',
      count: schemaDiaryCount,
      lastDate: lastSchemaDiaryDate,
    },
    {
      type: 'mode',
      emoji: '🔄',
      title: 'Дневник режимов',
      subtitle: 'Поймал себя в знакомом состоянии? Запиши — кто взял управление',
      color: 'var(--accent-blue)',
      count: modeDiaryCount,
      lastDate: lastModeDiaryDate,
    },
    {
      type: 'gratitude',
      emoji: '🌱',
      title: 'Дневник благодарности',
      subtitle: 'Три вещи, за которые можно сказать спасибо сегодня',
      color: 'var(--accent-green)',
      count: gratitudeDiaryCount,
      lastDate: lastGratitudeDiaryDate,
    },
  ];

  const safeTop = useSafeTop();

  return (
    <div style={{ padding: `${safeTop + 16}px 16px 32px` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {onClose && <span onClick={onClose} style={{ fontSize: 26, color: 'var(--text-sub)', cursor: 'pointer', lineHeight: 1 }}>‹</span>}
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Мои дневники</span>
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
          Замечай паттерны, фиксируй моменты. Веди один или все три — как тебе удобно.
        </div>
      </div>
      {diaries.map(meta => (
        <DiaryCard key={meta.type} meta={meta} onOpen={() => onOpen(meta.type)} />
      ))}
    </div>
  );
}
