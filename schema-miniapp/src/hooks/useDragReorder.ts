import { useEffect, useRef, useState } from 'react';
import type {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { haptic } from '../haptic';
import { getHost } from '../../../shared/src/host';
import { targetIndexFromOffset } from '../utils/dragReorder';

// Перетаскивание строки листа настройки — ручка «≡» (замена MoveArrows,
// правило №11): pointer-жест + клавиатура ArrowUp/ArrowDown, один хук на все
// 4 листа («одна механика»). Математика — utils/dragReorder.ts (без React/DOM).
const DEFAULT_ROW_HEIGHT = 56;

// Живое устройство (Telegram iOS): свайп вниз за ручку сворачивает всё
// мини-приложение — это жест ХОСТА, `touch-action: none` на ручке гасит
// только скролл страницы. Host API (setVerticalSwipes) выключает его там,
// где есть; на площадках без API (MAX, браузер) документный touchmove с
// preventDefault — единственная страховка от жеста хоста.
function preventTouchMove(e: TouchEvent) {
  e.preventDefault();
}

export interface DragRange {
  min: number;
  max: number;
}

interface DragRowState {
  id: string;
  startIndex: number;
  offsetY: number;
  targetIndex: number;
}

export interface DragHandleProps {
  role: 'button';
  tabIndex: 0;
  'aria-label': string;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  style: { touchAction: 'none' };
}

export interface UseDragReorderOptions {
  ids: string[];
  onReorder: (id: string, toIndex: number) => void;
}

export function useDragReorder({ ids, onReorder }: UseDragReorderOptions) {
  const [drag, setDrag] = useState<DragRowState | null>(null);
  const dragRef = useRef<DragRowState | null>(null);
  const originYRef = useRef(0);
  const rowsRef = useRef(new Map<string, HTMLElement>());
  const guardingRef = useRef(false);

  function apply(next: DragRowState | null) {
    dragRef.current = next;
    setDrag(next);
  }

  function beginSwipeGuard() {
    if (guardingRef.current) return;
    guardingRef.current = true;
    // Страховка для клиентов без setVerticalSwipes (или где App.tsx ещё не
    // успел его позвать) — политика приложения гасит свайпы хоста насовсем
    // при expand() (App.tsx, shared/src/host/telegram.ts), а не только на
    // время драга, так что здесь их только выключаем, не включаем обратно.
    getHost().setVerticalSwipes(false);
    document.addEventListener('touchmove', preventTouchMove, {
      passive: false,
    });
  }

  function endSwipeGuard() {
    if (!guardingRef.current) return;
    guardingRef.current = false;
    // НЕ включаем свайпы обратно (setVerticalSwipes(true)) — раньше это
    // оживляло жест «свернуть мини-апп» после первого драга, хотя политика
    // приложения держит его выключенным всегда (главная цель волны 2026-08).
    document.removeEventListener('touchmove', preventTouchMove);
  }

  // Размонтирование листа посреди драга (например переход на другой экран)
  // не должно оставить приложение со свёрнутыми свайпами и висящим
  // листенером — снимаем guard, если он ещё активен.
  useEffect(() => endSwipeGuard, []);

  function registerRow(id: string) {
    return (el: HTMLElement | null) => {
      if (el) rowsRef.current.set(id, el);
      else rowsRef.current.delete(id);
    };
  }

  function heights(): number[] {
    return ids.map(
      (rid) =>
        rowsRef.current.get(rid)?.getBoundingClientRect().height ||
        DEFAULT_ROW_HEIGHT,
    );
  }

  /** Смещение строки id для рендера: перетаскиваемая строка следует за
   * пальцем 1:1, остальные раздвигаются на её высоту, когда drag прошёл
   * через их позицию (transition — CSS/inline у вызывающего, перекрывается
   * reduced-motion index.css, не эта функция). */
  function offsetFor(id: string): number {
    if (!drag) return 0;
    if (id === drag.id) return drag.offsetY;
    const idx = ids.indexOf(id);
    const h =
      rowsRef.current.get(drag.id)?.getBoundingClientRect().height ||
      DEFAULT_ROW_HEIGHT;
    const { startIndex: s, targetIndex: t } = drag;
    if (t > s && idx > s && idx <= t) return -h;
    if (t < s && idx >= t && idx < s) return h;
    return 0;
  }

  function handleProps(
    id: string,
    label: string,
    range: DragRange,
  ): DragHandleProps {
    return {
      role: 'button',
      tabIndex: 0,
      'aria-label': `Переставить: ${label}`,
      style: { touchAction: 'none' },
      onPointerDown: (e) => {
        e.stopPropagation();
        const startIndex = ids.indexOf(id);
        if (startIndex === -1) return;
        originYRef.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
        haptic.tap();
        beginSwipeGuard();
        apply({ id, startIndex, offsetY: 0, targetIndex: startIndex });
      },
      onPointerMove: (e) => {
        e.stopPropagation();
        if (e.buttons === 0) return;
        const prev = dragRef.current;
        if (!prev || prev.id !== id) return;
        const offsetY = e.clientY - originYRef.current;
        const targetIndex = targetIndexFromOffset(
          prev.startIndex,
          offsetY,
          heights(),
          range.min,
          range.max,
        );
        if (targetIndex !== prev.targetIndex) haptic.select();
        apply({ ...prev, offsetY, targetIndex });
      },
      onPointerUp: (e) => {
        e.stopPropagation();
        const prev = dragRef.current;
        apply(null);
        endSwipeGuard();
        if (prev && prev.id === id && prev.targetIndex !== prev.startIndex) {
          onReorder(id, prev.targetIndex);
        }
      },
      onPointerCancel: (e) => {
        e.stopPropagation();
        apply(null);
        endSwipeGuard();
      },
      onKeyDown: (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        e.stopPropagation();
        const startIndex = ids.indexOf(id);
        if (startIndex === -1) return;
        const step = e.key === 'ArrowDown' ? 1 : -1;
        const targetIndex = Math.min(
          range.max,
          Math.max(range.min, startIndex + step),
        );
        if (targetIndex !== startIndex) {
          haptic.select();
          onReorder(id, targetIndex);
        }
      },
    };
  }

  return { drag, registerRow, offsetFor, handleProps };
}
