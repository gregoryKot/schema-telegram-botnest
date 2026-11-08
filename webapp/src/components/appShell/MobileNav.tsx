import { Link, NavLink, useLocation } from 'react-router-dom';
import { MobileNavIcon, type MobileNavIconId } from './MobileNavIcon';
import { navItemOf, type Section } from './navigation';
import { useTextEntryFocus } from '../../hooks/useTextEntryFocus';
import { isClientListPath } from '../therapist/clientTabRoute';
import { useNewTasksCount } from '../../sections/tasks/newTasks';

// Нижняя навигация мобильной вёрстки AppShell — вынесена из AppShell.tsx
// (правило №10: файл в храповике размера растёт только дроблением).
// В режиме терапевта — свои пять пунктов (редизайн 2026-10, «Справочник» — #995):
// раньше на телефоне терапевт видел разделы клиента и не мог попасть в кабинет.
// «Профиль» с onProfile открывает лист настроек, а не /account (#902): в нём
// единственный переключатель режима и остальные настройки, а сайдбар на
// телефоне скрыт — иначе из кабинета нельзя вернуться в режим клиента.
// dot — новые задания терапевта под «Ещё» (U2): строка «Задания» лежит там.
type Item = { to: string; icon: MobileNavIconId; label: string; end?: boolean; dot?: boolean };
const THERAPIST_ITEMS: Item[] = [
  { to: '/cabinet/today', icon: 'today', label: 'Сегодня' },
  { to: '/cabinet', icon: 'clients', label: 'Клиенты', end: true },
  { to: '/cabinet/guide', icon: 'guide', label: 'Справочник' },
  { to: '/account', icon: 'profile', label: 'Профиль' },
];

const itemClass = ({ isActive }: { isActive: boolean }) => `mobile-nav-item${isActive ? ' active' : ''}`;
const Dot = () => <span className="mobile-nav-dot" role="img" aria-label="есть новое" />;
const link = (i: Item) => (
  <NavLink key={i.to} to={i.to} end={i.end} className={itemClass}>
    <MobileNavIcon id={i.icon} />{i.label}{i.dot && <Dot />}
  </NavLink>
);
// Пункт, который горит там, где NavLink его не матчит (вложенные разделы «Ещё»,
// доска «Задания» /cabinet/tasks у «Клиентов»).
const activeLink = (i: Item) => (
  <Link key={i.to} to={i.to} className="mobile-nav-item active" aria-current="page">
    <MobileNavIcon id={i.icon} />{i.label}{i.dot && <Dot />}
  </Link>
);
const action = (icon: MobileNavIconId, label: string, onClick?: () => void) => (
  <button type="button" className="mobile-nav-item" onClick={onClick}>
    <MobileNavIcon id={icon} />{label}
  </button>
);

export function MobileNav({ items, therapist = false, onSearch, onProfile }: {
  items: { id: Section; label: string }[];
  therapist?: boolean;
  onSearch?: () => void;
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
    const [today, clients, guide, profile] = THERAPIST_ITEMS;
    return (
      <nav className="mobile-nav">
        {link(today)}{isClientListPath(pathname) ? activeLink(clients) : link(clients)}{link(guide)}{action('search', 'Поиск', onSearch)}
        {onProfile ? action('profile', profile.label, onProfile) : link(profile)}
      </nav>
    );
  }
  return (
    <nav className="mobile-nav">
      {items.map(i => (i.id === 'more' && inMoreSub
        ? activeLink({ to: '/more', icon: i.id, label: i.label, dot: moreDot })
        : link({ to: '/' + i.id, icon: i.id, label: i.label, dot: i.id === 'more' && moreDot })))}
    </nav>
  );
}
