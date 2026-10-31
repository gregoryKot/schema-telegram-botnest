import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import '../styles/sheet-modemap.css';

// Выпадающее меню у кнопки. Рисуется fixed от якоря и прижимается к экрану,
// чтобы его не обрезал контейнер и не вытолкнул правый край. Закрывается кликом
// по невидимой подложке и Escape. Родилось в тулбаре карты режимов
// (modeMap/ToolbarControls); меню «⋯ Ещё» вкладки «Концептуализация» — та же
// механика, поэтому компонент один и живёт здесь (правило «одна механика — один
// компонент»). role="menu" — меню действий: фокус уходит на первый пункт,
// стрелки ходят по пунктам, Escape возвращает фокус якорю.
export function Dropdown({ children, onClose, anchorRef, role, label, className }: {
  children: ReactNode;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  role?: 'menu';
  label?: string;
  className?: string;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    const WIDTH = 220, MARGIN = 8;
    let left = r.left;
    if (left + WIDTH > window.innerWidth - MARGIN) left = window.innerWidth - MARGIN - WIDTH;
    if (left < MARGIN) left = MARGIN;
    setPos({ left, top: r.bottom + 4 });
  }, [anchorRef]);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
      anchorRef.current?.querySelector<HTMLElement>('button')?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, anchorRef]);
  useEffect(() => {
    if (role === 'menu' && pos) items(dropRef.current)[0]?.focus();
  }, [role, pos]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (role !== 'menu' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    const list = items(dropRef.current);
    if (list.length === 0) return;
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    list[(i + step + list.length) % list.length].focus();
  };
  return (
    <>
      <div role="button" tabIndex={0} aria-label="Закрыть" onClick={onClose}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
        className="mm2-backdrop" style={{ zIndex: 39 }} />
      {pos && (
        <div ref={dropRef} role={role} aria-label={label} onKeyDown={onKeyDown}
          className={`ds-card mm2-drop${className ? ` ${className}` : ''}`} style={{ top: pos.top, left: pos.left }}>
          {children}
        </div>
      )}
    </>
  );
}

const items = (el: HTMLElement | null) =>
  Array.from(el?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
