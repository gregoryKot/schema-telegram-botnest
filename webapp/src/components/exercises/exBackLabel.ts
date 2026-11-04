import { createContext, useContext } from 'react';

// Подпись «Назад» в шапке упражнения (ExScreen) — от того, откуда его открыли.
// Из «Практики» назад — к библиотеке упражнений; с «Сегодня» кнопка обещала
// «Назад к упражнениям», а вела на «Сегодня» (QA 2026-11, A-М10). Хост
// упражнений экрана задаёт подпись провайдером, сами упражнения не меняются.
export const EX_BACK_DEFAULT = 'Назад к упражнениям';

export const ExBackLabelContext = createContext(EX_BACK_DEFAULT);

export function useExBackLabel(): string {
  return useContext(ExBackLabelContext);
}
