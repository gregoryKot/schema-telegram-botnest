import { useState } from 'react';
import { getHiddenActions, setActionHidden } from './quickActionPrefs';

// Скрытие пунктов — одинаковая логика в PlusMenuSheet и ToolsList (правило
// «одна механика — один компонент»), не дублируем стейт-хук в обоих местах.
// onChanged — хук площадки после записи (мини-апп синхронизирует настройки с
// сервером через notifyPrefsChanged; сайт не синхронизирует, передаёт ничего).
export function useHiddenActions(
  key: string,
  onChanged?: () => void,
): [string[], (id: string, hidden: boolean) => void] {
  const [hidden, setHidden] = useState<string[]>(() => getHiddenActions(key));
  function toggle(id: string, nextHidden: boolean) {
    setActionHidden(key, id, nextHidden);
    onChanged?.();
    setHidden((prev) =>
      nextHidden ? [...prev, id] : prev.filter((x) => x !== id),
    );
  }

  return [hidden, toggle];
}
