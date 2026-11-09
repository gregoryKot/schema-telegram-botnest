import { NavLink } from 'react-router-dom';
import type { TherapyClientSummary } from '../../api';
import type { Need } from '../../types';
import { ModeSwitch } from './ModeSwitch';
import type { Section } from './navigation';
import { SidebarClients } from './SidebarClients';
import { useScreenShare } from './screenShareMode';
import { SidebarBrand, SidebarRail } from './SidebarRail';
import { useSidebarCollapsed } from './sidebarCollapse';
import { useNewTasksCount } from '../../sections/tasks/newTasks';
import { NavSign } from './NavSign';
import { SECTION_LOOK, THERAPIST_NAV, type TherapistNavItem } from './navLook';
import { SidebarFoot } from './SidebarFoot';

const itemClass = ({ isActive }: { isActive: boolean }) => `sb-item${isActive ? ' is-active' : ''}`;
const therapistLink = (i: TherapistNavItem) => (
  <NavLink key={i.to} to={i.to} end={i.end} className={itemClass}><NavSign sign={i.sign} /><span>{i.label}</span></NavLink>
);

interface Props {
  items: { id: Section; label: string }[];
  therapistMode: boolean;
  userRole: 'CLIENT' | 'THERAPIST';
  onSwitchMode: (on: boolean) => void;
  therapistClients: TherapyClientSummary[];
  needs: Need[];
  ratings: Record<string, number>;
  displayName: string | null;
  onOpenTracker: () => void;
  onOpenSettings: () => void;
}

// Сайдбар десктопа — вынесен из AppShell.tsx (правило №10). На телефоне скрыт
// (index.css), там навигация — MobileNav. Свёрнутый — полоска со знаками (SidebarRail).
// Пункт меню — знак сущности раздела (navLook.ts) и подпись; неактивный знак тише, активный —
// в полную силу на плашке --panel-3. Карточка дня и подвал — SidebarFoot.
export function Sidebar({
  items, therapistMode, userRole, onSwitchMode, therapistClients,
  needs, ratings, displayName, onOpenTracker, onOpenSettings,
}: Props) {
  const screenShare = useScreenShare();
  const collapsed = useSidebarCollapsed();
  const newTasks = useNewTasksCount(!therapistMode); // «Задания» лежат в «Ещё» (U2)
  if (collapsed) return <SidebarRail items={items} therapistMode={therapistMode} displayName={displayName} clients={therapistClients} />;
  const { today, guide, tasks, clients } = THERAPIST_NAV;
  return (
    <aside className="sidebar">
      <SidebarBrand menu={{ therapistMode }} />

      {userRole === 'THERAPIST' && (
        <ModeSwitch variant="sidebar" value={therapistMode} onChange={onSwitchMode} />
      )}

      <nav className="sb-nav">
        {!therapistMode && items.map(item => (
          <NavLink key={item.id} to={'/' + item.id} className={itemClass}>
            <NavSign sign={SECTION_LOOK[item.id].sign} />{item.label}
            {item.id === 'more' && newTasks > 0 && <span className="new-badge" aria-label={`новых заданий: ${newTasks}`}>{newTasks}</span>}
          </NavLink>
        ))}
        {therapistMode && (<>
          {/* «Справочник» и доска — до клиентов: их список под «Все клиенты» бывает длинным. */}
          {[today, guide, tasks].map(therapistLink)}
          <NavLink to={clients.to} end className={itemClass}>
            <NavSign sign={clients.sign} /><span>{clients.label}</span>
            <span className="badge">{screenShare ? '' : therapistClients.length || ''}</span>
          </NavLink>
          {/* Клиенты — порядок, поиск и инициалы как в «Все клиенты» (appShell/SidebarClients). */}
          <SidebarClients clients={therapistClients} />
        </>)}
      </nav>

      <SidebarFoot therapistMode={therapistMode} userRole={userRole} needs={needs} ratings={ratings}
                   displayName={displayName} hasClients={therapistClients.length > 0}
                   onOpenTracker={onOpenTracker} onOpenSettings={onOpenSettings} />
    </aside>
  );
}
