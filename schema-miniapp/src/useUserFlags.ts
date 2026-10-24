import { useState, useEffect } from 'react';
import { authedFetch } from './apiClient';

export type UserFlags = {
  themePref: string | null;
  onboardingV1Done: boolean;
  onboardingV2Done: boolean;
  onboardingSkipped: string[];
  childhoodWheelDone: boolean;
  ysqBannerDismissed: boolean;
  hintSheetCloseShown: boolean;
  hintHistoryDismissed: boolean;
  trackerOnboardingDone: boolean;
  lastCelebrationDate: string | null;
  lastYesterdayBannerDate: string | null;
  lastWeeklyQuestionWeek: number | null;
  schemaIntrosShown: string[];
  modeIntrosShown: string[];
  therapistMode: boolean;
  defaultSection: string | null;
};

const DEFAULT_FLAGS: UserFlags = {
  themePref: null,
  onboardingV1Done: false,
  onboardingV2Done: false,
  onboardingSkipped: [],
  childhoodWheelDone: false,
  ysqBannerDismissed: false,
  hintSheetCloseShown: false,
  hintHistoryDismissed: false,
  trackerOnboardingDone: false,
  lastCelebrationDate: null,
  lastYesterdayBannerDate: null,
  lastWeeklyQuestionWeek: null,
  schemaIntrosShown: [],
  modeIntrosShown: [],
  therapistMode: false,
  defaultSection: null,
};

// ── Module-level singleton ─────────────────────────────────────────────────

let flags: UserFlags = { ...DEFAULT_FLAGS };
let loaded = false;
// Ответ сервера реально получен (а не «попытка завершилась»). Различать
// обязательно: дефолтные флаги неотличимы от флагов новичка, и после
// неудачного запроса прошедший онбординг человек проходил его снова.
let loadedFromServer = false;
const subscribers = new Set<(f: UserFlags) => void>();
let fetchPromise: Promise<void> | null = null;

function notify(): void {
  for (const sub of subscribers) sub(flags);
}

async function doFetch(): Promise<void> {
  try {
    // Через authedFetch, а не голым fetch: в браузере (ярлык, сайт) вход идёт
    // по Bearer из session.ts, а `host.authHeaders()` там пуст — запрос уходил
    // без авторизации, флаги не читались и не сохранялись НИКОГДА. В Telegram
    // та же дыра открывалась через час, когда протухала initData
    // (инцидент 2026-07-29, ради него и появился session.ts).
    const res = await authedFetch('/api/user-flags');
    if (res.ok) {
      const data = (await res.json()) as Partial<UserFlags>;
      flags = { ...DEFAULT_FLAGS, ...data };
      loadedFromServer = true;
    }
  } catch {
    /* network error — keep defaults */
  }
  loaded = true;
  notify();
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Call once before first render (main.tsx) to pre-fetch flags in parallel. */
export function ensureUserFlagsLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!fetchPromise) fetchPromise = doFetch();
  return fetchPromise;
}

/**
 * Set a single flag locally and persist to server in the background.
 * Optimistic: UI updates immediately, POST fires async.
 */
export async function setFlag<K extends keyof UserFlags>(
  key: K,
  value: UserFlags[K],
): Promise<void> {
  flags = { ...flags, [key]: value };
  notify();
  try {
    await authedFetch('/api/user-flags', {
      method: 'POST',
      body: JSON.stringify({ [key]: value }),
    });
  } catch {
    /* silent — flag is already updated locally */
  }
}

/**
 * Set multiple flags at once.
 */
export async function updateFlags(patch: Partial<UserFlags>): Promise<void> {
  flags = { ...flags, ...patch };
  notify();
  try {
    await authedFetch('/api/user-flags', {
      method: 'POST',
      body: JSON.stringify(patch),
    });
  } catch {
    /* best-effort: ошибку намеренно игнорируем */
  }
}

/**
 * React hook — returns current flags and helpers.
 * Re-renders whenever any flag changes.
 *
 * Usage:
 *   const { flags, setFlag } = useUserFlags();
 *   // read:  flags.childhoodWheelDone
 *   // write: setFlag('childhoodWheelDone', true)
 */
export function useUserFlags(): {
  flags: UserFlags;
  loaded: boolean;
  loadedFromServer: boolean;
  setFlag: typeof setFlag;
  updateFlags: typeof updateFlags;
} {
  const [current, setCurrent] = useState<UserFlags>(() => ({ ...flags }));
  // `loaded` нужен, чтобы стартовая логика не приняла дефолтные флаги за
  // серверные (иначе экран моргнёт до подгрузки настроек).
  const [isLoaded, setIsLoaded] = useState<boolean>(loaded);
  // Отдельно от `loaded`: решения вида «показать первый вход» имеют право
  // опираться только на РЕАЛЬНО прочитанные с сервера флаги.
  const [fromServer, setFromServer] = useState<boolean>(loadedFromServer);

  useEffect(() => {
    setCurrent({ ...flags }); // sync in case flags loaded between render and effect
    setIsLoaded(loaded);
    setFromServer(loadedFromServer);
    const handler = (f: UserFlags) => {
      setCurrent({ ...f });
      setIsLoaded(loaded);
      setFromServer(loadedFromServer);
    };
    subscribers.add(handler);
    void ensureUserFlagsLoaded();
    return () => {
      subscribers.delete(handler);
    };
  }, []);

  return {
    flags: current,
    loaded: isLoaded,
    loadedFromServer: fromServer,
    setFlag,
    updateFlags,
  };
}
