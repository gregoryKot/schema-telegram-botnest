import { useRef, useState } from 'react';

// Состояние меню «⋯» с возвратом фокуса: пункт сначала возвращает фокус кнопке-якорю,
// потом закрывает меню и зовёт действие. Иначе фокус падает на body, и диалог/лист,
// открытый пунктом, запомнит body: «Отмена» вернёт фокус в никуда. Сам Dropdown
// возвращает фокус только по Escape — клик снаружи фокус красть не должен.
export function useMenuPick() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pick = (fn: () => void) => () => { btnRef.current?.focus(); setOpen(false); fn(); };
  return { open, setOpen, btnRef, pick };
}
