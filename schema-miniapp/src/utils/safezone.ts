import { useState, useEffect } from 'react';

function readSafeTop(): number {
  const tg = (window.Telegram?.WebApp as any);
  if (!tg) return 0;
  const contentTop: number = tg?.contentSafeAreaInset?.top ?? 0;
  const deviceTop: number = tg?.safeAreaInset?.top ?? 0;
  return contentTop + deviceTop;
}

/**
 * Reactive hook — updates when Telegram reports safe area changes.
 * Falls back to 56px on iOS only if Telegram hasn't reported a value yet
 * AND we're on iOS (older Telegram versions that overlay the close button).
 */
export function useSafeTop(): number {
  const [safeTop, setSafeTop] = useState<number>(() => {
    const v = readSafeTop();
    if (v > 0) return v;
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return isIOS ? 56 : 0;
  });

  useEffect(() => {
    const tg = (window.Telegram?.WebApp as any);
    if (!tg) return;

    function update() {
      const v = readSafeTop();
      // Only apply iOS fallback if Telegram gives us nothing AND no content inset
      if (v === 0) {
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        // If contentSafeAreaInset is explicitly 0 (not undefined), trust it — no fallback
        const contentTopDefined = tg?.contentSafeAreaInset?.top !== undefined;
        setSafeTop(contentTopDefined ? 0 : (isIOS ? 56 : 0));
      } else {
        setSafeTop(v);
      }
    }

    tg.onEvent?.('safeAreaChanged', update);
    tg.onEvent?.('contentSafeAreaChanged', update);
    // Re-read shortly after mount — Telegram often reports insets with a small delay
    const t = setTimeout(update, 150);

    return () => {
      tg.offEvent?.('safeAreaChanged', update);
      tg.offEvent?.('contentSafeAreaChanged', update);
      clearTimeout(t);
    };
  }, []);

  return safeTop;
}

/** @deprecated Use useSafeTop() hook instead */
export function getTelegramSafeTop(): number {
  return readSafeTop();
}
