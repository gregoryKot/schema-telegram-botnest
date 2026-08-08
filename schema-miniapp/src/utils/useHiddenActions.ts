import { useState } from 'react';
import { getHiddenActions, setActionHidden } from './quickActionPrefs';
import { notifyPrefsChanged } from './uiPrefsSync';

// Скрытие пунктов — одинаковая логика в PlusMenuSheet и ToolsList (правило
// «одна механика — один компонент»), не дублируем стейт-хук в обоих местах.
export function useHiddenActions(
  key: string,
): [string[], (id: string, hidden: boolean) => void] {
  const [hidden, setHidden] = useState<string[]>(() => getHiddenActions(key));
  function toggle(id: string, nextHidden: boolean) {
    setActionHidden(key, id, nextHidden);
    notifyPrefsChanged();
    setHidden((prev) =>
      nextHidden ? [...prev, id] : prev.filter((x) => x !== id),
    );
  }

  return [hidden, toggle];
}
