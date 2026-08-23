// Тепловая карта активности — тяжёлый запрос (history?days=112, 112 дней
// истории) вынесен из общей загрузки профиля и грузится лениво, только
// когда карточка реально показалась во вьюпорте (useOnVisible), а не сразу
// при монтировании секции. Замер 2026-08-22: этот запрос был самым долгим
// из четырёх блокирующих (контент экрана держался 1321мс на медленном
// профиле), хотя карта — ниже первого экрана и не нужна сразу.
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useOnVisible } from '../../hooks/useOnVisible';
import { Skeleton } from '../../components/Skeleton';
import { ActivityHeatmap, HEATMAP_CELL_GAP } from './ActivityHeatmap';

interface Props {
  /** Для подписи карточки «Мой месяц» (шэр) — берётся из уже загруженного
   * стрика, отдельного запроса не требует. */
  totalDays: number;
}

export function HeatmapCard({ totalDays }: Props) {
  const { ref, visible } = useOnVisible<HTMLDivElement>();
  const [activeDates, setActiveDates] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!visible || activeDates !== null) return;
    let ignore = false;
    api
      .history(112)
      .then((h) => {
        if (!ignore) setActiveDates(new Set(h.map((d) => d.date)));
      })
      .catch((e) => {
        console.error('history failed', e);
        // Фолбэк — пустой набор, а не бесконечный скелетон: карточка ведёт
        // себя как на чистом аккаунте (правило CLAUDE.md против заглушек —
        // это реальное отсутствие данных, не выдуманные цифры).
        if (!ignore) setActiveDates(new Set());
      });
    return () => {
      ignore = true;
    };
  }, [visible, activeDates]);

  // Как и раньше: без единой активной даты карточку не показываем вовсе —
  // фиксированный силуэт соврал бы форме на чистом аккаунте.
  if (activeDates !== null && activeDates.size === 0) return null;

  return (
    <div ref={ref}>
      {activeDates === null ? (
        <HeatmapCardSkeleton />
      ) : (
        <ActivityHeatmap activeDates={activeDates} totalDays={totalDays} />
      )}
    </div>
  );
}

function HeatmapCardSkeleton() {
  return (
    <div
      data-testid="heatmap-skeleton"
      className="card"
      style={{ borderRadius: 'var(--r-20)', padding: '16px 16px 14px' }}
    >
      <Skeleton w={90} h={10} radius={4} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: HEATMAP_CELL_GAP }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: HEATMAP_CELL_GAP,
            }}
          >
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} w={13} h={13} radius={3} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
