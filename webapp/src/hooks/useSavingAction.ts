import { useCallback, useRef, useState } from 'react';

/**
 * Общий примитив «нажал → сохраняю → готово/ошибка» (аудит 2026-08-22,
 * находка №2 — webapp/src/components/exercises/FlashcardEx.tsx: кнопка
 * сохранения не показывала состояние отправки, не защищала от двойного
 * нажатия и при ошибке api-вызова молчала). Тот же ручной набор
 * saving/saveError/guard уже жил втрое переписанным в BeliefCheckEx,
 * LetterEx и PhraseCheckEx — правило CLAUDE.md «одна механика — один
 * компонент»: механика одна (сохранить с обратной связью), реализация одна.
 *
 * `run(fn)` выполняет `fn`, пока предыдущий вызов не завершился — второй
 * клик игнорируется. Возвращает true при успехе / false при ошибке, чтобы
 * вызывающий код мог решить, показывать ли «готово» (см. FlashcardEx).
 *
 * Guard — на ref, не на state `saving`: `run` не в зависимостях от `saving`
 * (иначе identity менялась бы на каждый rerender), а React батчит synchronous
 * повторные клики в одном тике — читать `saving` из замыкания в этот момент
 * ненадёжно. Ref обновляется синхронно, до любого сеттера состояния.
 */
export function useSavingAction() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(async (fn: () => Promise<void>): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setError(false);
    try {
      await fn();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, []);

  /** Сбросить ошибку — например, при повторном открытии формы после «готово». */
  const reset = useCallback(() => setError(false), []);

  return { saving, error, run, reset };
}
