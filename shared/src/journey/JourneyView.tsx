// Тело экрана «Мой путь» — единственная копия для обоих фронтендов
// (правило №3 / «одна механика — один компонент»): hero с итогом и
// пояснением, мини-карточки счётчиков, фильтр + сортировка, таймлайн
// (JourneyTimeline). Обёртка (BottomSheet / fixed-оверлей, заголовок,
// кнопка «поделиться лентой») — per-frontend. CSS-переменные определены
// в обоих фронтендах.
import type { CSSProperties, ReactNode } from 'react';
import {
  type JourneyItem,
  JOURNEY_FILTERS,
  groupJourneyByMonth,
} from './journeyMeta';
import type { JourneyState } from './useJourney';
import { JourneyTimeline } from './JourneyTimeline';

export interface JourneyViewProps {
  tr: (ty: string, vy: string) => string;
  /** Состояние из useJourney — одним объектом */
  j: JourneyState;
  subtitle: (item: JourneyItem) => string | null;
  /** Тап по записи ленты → карточка этого шага */
  onShareItem: (item: JourneyItem) => void;
  /** Скелетон по форме контента — из примитивов конкретного фронтенда */
  skeleton: ReactNode;
}

const chipStyle = (active: boolean): CSSProperties => ({
  flexShrink: 0,
  minHeight: 34,
  padding: '0 13px',
  borderRadius: 999,
  border: active
    ? '1px solid transparent'
    : '1px solid rgba(var(--fg-rgb),0.08)',
  fontSize: 12.5,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: active
    ? 'color-mix(in srgb, var(--accent) 18%, transparent)'
    : 'transparent',
  color: active ? 'var(--accent)' : 'var(--text-sub)',
});

const heroBg = (a: number, b: number) =>
  `linear-gradient(135deg, color-mix(in srgb, var(--accent) ${a}%, transparent), color-mix(in srgb, var(--accent-blue) ${b}%, transparent))`;

export function JourneyView({
  tr,
  j,
  subtitle,
  onShareItem,
  skeleton,
}: JourneyViewProps) {
  const { failed, stats, total, items, group, setGroup, sortDir, setSortDir } =
    j;
  const loading = !j.data && !failed;

  // Откуда это и зачем — до первого действия (правило онбординга).
  const explainer = tr(
    'Всё, что ты делаешь в приложении — трекер, дневники, практики, тесты, — собирается здесь, шаг за шагом.',
    'Всё, что вы делаете в приложении — трекер, дневники, практики, тесты, — собирается здесь, шаг за шагом.',
  );

  return (
    <>
      {loading && <div style={{ marginTop: 12 }}>{skeleton}</div>}

      {failed && (
        <div
          style={{
            marginTop: 12,
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.55,
          }}
        >
          {tr(
            'Не получилось загрузить. Проверь интернет и открой ещё раз.',
            'Не получилось загрузить. Проверьте интернет и откройте ещё раз.',
          )}
        </div>
      )}

      {!loading && !failed && total === 0 && (
        <div
          style={{
            marginTop: 12,
            borderRadius: 20,
            padding: '28px 20px',
            textAlign: 'center',
            background: heroBg(9, 7),
          }}
        >
          <div style={{ fontSize: 34, marginBottom: 10 }}>🧭</div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 8,
            }}
          >
            Путь ещё впереди
          </div>
          <div
            style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}
          >
            {explainer}{' '}
            {tr(
              'Начни с трекера или любого дневника — первый шаг появится здесь.',
              'Начните с трекера или любого дневника — первый шаг появится здесь.',
            )}
          </div>
        </div>
      )}

      {!loading && !failed && total > 0 && (
        <>
          {/* Hero: итог + пояснение */}
          <div
            style={{
              marginTop: 12,
              borderRadius: 20,
              padding: '18px 18px 16px',
              background: heroBg(11, 8),
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: '-1.5px',
                  color: 'var(--text)',
                }}
              >
                {total}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-sub)',
                }}
              >
                шагов заботы о себе
              </span>
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 12.5,
                color: 'var(--text-sub)',
                lineHeight: 1.5,
              }}
            >
              {explainer}
            </div>
          </div>

          {/* Счётчики «сколько чего» — лента мини-карточек */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              padding: '12px 2px 4px',
              marginBottom: 6,
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  flexShrink: 0,
                  minWidth: 86,
                  padding: '10px 12px',
                  borderRadius: 16,
                  background: 'rgba(var(--fg-rgb),0.04)',
                }}
              >
                <div style={{ fontSize: 17, lineHeight: 1.2 }}>
                  {s.emoji}{' '}
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {s.count}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-faint)',
                    marginTop: 3,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Фильтр по типу + сортировка по времени */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: '6px 0 12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                flex: 1,
                paddingBottom: 2,
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
              aria-label={
                sortDir === 'desc' ? 'Сначала новые' : 'Сначала старые'
              }
              style={{ ...chipStyle(false), flexShrink: 0 }}
            >
              {sortDir === 'desc' ? '↓ новые' : '↑ старые'}
            </button>
          </div>

          {items.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-faint)',
                padding: '10px 2px',
              }}
            >
              В этой группе пока пусто
            </div>
          ) : (
            <>
              <JourneyTimeline
                groups={groupJourneyByMonth(items)}
                subtitle={subtitle}
                onShareItem={onShareItem}
              />
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-faint)',
                  padding: '2px 2px 0',
                }}
              >
                Тап по записи — поделиться этим шагом
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
