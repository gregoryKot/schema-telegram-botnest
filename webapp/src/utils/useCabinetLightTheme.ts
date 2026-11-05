import { useLayoutEffect } from 'react';
import { applyCabinetLightTheme } from './theme';

/** Кабинет всегда светлый (решение владельца 2026-10-15): тема ставится на
 *  каждом монтировании AppShell, а не один раз при загрузке модуля — App.tsx и
 *  тумблер лендинга ставят data-theme="dark" уже после модульного кода
 *  (инцидент 2026-11-05, docs/INCIDENTS.md). Layout-эффект срабатывает до
 *  первого кадра. */
export function useCabinetLightTheme(): void {
  useLayoutEffect(() => { applyCabinetLightTheme(); }, []);
}
