import { useState, useEffect, useMemo, useRef } from 'react';

type Section = 'today' | 'diary' | 'schemas' | 'profile' | 'help';

interface Item {
  label: string;
  sub?: string;
  hint?: string;
  action: () => void;
}

interface Props {
  section: Section;
  onNavigate: (s: Section) => void;
  onClose: () => void;
}

const NAV_ITEMS: { id: Section; label: string; sub: string; hint: string }[] = [
  { id: 'today',   label: 'Сегодня',   sub: 'Главная',    hint: '⌘ 1' },
  { id: 'diary',   label: 'Дневник',   sub: 'Записи',     hint: '⌘ 2' },
  { id: 'schemas', label: 'Схемы',     sub: 'Психология', hint: '⌘ 3' },
  { id: 'profile', label: 'Профиль',   sub: 'Аккаунт',    hint: '⌘ 4' },
  { id: 'help',    label: 'Помощь',    sub: 'Практики',   hint: '⌘ 5' },
];

export function CommandPalette({ onNavigate, onClose }: Props) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo<Item[]>(() => {
    const base: Item[] = NAV_ITEMS.map(n => ({
      label: n.label, sub: n.sub, hint: n.hint,
      action: () => onNavigate(n.id),
    }));
    const term = q.trim().toLowerCase();
    if (!term) return base;
    return base.filter(it => (it.label + ' ' + (it.sub ?? '')).toLowerCase().includes(term));
  }, [q, onNavigate]);

  useEffect(() => { setSel(0); }, [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      if (e.key === 'Enter')     { e.preventDefault(); items[sel]?.action(); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, sel, onClose]);

  return (
    <div className="cmd-bg" onClick={onClose}>
      <div className="cmd-panel" onClick={e => e.stopPropagation()}>
        <div className="cmd-search">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
            <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Найти страницу или действие…"
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmd-list">
          {items.length === 0 && <div className="empty" style={{ padding: '24px 20px' }}>Ничего не найдено</div>}
          {items.map((it, i) => (
            <div key={i}
                 className={`cmd-row${i === sel ? ' is-sel' : ''}`}
                 onMouseEnter={() => setSel(i)}
                 onClick={() => { it.action(); onClose(); }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: 'var(--text)' }}>{it.label}</span>
                {it.sub && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-faint)' }}>{it.sub}</span>}
              </span>
              {it.hint && <span className="hint">{it.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
