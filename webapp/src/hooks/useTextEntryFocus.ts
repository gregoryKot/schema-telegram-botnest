import { useSyncExternalStore } from 'react';
import { getTyping, subscribe } from './textEntryFocus.store';

// «Человек сейчас печатает» (фокус в текстовом поле на устройстве с касанием):
// состояние и слушатели — textEntryFocus.store.ts, ожидание ухода клавиатуры
// iOS — keyboardSettled.ts. Здесь только подписка React.

export function useTextEntryFocus(): boolean {
  return useSyncExternalStore(subscribe, getTyping, () => false);
}
