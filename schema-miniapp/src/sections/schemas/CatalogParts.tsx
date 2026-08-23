// Скелетон списка «Мои схемы»/«Мои режимы» — общий для вкладок «Схемы» и
// «Режимы» (правило «одна механика — один компонент»).
//
// Форма — как у реального PatternFrequencyList (components/PatternFrequencyList.tsx):
// одна карточка-группа со строками высотой 60px, разделёнными тонкой линией,
// имя слева + полоска частоты справа. Раньше здесь рисовались чипы
// (ChipsSkeleton) — реальный контент вкладки «Паттерны» им не является:
// это список строк, а не облако тегов (скрин владельца 2026-08-23,
// «скелетоны выглядят сломанными»). Количество строк — по факту известных
// локально id (useMySelections читает их из localStorage синхронно, ещё до
// ответа профиля), минимум 3 — не меньше, чем разумно ожидать.
import { Skeleton } from '../../components/Skeleton';

const ROW_NAME_WIDTHS = ['62%', '46%', '54%', '38%', '58%'];

export function PatternListSkeleton({ rows }: { rows: number }) {
  const n = Math.max(3, rows);
  return (
    <div
      className="card"
      style={{ borderRadius: 'var(--r-16)', overflow: 'hidden' }}
    >
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          style={{
            minHeight: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-10)',
            padding: '14px 16px',
            borderTop: i === 0 ? 'none' : '1px solid var(--border-color)',
          }}
        >
          <Skeleton
            w={ROW_NAME_WIDTHS[i % ROW_NAME_WIDTHS.length]}
            h={14}
            radius={6}
          />
          <Skeleton w={34} h={12} radius={6} />
        </div>
      ))}
    </div>
  );
}
