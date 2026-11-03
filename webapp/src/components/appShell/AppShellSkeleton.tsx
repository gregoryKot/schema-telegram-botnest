import { ScreenSkeleton, Skeleton } from '../Skeleton';
import { SidebarBrand } from './Sidebar';
import type { Section } from './navigation';

// Силуэт кабинета на первой загрузке: сайдбар, топбар и раздел по форме
// контента. До QA 2026-11 (B-З8) здесь был спиннер на пустом бежевом экране —
// без сайдбара, и человек 2–3 секунды не видел, куда попал. Примитивы — общий
// Skeleton.tsx (правило «скелетоны по форме контента»).

const SIDEBAR_BAR = { background: 'var(--ink-2)' };
// Раскладка «Сегодня» (client-today.css: колонка 600px, шапка, плитки 124px)
// инлайном: стили раздела приезжают с его ленивым чанком, а силуэт нужен до него.
const COLUMN = { display: 'flex', flexDirection: 'column' } as const;

function TodaySkeleton() {
  return (
    <div className="ds-page" style={{ maxWidth: 600, gap: 24 }} data-testid="today-skeleton">
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
      <aside className="sidebar" aria-hidden="true">
        <SidebarBrand />
        <div className="sb-nav">
          {[0, 1, 2].map(i => <Skeleton key={i} height={44} style={SIDEBAR_BAR} />)}
        </div>
        <div className="sb-foot-wrap">
          <Skeleton height={96} radius={14} style={SIDEBAR_BAR} />
          <Skeleton height={44} style={SIDEBAR_BAR} />
        </div>
      </aside>
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
