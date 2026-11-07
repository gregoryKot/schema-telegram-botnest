import { ScreenSkeleton, Skeleton } from '../Skeleton';
import { SidebarSkeleton } from './SidebarRail';
import type { Section } from './navigation';

// Силуэт кабинета на первой загрузке: сайдбар (SidebarSkeleton — свёрнутый или нет), топбар и раздел по форме
// контента. До QA 2026-11 (B-З8) здесь был спиннер на пустом бежевом экране —
// без сайдбара, и человек 2–3 секунды не видел, куда попал. Примитивы — общий
// Skeleton.tsx (правило «скелетоны по форме контента»).

// Раскладка «Сегодня» (client-today.css: колонка 600px, шапка, плитки 124px; ритм —
// от ds-page) инлайном: стили раздела приезжают с ленивым чанком, а силуэт нужен до него.
const COLUMN = { display: 'flex', flexDirection: 'column' } as const;

function TodaySkeleton() {
  return (
    <div className="ds-page" style={{ maxWidth: 600 }} data-testid="today-skeleton">
      <div style={{ ...COLUMN, gap: 8 }}>
        <Skeleton width={140} height={12} />
        <Skeleton width="60%" height={34} radius={10} />
      </div>
      <div style={{ ...COLUMN, gap: 12 }}>
        {[0, 1, 2].map(i => <Skeleton key={i} height={124} radius={20} />)}
      </div>
      <Skeleton width="40%" height={20} />
    </div>
  );
}

export function AppShellSkeleton({ section, therapistMode }: { section: Section; therapistMode: boolean }) {
  return (
    <div className="app-shell light-lock" aria-busy="true" data-testid="app-shell-skeleton">
      <SidebarSkeleton />
      <div className="main">
        <div className="topbar" aria-hidden="true" />
        <div className="canvas">
          <div className="page">
            {section === 'today' && !therapistMode ? <TodaySkeleton /> : <ScreenSkeleton />}
          </div>
        </div>
      </div>
    </div>
  );
}
