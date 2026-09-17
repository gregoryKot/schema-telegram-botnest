import { NavLink } from 'react-router-dom';
import { MobileNavIcon } from './MobileNavIcon';
import type { Section } from './navigation';

// Нижняя навигация мобильной вёрстки AppShell — вынесена из AppShell.tsx
// (правило №10: файл в храповике размера растёт только дроблением).
export function MobileNav({ items }: { items: { id: Section; label: string }[] }) {
  return (
    <nav className="mobile-nav">
      {items.map(item => (
        <NavLink
          key={item.id}
          to={'/' + item.id}
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
        >
          <MobileNavIcon id={item.id} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
