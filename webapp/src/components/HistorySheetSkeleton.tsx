// Скелетон истории потребностей — по форме контента HistoryView (правило
// CLAUDE.md «скелетоны по форме, не спиннеры»): круглое колесо потребностей
// + список строк вместо серого прямоугольника/крутилки.
import { Skeleton } from './Skeleton';

export function HistorySheetSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        padding: '20px 20px 40px',
      }}
    >
      <Skeleton width={220} height={220} radius={110} />
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton width="60%" height={12} />
        <Skeleton width="100%" height={44} radius={14} />
        <Skeleton width="100%" height={44} radius={14} />
        <Skeleton width="100%" height={44} radius={14} />
      </div>
    </div>
  );
}
