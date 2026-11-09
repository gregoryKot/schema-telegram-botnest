import { NavLink } from 'react-router-dom';
import type { TherapyClientSummary } from '../../api';
import { BrandMark } from '../art/BrandMark';
import { clientHue, hueStyle } from '../../lib/tone';
import { todayStr } from '../../utils/format';
import { sortRoster } from '../therapist/rosterOrder';
import { clientAvatarInitials, clientDisplayName } from '../../../../shared/src/therapy/clientInitials';
import { clientRef } from '../../../../shared/src/utils/clientRef';
import { BrandHomeLink, type BrandMenu } from './BrandHome';
import { NavSign, type NavSignKey } from './NavSign';
import { SECTION_LOOK, THERAPIST_NAV } from './navLook';
import type { Section } from './navigation';
import { useScreenShare } from './screenShareMode';
import { setSidebarCollapsed } from './sidebarCollapse';

// Части бокового меню, которые зависят от того, свёрнуто ли оно (sidebarCollapse.ts):
// шапка с кнопкой «свернуть» и свёрнутая полоска со знаками; силуэт меню на загрузке — SidebarSkeleton.tsx.
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

/** Знак и название. В меню (`menu`) — ссылка на главную и кнопка «свернуть»; без — силуэт загрузки, лендинг. */
export function SidebarBrand({ menu }: { menu?: BrandMenu }) {
  const mark = <><BrandMark size={32} /><span className="sb-name">Всё по схеме</span></>;
  return (
    <div className="sb-brand">
      {menu ? <><BrandHomeLink {...menu}>{mark}</BrandHomeLink><SidebarToggle collapsed={false} /></> : mark}
    </div>
  );
}

/** Верх свёрнутой полоски: знак на месте развёрнутого (меню не прыгает), под ним шеврон;
 *  в силуэте загрузки вместо шеврона — плашка (SidebarSkeleton). */
export function RailHead({ menu }: { menu?: BrandMenu }) {
  return (
    <div className="sb-rail-head">
      {menu ? <BrandHomeLink {...menu}><BrandMark size={32} /></BrandHomeLink> : <BrandMark size={32} />}
      {menu ? <SidebarToggle collapsed /> : <span className="skel sb-skel" style={{ width: 44, height: 44 }} aria-hidden />}
    </div>
  );
}

type RailItem = { to: string; sign: NavSignKey; label: string; end?: boolean };
const railClass = ({ isActive }: { isActive: boolean }) => `sb-item sb-rail-item${isActive ? ' is-active' : ''}`;
// Подпись пункта — aria-label и title: текста рядом со знаком в полоске нет.
const railLink = ({ to, sign, label, end }: RailItem) => (
  <NavLink key={to} to={to} end={end} className={railClass} aria-label={label} title={label}>
    <NavSign sign={sign} />
  </NavLink>
);
/** Сколько клиентов кабинета видно в полоске: остальные — в развёрнутом меню и «Все клиенты». */
const RAIL_CLIENTS = 6;

interface RailProps {
  items: { id: Section; label: string }[];
  therapistMode: boolean;
  displayName: string | null;
  /** Клиенты кабинета — бледными кружками под пунктами; в «Показе экрана» их нет. */
  clients?: TherapyClientSummary[];
}

/** Свёрнутое меню: полоска со знаками разделов (те же, что в развёрнутом, navLook.ts) и аватаром профиля. */
export function SidebarRail({ items, therapistMode, displayName, clients = [] }: RailProps) {
  const account = displayName || 'Профиль';
  const screenShare = useScreenShare();
  const { today, guide, tasks, clients: all } = THERAPIST_NAV;
  const shown = therapistMode && !screenShare ? sortRoster(clients, todayStr()).slice(0, RAIL_CLIENTS) : [];
  return (
    <aside className="sidebar is-collapsed">
      <RailHead menu={{ therapistMode }} />
      <nav className="sb-nav">
        {therapistMode
          ? [today, guide, tasks, all].map(railLink)
          : items.map((i) => railLink({ to: '/' + i.id, sign: SECTION_LOOK[i.id].sign, label: i.label }))}
        {shown.length > 0 && <span className="sb-rail-rule" aria-hidden="true" />}
        {shown.map(c => {
          const name = clientDisplayName(c);
          return (
            <NavLink key={c.telegramId} to={`/cabinet/${clientRef(c)}`} className={railClass} aria-label={name} title={name}>
              <span className="sb-client-av" style={hueStyle(clientHue(c.telegramId))}>{clientAvatarInitials(c)}</span>
            </NavLink>
          );
        })}
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
