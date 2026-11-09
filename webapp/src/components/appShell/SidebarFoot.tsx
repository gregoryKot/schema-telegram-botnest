// Низ развёрнутого меню (вынесен из Sidebar.tsx, правило №10): карточка дня клиента, «Показ экрана»
// терапевта, строка аккаунта и мелкие ссылки.
// Карточка дня — лист бумаги трекера с его знаком по оценкам дня (Strokes values): высота полоски —
// оценка, без оценки — пустой тон бумаги, ничего выдуманного. День оценён целиком — лист шалфея с
// индексом (как лист «Готово» трекера, ENTITY_LOOK), иначе солома трекера и вход в него.
// На открытой «Сегодня» карточки нет: там тот же трекер листом с полосками, индексом в мете и входом
// (b05) — второй индекс и вторые полоски рядом были бы дублем.
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';
import type { Need } from '../../types';
import { hueStyle } from '../../lib/tone';
import { Strokes } from '../art/PaperArt';
import { ScreenShareSwitch } from './ScreenShareSwitch';
import { useScreenShare } from './screenShareMode';
import { sidebarDay } from './sidebarDay';
import { sectionFromPath } from './navigation';

interface Props {
  therapistMode: boolean;
  userRole: 'CLIENT' | 'THERAPIST';
  needs: Need[];
  ratings: Record<string, number>;
  displayName: string | null;
  /** Есть ли клиенты: без них прятать нечего — «Показа экрана» нет. */
  hasClients: boolean;
  onOpenTracker: () => void;
  onOpenSettings: () => void;
}

function SidebarToday({ needs, ratings, onOpenTracker }: Pick<Props, 'needs' | 'ratings' | 'onOpenTracker'>) {
  const day = sidebarDay(needs.map(n => n.id), ratings);
  return (
    <div className="pp-paper sb-today" style={hueStyle(day.hue)} data-day={day.index ? 'done' : 'open'}>
      <div className="sb-today-body">
        {/* Подпись называет то, что открывается (QA 2026-11, A-З9): кнопка ведёт в трекер. */}
        <div className="sb-today-label">Сегодня</div>
        {day.index && (
          <>
            <div className="sb-today-index">
              <span className="sb-today-num">{day.index}</span>
              <span className="sb-today-denom">/10</span>
            </div>
            <div className="sb-today-sub">индекс дня</div>
          </>
        )}
      </div>
      <span className="sb-today-art"><Strokes size="row" values={day.values} /></span>
      {!day.index && <button type="button" className="sb-today-cta" onClick={onOpenTracker}>Заполнить трекер →</button>}
    </div>
  );
}

export function SidebarFoot({ therapistMode, userRole, needs, ratings, displayName, hasClients, onOpenTracker, onOpenSettings }: Props) {
  const { logout } = useAuth();
  const screenShare = useScreenShare();
  const onToday = sectionFromPath(useLocation().pathname) === 'today';
  return (
    <div className="sb-foot-wrap">
      {!therapistMode && !onToday && <SidebarToday needs={needs} ratings={ratings} onOpenTracker={onOpenTracker} />}
      {/* «Показ экрана» — над профилем, а не между подписью «Клиенты» и списком: список идёт сразу под ней. */}
      {therapistMode && hasClients && <ScreenShareSwitch on={screenShare} />}
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
          <button type="button" className="sb-item" onClick={() => logout()}>Выйти</button>
        </div>
        <div className="sb-links sb-legal">
          <a href="/privacy" target="_blank">Конфиденциальность</a>
          <a href="/offer" target="_blank">Оферта</a>
        </div>
      </div>
    </div>
  );
}
