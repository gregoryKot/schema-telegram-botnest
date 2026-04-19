import { DiaryType } from '../types';
import { haptic } from '../haptic';

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
  streak?: number;
  onOpen: (type: DiaryType) => void;
}

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}

function DiaryCard({ meta, onOpen }: { meta: DiaryMeta; onOpen: () => void }) {
  return (
    <div
      onClick={() => { haptic.tap(); onOpen(); }}
      className="card"
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 18,
        marginBottom: 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'stretch',
        border: '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}
    >
      {/* Left color accent bar */}
      <div style={{ width: 3, background: meta.color, flexShrink: 0, opacity: 0.85 }} />

      {/* Icon */}
      <div style={{
        width: 46, height: 46, borderRadius: 13, flexShrink: 0,
        background: `${meta.color}1a`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, margin: '14px 0 14px 14px',
      }}>
        {meta.emoji}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, padding: '14px 0 14px 13px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.45 }}>
          {meta.subtitle}
        </div>
        {meta.count > 0 ? (
          <div style={{ fontSize: 11, color: meta.color, marginTop: 6, fontWeight: 500, opacity: 0.9 }}>
            {meta.count} {meta.count === 1 ? 'запись' : meta.count < 5 ? 'записи' : 'записей'}
            {meta.lastDate && ` · ${formatDate(meta.lastDate)}`}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 6 }}>
            Пока пусто
          </div>
        )}
      </div>

      {/* Chevron */}
      <div style={{
        color: 'rgba(255,255,255,0.18)',
        fontSize: 20,
        flexShrink: 0,
        alignSelf: 'center',
        paddingRight: 14,
        fontWeight: 300,
      }}>›</div>
    </div>
  );
}

export function HomeView({ schemaDiaryCount, modeDiaryCount, gratitudeDiaryCount, lastSchemaDiaryDate, lastModeDiaryDate, lastGratitudeDiaryDate, streak, onOpen }: Props) {
  const diaries: DiaryMeta[] = [
    {
      type: 'schema',
      emoji: '📓',
      title: 'Дневник схем',
      subtitle: 'Что произошло, что почувствовал/а, какая схема включилась',
      color: '#f87171',
      count: schemaDiaryCount,
      lastDate: lastSchemaDiaryDate,
    },
    {
      type: 'mode',
      emoji: '🔄',
      title: 'Дневник режимов',
      subtitle: 'Какой режим взял управление — и почему',
      color: '#60a5fa',
      count: modeDiaryCount,
      lastDate: lastModeDiaryDate,
    },
    {
      type: 'gratitude',
      emoji: '🌱',
      title: 'Дневник благодарности',
      subtitle: 'За что ты благодарен сегодня — даже самое маленькое',
      color: '#34d399',
      count: gratitudeDiaryCount,
      lastDate: lastGratitudeDiaryDate,
    },
  ];

  return (
    <div style={{ padding: '20px 16px 36px' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px' }}>
            Мои дневники
          </div>
          {streak != null && streak > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(251,146,60,0.15)',
              border: '1px solid rgba(251,146,60,0.3)',
              borderRadius: 20, padding: '5px 10px',
            }}>
              <span style={{ fontSize: 14 }}>🔥</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fb923c' }}>{streak}</span>
            </div>
          )}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
          Место для честного разговора с собой
        </div>
      </div>
      {diaries.map(meta => (
        <DiaryCard key={meta.type} meta={meta} onOpen={() => onOpen(meta.type)} />
      ))}
    </div>
  );
}
