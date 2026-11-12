// Тело экрана «Мой путь» — одна копия (правило №3): герой, плитки счётчиков, чипы периода и групп,
// лента. Вёрстку героя, плитки, чипа и знак строки даёт площадка (`kit`, journeyKit.ts); обёртка
// (лист, заголовок) — площадки. Классы jr-* и pa-spread — webapp/src/styles/journey.css, paper-app.css:
// на ≥1024 герой слева липнет, лента справа (разворот, docs/design/APP_2026-11.md, принцип 4).
import type { ReactNode } from 'react';
import {
  type JourneyItem,
  JOURNEY_FILTERS,
  JOURNEY_PERIODS,
  groupJourneyByMonth,
} from './journeyMeta';
import type { JourneyState } from './useJourney';
import { JourneyTimeline } from './JourneyTimeline';
import { journeyStatLook } from './journeyLook';
import { spreadStatTiles } from './journeyStatOrder';
import type { JourneyKit } from './journeyKit';

export interface JourneyViewProps {
  tr: (ty: string, vy: string) => string;
  /** Состояние из useJourney — одним объектом */
  j: JourneyState;
  subtitle: (item: JourneyItem) => string | null;
  /** Тап по записи ленты → открыть запись целиком (детальный вид) */
  onOpenItem: (item: JourneyItem) => void;
  /** Кнопка в hero → карточка итогов («дневник 5 раз, трекер 7 раз…») */
  onShareFeed: () => void;
  /** Вёрстка героя, плитки, чипа и знак строки от площадки (journeyKit.ts) */
  kit: JourneyKit;
  /** Скелетон по форме контента — из примитивов конкретного фронтенда */
  skeleton: ReactNode;
  /** Пустой путь — кнопка героя открывает трекер; нет — герой без кнопки. */
  onStart?: () => void;
}

/** Плиток счётчиков — 2×3: самые частые занятия; остальное видно в ленте и фильтрах. */
export const JOURNEY_STAT_TILES = 6;

export function JourneyView({
  tr,
  j,
  subtitle,
  onOpenItem,
  onShareFeed,
  kit,
  skeleton,
  onStart,
}: JourneyViewProps) {
  const {
    failed,
    stats,
    total,
    items,
    group,
    setGroup,
    period,
    setPeriod,
    sortDir,
    setSortDir,
  } = j;
  const loading = !j.data && !failed;
  const { Hero, EmptyHero, Stat, Chip } = kit;

  // Откуда это и зачем — до первого действия (правило онбординга).
  const explainer = tr(
    'Всё, что ты делаешь в приложении — трекер, дневники, практики, тесты, — собирается здесь, шаг за шагом.',
    'Всё, что вы делаете в приложении — трекер, дневники, практики, тесты, — собирается здесь, шаг за шагом.',
  );

  if (loading) return <div className="u-mt12">{skeleton}</div>;
  if (failed)
    return (
      <p className="jr-note">
        {tr(
          'Не получилось загрузить. Проверь интернет и открой ещё раз.',
          'Не получилось загрузить. Проверьте интернет и откройте ещё раз.',
        )}
      </p>
    );
  if (total === 0)
    return <EmptyHero tr={tr} explainer={explainer} onStart={onStart} />;

  return (
    <div className="pa-spread jr-spread">
      <div className="pa-spread-side">
        <Hero total={total} explainer={explainer} onShareFeed={onShareFeed} />
      </div>
      <div className="pa-spread-main">
        {/* Счётчики «сколько чего» — плитки бумаги со знаком занятия */}
        <div className="jr-stats">
          {spreadStatTiles(
            stats.slice(0, JOURNEY_STAT_TILES),
            (s) => journeyStatLook(s.type)?.hue,
          ).map((s) => (
            <Stat key={s.label} row={s} />
          ))}
        </div>

        {/* Период (всё время/неделя/месяц) + сортировка по времени */}
        <div className="jr-chips">
          {JOURNEY_PERIODS.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              on={period === p.id}
              onToggle={() => setPeriod(p.id)}
            />
          ))}
          <button
            type="button"
            className="ds-chip jr-sort"
            onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
            aria-label={sortDir === 'desc' ? 'Сначала новые' : 'Сначала старые'}
          >
            {sortDir === 'desc' ? '↓ новые' : '↑ старые'}
          </button>
        </div>

        {/* Фильтр по типу */}
        <div className="jr-chips">
          {JOURNEY_FILTERS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              on={group === f.id}
              onToggle={() => setGroup(f.id)}
            />
          ))}
        </div>

        {items.length === 0 ? (
          <p className="jr-note">
            Здесь пока пусто — в другом периоде или группе записи есть
          </p>
        ) : (
          <>
            <JourneyTimeline
              groups={groupJourneyByMonth(items)}
              subtitle={subtitle}
              onOpenItem={onOpenItem}
              rowArt={kit.rowArt}
            />
            <p className="jr-note jr-note--hint">
              Тап по записи — открыть и поделиться
            </p>
          </>
        )}
      </div>
    </div>
  );
}
