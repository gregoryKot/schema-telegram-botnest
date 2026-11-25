import { useEffect, useState, type RefObject } from 'react';
import { activeSectionId, type SettingsNavItem } from './settingsNav';

/** Линия чтения от верха прокрутки: пункт оглавления кладёт заголовок раздела на 16px (scroll-margin-top). */
const READ_LINE = 48;

function useActiveSection(ids: readonly string[], scrollRef: RefObject<HTMLElement | null>): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join(' ');
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const measure = () => {
      const top = box.getBoundingClientRect().top;
      const heads = key.split(' ').map((id) => ({ id, top: (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) - top }));
      setActive(activeSectionId(heads, READ_LINE));
    };
    measure();
    box.addEventListener('scroll', measure, { passive: true });
    return () => box.removeEventListener('scroll', measure);
  }, [key, scrollRef]);
  return active;
}

/** Оглавление листа на ≥1024: пункты текстом, у раздела под линией чтения — черта акцента (aria-current). */
export function SettingsSideNav({ items, onPick, scrollRef }: {
  items: readonly SettingsNavItem[]; onPick: (id: string) => void; scrollRef: RefObject<HTMLElement | null>;
}) {
  const active = useActiveSection(items.map((n) => n.id), scrollRef);
  return (
    <nav className="settings-sidenav" aria-label="Разделы настроек">
      {items.map((n) => (
        <button key={n.id} type="button" data-target={n.id} onClick={() => onPick(n.id)}
          aria-current={n.id === active ? 'location' : undefined} className="settings-sidenav-item st-navitem">
          {n.label}
        </button>
      ))}
    </nav>
  );
}
