import { Link, NavLink, useLocation } from 'react-router-dom';
import { navItemOf, type Section } from './navigation';
import { useTextEntryFocus } from '../../hooks/useTextEntryFocus';
import { useNewTasksCount } from '../../sections/tasks/newTasks';
import { NavSign, type NavSignKey } from './NavSign';
import { SECTION_LOOK, THERAPIST_NAV } from './navLook';

// Нижняя навигация мобильной вёрстки AppShell — вынесена из AppShell.tsx
// (правило №10: файл в храповике размера растёт только дроблением).
// Пункт — знак сущности раздела (navLook.ts, те же, что в меню компьютера) и подпись;
// неактивный знак тише, активный — в полную силу, подпись акцентом.
// В режиме терапевта — свои пять пунктов (редизайн 2026-10, «Справочник» — #995;
// «Задания» вместо «Поиска» — решение 9 docs/design/APP_2026-11.md: у доски не было
// пункта меню, а поиск клиентов есть в «Клиентах»).
// «Профиль» с onProfile открывает лист настроек, а не /account (#902): в нём
// единственный переключатель режима и остальные настройки, а сайдбар на
// телефоне скрыт — иначе из кабинета нельзя вернуться в режим клиента.
// dot — новые задания терапевта под «Ещё» (U2): строка «Задания» лежит там.
type Item = { to: string; sign: NavSignKey; label: string; end?: boolean; dot?: boolean };

const itemClass = ({ isActive }: { isActive: boolean }) => `mobile-nav-item${isActive ? ' active' : ''}`;
const Dot = () => <span className="mobile-nav-dot" role="img" aria-label="есть новое" />;
const link = (i: Item) => (
  <NavLink key={i.to} to={i.to} end={i.end} className={itemClass}>
    <NavSign sign={i.sign} />{i.label}{i.dot && <Dot />}
  </NavLink>
);
// Пункт, который горит там, где NavLink его не матчит (вложенные разделы «Ещё»).
const activeLink = (i: Item) => (
  <Link key={i.to} to={i.to} className="mobile-nav-item active" aria-current="page">
    <NavSign sign={i.sign} />{i.label}{i.dot && <Dot />}
  </Link>
);
const PROFILE: Item = { to: '/account', sign: 'leaf', label: 'Профиль' };

export function MobileNav({ items, therapist = false, onProfile }: {
  items: { id: Section; label: string }[];
  therapist?: boolean;
  onProfile?: () => void;
}) {
  // Над экранной клавиатурой панель не нужна и закрывает поле ввода.
  const typing = useTextEntryFocus();
  const { pathname } = useLocation();
  // «Ещё» горит и на вложенных разделах (/practice, /schemas, /profile): NavLink их не матчит.
  const inMoreSub = navItemOf(pathname) === 'more' && !pathname.startsWith('/more');
  const moreDot = useNewTasksCount(!therapist) > 0;
  if (typing) return null;
  if (therapist) {
    const { today, clients, guide, tasks } = THERAPIST_NAV;
    return (
      <nav className="mobile-nav">
        {[today, { ...clients, label: clients.short }, guide, tasks].map(link)}
        {onProfile ? (
          <button type="button" className="mobile-nav-item" onClick={onProfile}>
            <NavSign sign={PROFILE.sign} />{PROFILE.label}
          </button>
        ) : link(PROFILE)}
      </nav>
    );
  }
  return (
    <nav className="mobile-nav">
      {items.map(i => {
        const item = { to: '/' + i.id, sign: SECTION_LOOK[i.id].sign, label: i.label, dot: i.id === 'more' && moreDot };
        return i.id === 'more' && inMoreSub ? activeLink({ ...item, to: '/more' }) : link(item);
      })}
    </nav>
  );
}
