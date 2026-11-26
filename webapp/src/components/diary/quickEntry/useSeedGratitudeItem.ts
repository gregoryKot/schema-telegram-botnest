import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { mergeInitialItem } from './quickEntryModel';

/** Один раз, когда форма благодарности готова, кладёт текст из быстрой записи в её пункты. */
export function useSeedGratitudeItem(
  ready: boolean,
  initialItem: string | undefined,
  setItems: Dispatch<SetStateAction<string[]>>,
): void {
  const seeded = useRef(false);
  useEffect(() => {
    if (!ready || seeded.current || !initialItem) return;
    seeded.current = true;
    setItems((prev) => mergeInitialItem(prev, initialItem));
  }, [ready, initialItem, setItems]);
}
