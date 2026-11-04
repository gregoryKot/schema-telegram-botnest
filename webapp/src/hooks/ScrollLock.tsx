import { useEffect } from 'react';
import { useAnySheetOpen } from './openSheets';
import { useAnyDialogOpen } from '../../../shared/src/utils/dialogStack';

/** Блокирует прокрутку страницы; возвращает снятие блокировки. */
export function lockPageScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const prev = { h: html.style.overflow, b: body.style.overflow, o: html.style.overscrollBehavior };
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  return () => {
    html.style.overflow = prev.h;
    body.style.overflow = prev.b;
    html.style.overscrollBehavior = prev.o;
  };
}

/**
 * Единственное место блокировки прокрутки фона (QA 2026-11, T-9, C-З4).
 * Листы и палитра отмечаются в openSheets (useHistorySheet), диалоги — в
 * dialogStack; ни одному из них своё `overflow` на body ставить не нужно.
 */
export function ScrollLock() {
  const sheet = useAnySheetOpen();
  const dialog = useAnyDialogOpen();
  const locked = sheet || dialog;
  useEffect(() => (locked ? lockPageScroll() : undefined), [locked]);
  return null;
}
