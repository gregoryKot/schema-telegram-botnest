// Тело экрана «Мой путь» — единственная копия для обоих фронтендов
// (правило №3 / «одна механика — один компонент»): пояснение, счётчики,
// фильтр, сортировка по времени и лента. Обёртка (BottomSheet / fixed-оверлей,
// заголовок, кнопка шаринга) — per-frontend. CSS-переменные (--accent,
// --text-sub, --fg-rgb…) определены в обоих фронтендах.
import type { CSSProperties, ReactNode } from 'react';
import {
  type JourneyItem,
  JOURNEY_FILTERS,
  formatJourneyDate,
  journeyTypeMeta,
} from './journeyMeta';
import type { JourneyState } from './useJourney';

export interface JourneyViewProps {
  tr: (ty: string, vy: string) => string;
  /** Состояние из useJourney — одним объектом */
  j: JourneyState;
  subtitle: (item: JourneyItem) => string | null;
  /** Скелетон по форме контента — из примитивов конкретного фронтенда */
  skeleton: ReactNode;
}

const chipStyle = (active: boolean): CSSProperties => ({
  flexShrink: 0,
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 10,
  border: 'none',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: active
    ? 'color-mix(in srgb, var(--accent) 16%, transparent)'
    : 'rgba(var(--fg-rgb),0.05)',
  color: active ? 'var(--accent)' : 'var(--text-sub)',
});

export function JourneyView({ tr, j, subtitle, skeleton }: JourneyViewProps) {
  const { failed, stats, total, items, group, setGroup, sortDir, setSortDir } =
    j;
  const loading = !j.data && !failed;
  return (
    <>
      {/* Откуда это и зачем — до первого действия (правило онбординга) */}
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          lineHeight: 1.55,
          margin: '8px 0 16px',
        }}
      >
        {tr(
          'Всё, что ты делаешь в приложении — трекер, дневники, практики, тесты, — собирается здесь. Видно, как накапливается забота о себе, и этим можно поделиться.',
          'Всё, что вы делаете в приложении — трекер, дневники, практики, тесты, — собирается здесь. Видно, как накапливается забота о себе, и этим можно поделиться.',
        )}
      </p>

      {loading && skeleton}

      {failed && (
        <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>
          {tr(
            'Не получилось загрузить. Проверь интернет и открой ещё раз.',
            'Не получилось загрузить. Проверьте интернет и откройте ещё раз.',
          )}
        </div>
      )}

      {!loading && !failed && total === 0 && (
        <div
          style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.55 }}
        >
          {tr(
            'Пока записей нет. Начни с трекера потребностей или любого дневника — первый шаг появится здесь.',
            'Пока записей нет. Начните с трекера потребностей или любого дневника — первый шаг появится здесь.',
          )}
        </div>
      )}

      {!loading && !failed && total > 0 && (
        <>
          {/* Счётчики «сколько чего» */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '7px 10px',
                borderRadius: 10,
                background:
                  'color-mix(in srgb, var(--accent) 14%, transparent)',
                color: 'var(--accent)',
              }}
            >
              Всего шагов: {total}
            </span>
            {stats.map((s) => (
              <span
                key={s.label}
                style={{
                  fontSize: 12,
                  padding: '7px 10px',
                  borderRadius: 10,
                  background: 'rgba(var(--fg-rgb),0.05)',
                  color: 'var(--text-sub)',
                }}
              >
                {s.emoji} {s.label}: {s.count}
              </span>
            ))}
          </div>

          {/* Фильтр по типу + сортировка по времени */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              flexWrap: 'wrap',
              paddingBottom: 6,
              marginBottom: 4,
            }}
          >
            {JOURNEY_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setGroup(f.id)}
                style={chipStyle(group === f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
            style={{
              ...chipStyle(false),
              background: 'transparent',
              marginBottom: 10,
            }}
          >
            {sortDir === 'desc' ? '↓ Сначала новые' : '↑ Сначала старые'}
          </button>

          {/* Лента */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>
                В этой группе пока пусто
              </div>
            )}
            {items.map((item, i) => {
              const meta = journeyTypeMeta(item.type);
              const sub = subtitle(item);
              return (
                <div
                  key={`${item.type}-${item.at}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 14,
                    background: 'rgba(var(--fg-rgb),0.03)',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      {meta.label}
                    </span>
                    {sub && (
                      <span
                        style={{
                          display: 'block',
                          fontSize: 11,
                          color: 'var(--text-faint)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {sub}
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-faint)',
                      flexShrink: 0,
                    }}
                  >
                    {formatJourneyDate(item.at)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
