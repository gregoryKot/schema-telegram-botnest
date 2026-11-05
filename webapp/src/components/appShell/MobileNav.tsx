import { Link, NavLink, useLocation } from 'react-router-dom';
import { MobileNavIcon, type MobileNavIconId } from './MobileNavIcon';
import { navItemOf, type Section } from './navigation';
import { useTextEntryFocus } from '../../hooks/useTextEntryFocus';

// Нижняя навигация мобильной вёрстки AppShell — вынесена из AppShell.tsx
// (правило №10: файл в храповике размера растёт только дроблением).
// В режиме терапевта — свои четыре пункта (редизайн 2026-10): раньше на
// телефоне терапевт видел разделы клиента и не мог попасть в кабинет.
// «Профиль» с onProfile открывает лист настроек, а не /account (#902): в нём
// единственный переключатель режима и остальные настройки, а сайдбар на
// телефоне скрыт — иначе из кабинета нельзя вернуться в режим клиента.
type Item = { to: string; icon: MobileNavIconId; label: string; end?: boolean };
const THERAPIST_ITEMS: Item[] = [
  { to: '/cabinet/today', icon: 'today', label: 'Сегодня' },
  { to: '/cabinet', icon: 'clients', label: 'Клиенты', end: true },
  { to: '/account', icon: 'profile', label: 'Профиль' },
];

const itemClass = ({ isActive }: { isActive: boolean }) => `mobile-nav-item${isActive ? ' active' : ''}`;
const link = (i: Item) => (
  <NavLink key={i.to} to={i.to} end={i.end} className={itemClass}>
    <MobileNavIcon id={i.icon} />{i.label}
  </NavLink>
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
  if (typing) return null;
  if (therapist) {
    const [today, clients, profile] = THERAPIST_ITEMS;
    return (
      <nav className="mobile-nav">
        {link(today)}{link(clients)}{action('search', 'Поиск', onSearch)}
        {onProfile ? action('profile', profile.label, onProfile) : link(profile)}
      </nav>
    );
  }
  return (
    <nav className="mobile-nav">
      {items.map(i => (i.id === 'more' && inMoreSub
        ? <Link key={i.id} to="/more" className="mobile-nav-item active" aria-current="page">
          <MobileNavIcon id={i.id} />{i.label}
        </Link>
        : link({ to: '/' + i.id, icon: i.id, label: i.label })))}
    </nav>
  );
}
