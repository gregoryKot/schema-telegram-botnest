import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { placeMenu } from './dropdownPlace';

// Выпадающее меню у кнопки: fixed от якоря, прижато к экрану; закрывается кликом по
// подложке и Escape. Одно на тулбар карты и «⋯ Ещё» концептуализации. role="menu" —
// фокус на первый пункт, стрелки по пунктам, Escape возвращает фокус якорю.
// portal — меню и подложка в body: якорь в своём контексте наложения (тулбар холста в
// .react-flow) иначе оставляет меню ПОД соседями холста — статусом, «ушком» палитры.
export function Dropdown({ children, onClose, anchorRef, role, label, className, width = 220, portal = false }: {
  children: ReactNode;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  role?: 'menu';
  label?: string;
  className?: string;
  width?: number; portal?: boolean; // ширина в px — для прижатия к краю экрана
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    // Размер — живой, после раскладки: меню с шириной по содержимому; в jsdom замер нулевой — берём width.
    const m = dropRef.current?.getBoundingClientRect();
    setPos(placeMenu(r, { width: m?.width || Math.min(width, window.innerWidth - 16), height: m?.height ?? 0 }, { width: window.innerWidth, height: window.innerHeight }));
  }, [anchorRef, width]);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Escape берёт меню: холст (useMapKeys) и лист под ним его пропускают
      e.preventDefault();
      onClose();
      anchorRef.current?.querySelector<HTMLElement>('button')?.focus();
    };
    window.addEventListener('keydown', onKey, true); // capture — раньше слушателей холста при любом порядке подписки
    return () => window.removeEventListener('keydown', onKey, true);
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
  const menu = (
    <>
      <div role="button" tabIndex={0} aria-label="Закрыть" onClick={onClose}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
        className="ds-backdrop" style={{ zIndex: 39 }} />
      <div ref={dropRef} role={role} aria-label={label} onKeyDown={onKeyDown}
        className={`ds-menu${className ? ` ${className}` : ''}`} style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}>
        {children}
      </div>
    </>
  );
  return portal ? createPortal(menu, document.body) : menu;
}

const items = (el: HTMLElement | null) =>
  Array.from(el?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
