import { DiaryType } from '../types';

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
}

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}

function DiaryCard({ meta, onOpen }: { meta: DiaryMeta; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 20,
        padding: '18px 18px',
        marginBottom: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        border: `1px solid rgba(255,255,255,0.06)`,
        transition: 'background 150ms',
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        background: `${meta.color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
      }}>
        {meta.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
          {meta.subtitle}
        </div>
        {meta.count > 0 && (
          <div style={{ fontSize: 11, color: meta.color, marginTop: 6, fontWeight: 500 }}>
            {meta.count} {meta.count === 1 ? 'запись' : meta.count < 5 ? 'записи' : 'записей'}
            {meta.lastDate && ` · последняя ${formatDate(meta.lastDate)}`}
          </div>
        )}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 20, flexShrink: 0 }}>›</div>
    </div>
  );
}

export function HomeView({ schemaDiaryCount, modeDiaryCount, gratitudeDiaryCount, lastSchemaDiaryDate, lastModeDiaryDate, lastGratitudeDiaryDate, onOpen }: Props) {
  const diaries: DiaryMeta[] = [
    {
      type: 'schema',
      emoji: '📓',
      title: 'Дневник схем',
      subtitle: 'Когда схема активировалась — ситуация, эмоции, мысли',
      color: '#f87171',
      count: schemaDiaryCount,
      lastDate: lastSchemaDiaryDate,
    },
    {
      type: 'mode',
      emoji: '🔄',
      title: 'Дневник режимов',
      subtitle: 'Какой режим включился и что его запустило',
      color: '#60a5fa',
      count: modeDiaryCount,
      lastDate: lastModeDiaryDate,
    },
    {
      type: 'gratitude',
      emoji: '🌱',
      title: 'Дневник благодарности',
      subtitle: 'Три вещи, за которые ты благодарен сегодня',
      color: '#34d399',
      count: gratitudeDiaryCount,
      lastDate: lastGratitudeDiaryDate,
    },
  ];

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Дневники</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          Инструменты схема-терапии для самонаблюдения. Веди один или все три — как удобно.
        </div>
      </div>
      {diaries.map(meta => (
        <DiaryCard key={meta.type} meta={meta} onOpen={() => onOpen(meta.type)} />
      ))}
    </div>
  );
}
