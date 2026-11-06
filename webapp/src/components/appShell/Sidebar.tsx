import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';
import type { TherapyClientSummary } from '../../api';
import type { Need } from '../../types';
import { SECTION_HUE, hueStyle } from '../../lib/tone';
import { ModeSwitch } from './ModeSwitch';
import type { Section } from './navigation';
import { SidebarClients } from './SidebarClients';
import { isClientListPath } from '../therapist/clientTabRoute';
import { useScreenShare } from './screenShareMode';
import { dayIndex, fmtIndex } from '../../../../shared/src/needs/dayIndex';

const itemClass = ({ isActive }: { isActive: boolean }) => `sb-item${isActive ? ' is-active' : ''}`;

/** Логотип и название — общие у сайдбара и его скелетона на загрузке. */
export function SidebarBrand() {
  return (
    <div className="sb-brand">
      <div className="sb-logo">В</div>
      <div className="sb-name">Всё по схеме</div>
    </div>
  );
}

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
// (index.css), там навигация — MobileNav.
export function Sidebar({
  items, therapistMode, userRole, onSwitchMode, therapistClients,
  needs, ratings, displayName, onOpenTracker, onOpenSettings,
}: Props) {
  const { logout } = useAuth();
  const screenShare = useScreenShare();
  // «Все клиенты» горит на обеих вкладках списка: /cabinet и доска /cabinet/tasks.
  const onList = isClientListPath(useLocation().pathname);
  // Тот же индекс дня, что на плитке и в итоге трекера (shared/src/needs/dayIndex.ts).
  const idx = dayIndex(needs.map(n => n.id), ratings);
  return (
    <aside className="sidebar">
      <SidebarBrand />

      {userRole === 'THERAPIST' && (
        <ModeSwitch variant="sidebar" value={therapistMode} onChange={onSwitchMode} />
      )}

      <nav className="sb-nav">
        {!therapistMode && items.map(item => (
          <NavLink key={item.id} to={'/' + item.id} className={itemClass}>
            <span className="sb-dot" style={hueStyle(SECTION_HUE[item.id])} />{item.label}
          </NavLink>
        ))}
        {therapistMode && (<>
          <NavLink to="/cabinet/today" className={itemClass}><span>Сегодня</span></NavLink>
          <Link to="/cabinet" className={itemClass({ isActive: onList })} aria-current={onList ? 'page' : undefined}>
            <span>Все клиенты</span><span className="badge">{screenShare ? '' : therapistClients.length || ''}</span>
          </Link>
          {/* Клиенты — порядок, поиск и инициалы как в «Все клиенты» (appShell/SidebarClients). */}
          <SidebarClients clients={therapistClients} />
        </>)}
      </nav>

      <div className="sb-foot-wrap">
        {/* Индекс дня из реальных оценок трекера; на пустом дне — вход в трекер.
            Подпись называет то, что открывается (QA 2026-11, A-З9: «Заполнить
            дневник →» открывала трекер, а «Дневник» на главной — отдельная плитка). */}
        {!therapistMode && (
          <div className="sb-today">
            <div className="sb-today-label">Сегодня</div>
            {idx !== null ? (
              <>
                <div className="sb-today-index">
                  <span className="sb-today-num">{fmtIndex(idx)}</span>
                  <span className="sb-today-denom">/10</span>
                </div>
                <div className="sb-today-sub">индекс дня</div>
              </>
            ) : (
              <button type="button" className="sb-today-cta" onClick={onOpenTracker}>Заполнить трекер →</button>
            )}
          </div>
        )}
        <div className="sb-foot">
          <NavLink to="/profile" className={({ isActive }) => `sb-account${isActive ? ' is-active' : ''}`}>
            <div className="sb-avatar">{(displayName ?? '?')[0].toUpperCase()}</div>
            <div className="u-fill">
              <div className="sb-acc-name">{displayName || 'Профиль'}</div>
              <div className="sb-acc-role">{userRole === 'THERAPIST' ? 'Терапевт' : 'Клиент'}</div>
            </div>
          </NavLink>
          <div className="sb-links">
            <button type="button" className="sb-item" onClick={onOpenSettings}>Настройки</button>
            <NavLink to="/account" className="sb-item">Аккаунт</NavLink>
            <button type="button" className="sb-item sb-danger" onClick={() => logout()}>Выйти</button>
          </div>
          <div className="sb-links sb-legal">
            <a href="/privacy" target="_blank">Конфиденциальность</a>
            <a href="/offer" target="_blank">Оферта</a>
          </div>
        </div>
      </div>
    </aside>
  );
}
