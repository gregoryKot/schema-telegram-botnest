import { Link, NavLink } from 'react-router-dom';
import { Skeleton } from '../Skeleton';
import { MobileNavIcon, type MobileNavIconId } from './MobileNavIcon';
import type { Section } from './navigation';
import { setSidebarCollapsed, useSidebarCollapsed } from './sidebarCollapse';

// Части бокового меню, которые зависят от того, свёрнуто ли оно (sidebarCollapse.ts):
// шапка с кнопкой «свернуть», свёрнутая полоска с иконками и силуэт меню на загрузке.
// Развёрнутое меню — Sidebar.tsx. На телефоне меню скрыто целиком (index.css), там MobileNav.
// Ширину колонки задаёт .sidebar.is-collapsed через --sidebar-w (index.css): контент справа,
// холст «Графических карт» в том числе, забирает освободившееся место сам.

/** Кнопка «свернуть / развернуть меню»: шеврон, тап-цель 44×44 (.sb-toggle). */
export function SidebarToggle({ collapsed }: { collapsed: boolean }) {
  const label = collapsed ? 'Развернуть меню' : 'Свернуть меню';
  return (
    <button type="button" className="sb-toggle" aria-label={label} title={label} aria-expanded={!collapsed}
            onClick={() => setSidebarCollapsed(!collapsed)}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points={collapsed ? '9 6 15 12 9 18' : '15 6 9 12 15 18'} />
      </svg>
    </button>
  );
}

/** Логотип и название — общие у меню и его силуэта на загрузке; у меню справа — кнопка «свернуть». */
export function SidebarBrand({ toggle = false }: { toggle?: boolean }) {
  return (
    <div className="sb-brand">
      <div className="sb-logo">В</div>
      <div className="sb-name">Всё по схеме</div>
      {toggle && <SidebarToggle collapsed={false} />}
    </div>
  );
}

type RailItem = { to: string; icon: MobileNavIconId; label: string };
// Кабинет — те же пункты и порядок, что в развёрнутом меню («Справочник» до клиентов);
// список клиентов, поиск и «Показ экрана» — только в развёрнутом.
const THERAPIST_ITEMS: RailItem[] = [
  { to: '/cabinet/today', icon: 'today', label: 'Сегодня' },
  { to: '/cabinet/guide', icon: 'guide', label: 'Справочник' },
];
const railClass = (on: boolean) => `sb-item sb-rail-item${on ? ' is-active' : ''}`;
// Подпись пункта — aria-label и title: текста рядом с иконкой в полоске нет.
const railLink = ({ to, icon, label }: RailItem) => (
  <NavLink key={to} to={to} className={({ isActive }) => railClass(isActive)} aria-label={label} title={label}>
    <MobileNavIcon id={icon} />
  </NavLink>
);

interface RailProps {
  items: { id: Section; label: string }[];
  therapistMode: boolean;
  /** «Все клиенты» горит на обеих вкладках списка (/cabinet и /cabinet/tasks) — как в Sidebar. */
  onList: boolean;
  displayName: string | null;
}

/** Свёрнутое меню: полоска с иконками разделов и аватаром профиля. */
export function SidebarRail({ items, therapistMode, onList, displayName }: RailProps) {
  const account = displayName || 'Профиль';
  return (
    <aside className="sidebar is-collapsed">
      <SidebarToggle collapsed />
      <nav className="sb-nav">
        {therapistMode ? (<>
          {THERAPIST_ITEMS.map(railLink)}
          <Link to="/cabinet" className={railClass(onList)} aria-current={onList ? 'page' : undefined}
                aria-label="Все клиенты" title="Все клиенты"><MobileNavIcon id="clients" /></Link>
        </>) : items.map((i) => railLink({ to: '/' + i.id, icon: i.id, label: i.label }))}
      </nav>
      <div className="sb-foot-wrap">
        <NavLink to="/profile" className={({ isActive }) => `sb-account sb-rail-account${isActive ? ' is-active' : ''}`}
                 aria-label={account} title={account}>
          <div className="sb-avatar">{account[0].toUpperCase()}</div>
        </NavLink>
      </div>
    </aside>
  );
}

const SIDEBAR_BAR = { background: 'var(--panel-2)' };

/** Силуэт меню на первой загрузке (AppShellSkeleton): свёрнутое — сразу полоской, без прыжка. */
export function SidebarSkeleton() {
  const collapsed = useSidebarCollapsed();
  const square = collapsed ? 44 : undefined;
  return (
    <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`} aria-hidden="true">
      {collapsed ? <Skeleton width={44} height={44} style={SIDEBAR_BAR} /> : <SidebarBrand />}
      <div className="sb-nav">
        {[0, 1, 2].map(i => <Skeleton key={i} width={square} height={44} style={SIDEBAR_BAR} />)}
      </div>
      <div className="sb-foot-wrap">
        {!collapsed && <Skeleton height={96} radius={14} style={SIDEBAR_BAR} />}
        <Skeleton width={square} height={44} style={SIDEBAR_BAR} />
      </div>
    </aside>
  );
}
