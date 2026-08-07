import { useState } from 'react';
import { getHiddenActions, setActionHidden } from './quickActionPrefs';

// Скрытие пунктов — одинаковая логика в PlusMenuSheet и ToolsList (state +
// persist), вынесена сюда (правило «одна механика — один компонент»), чтобы
// не дублировать один и тот же стейт-хук в обоих местах.
export function useHiddenActions(
  key: string,
): [string[], (id: string, hidden: boolean) => void] {
  const [hidden, setHidden] = useState<string[]>(() => getHiddenActions(key));

  function toggle(id: string, nextHidden: boolean) {
    setActionHidden(key, id, nextHidden);
    setHidden((prev) =>
      nextHidden ? [...prev, id] : prev.filter((x) => x !== id),
    );
  }

  return [hidden, toggle];
}
