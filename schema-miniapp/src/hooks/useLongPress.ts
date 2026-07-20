import { useRef, useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent } from 'react';

// Долгое нажатие на блок главного экрана → «Настроить экран». Быстрый путь
// для тех, кто уже освоился; шестерёнка в шапке остаётся основным, видимым
// способом (правило CLAUDE.md: жест без аффорданса не может быть единственным
// входом — про него рассказывают в онбординге, и он ничего не делает
// необратимого, только открывает лист настройки).
//
// Одна механика — один хук: не копируй таймер/отмену по карточкам.

const HOLD_MS = 450;
// Палец всегда немного едет; отменяем только при явном скролле.
const MOVE_TOLERANCE_PX = 10;

export interface LongPressProps {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onContextMenu: (e: MouseEvent) => void;
  onClickCapture: (e: MouseEvent) => void;
  style: { WebkitTouchCallout: 'none' };
}

export function useLongPress(onLongPress: () => void): LongPressProps {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  // Жест сработал → гасим клик, который браузер пришлёт после отпускания,
  // иначе долгое нажатие на карточке заодно нажмёт кнопку внутри неё.
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  const start = useCallback(
    (e: ReactPointerEvent) => {
      // Только основная кнопка/палец: правый клик и мультитач — не жест.
      if (e.button !== 0 || !e.isPrimary) return;
      cancel();
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
        onLongPress();
        cancel();
      }, HOLD_MS);
    },
    [cancel, onLongPress],
  );

  const move = useCallback(
    (e: ReactPointerEvent) => {
      const o = origin.current;
      if (!o) return;
      const far =
        Math.abs(e.clientX - o.x) > MOVE_TOLERANCE_PX ||
        Math.abs(e.clientY - o.y) > MOVE_TOLERANCE_PX;
      if (far) cancel();
    },
    [cancel],
  );

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onPointerMove: move,
    // Долгое нажатие в мобильном вебе иначе откроет системное меню/выделение.
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
    onClickCapture: (e: MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    style: { WebkitTouchCallout: 'none' },
  };
}
