import { NavLink } from 'react-router-dom';
import { MobileNavIcon, type MobileNavIconId } from './MobileNavIcon';
import type { Section } from './navigation';

// Нижняя навигация мобильной вёрстки AppShell — вынесена из AppShell.tsx
// (правило №10: файл в храповике размера растёт только дроблением).
// В режиме терапевта — свои четыре пункта (редизайн 2026-10): раньше на
// телефоне терапевт видел разделы клиента и не мог попасть в кабинет.
const THERAPIST_ITEMS: { to: string; icon: MobileNavIconId; label: string; end?: boolean }[] = [
  { to: '/cabinet/today', icon: 'today', label: 'Сегодня' },
  { to: '/cabinet', icon: 'clients', label: 'Клиенты', end: true },
  { to: '/account', icon: 'profile', label: 'Профиль' },
];

const itemClass = ({ isActive }: { isActive: boolean }) => `mobile-nav-item${isActive ? ' active' : ''}`;

export function MobileNav({ items, therapist = false, onSearch }: {
  items: { id: Section; label: string }[];
  therapist?: boolean;
  onSearch?: () => void;
}) {
  if (therapist) {
    const [today, clients, profile] = THERAPIST_ITEMS;
    const link = (i: typeof today) => (
      <NavLink key={i.to} to={i.to} end={i.end} className={itemClass}>
        <MobileNavIcon id={i.icon} />{i.label}
      </NavLink>
    );
    return (
      <nav className="mobile-nav">
        {link(today)}{link(clients)}
        <button type="button" className="mobile-nav-item" onClick={onSearch}>
          <MobileNavIcon id="search" />Поиск
        </button>
        {link(profile)}
      </nav>
    );
  }
  return (
    <nav className="mobile-nav">
      {items.map(item => (
        <NavLink key={item.id} to={'/' + item.id} className={itemClass}>
          <MobileNavIcon id={item.id} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
