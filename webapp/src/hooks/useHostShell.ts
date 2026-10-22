import { useEffect } from 'react';
import { initHost } from '../host/initHost';
import { useHostBackButton } from './useHostBackButton';
import { useHostSafeTop } from './useHostSafeTop';

/**
 * Кабинет внутри Telegram/MAX ведёт себя как приложение: «готово» и разворот
 * на весь экран, кнопка «Назад» хоста, отступ под его плавающие кнопки.
 * В обычном браузере — ничего.
 */
export function useHostShell(): void {
  useEffect(() => initHost(), []);
  useHostBackButton();
  useHostSafeTop();
}
