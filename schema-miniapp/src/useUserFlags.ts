import { useState, useEffect } from 'react';

export type UserFlags = {
  themePref: string | null;
  onboardingV1Done: boolean;
  onboardingV2Done: boolean;
  onboardingSkipped: string[];
  practicesOnboardingDone: boolean;
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
  practicesOnboardingDone: false,
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
const subscribers = new Set<(f: UserFlags) => void>();
let fetchPromise: Promise<void> | null = null;

function getHeaders(): Record<string, string> {
  const initData = window.Telegram?.WebApp?.initData ?? '';
  return {
    'x-telegram-init-data': initData,
    'Content-Type': 'application/json',
  };
}

function notify(): void {
  for (const sub of subscribers) sub(flags);
}

async function doFetch(): Promise<void> {
  try {
    const res = await fetch('/api/user-flags', { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      flags = { ...DEFAULT_FLAGS, ...data };
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
    await fetch('/api/user-flags', {
      method: 'POST',
      headers: getHeaders(),
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
    await fetch('/api/user-flags', {
      method: 'POST',
      headers: getHeaders(),
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
  setFlag: typeof setFlag;
  updateFlags: typeof updateFlags;
} {
  const [current, setCurrent] = useState<UserFlags>(() => ({ ...flags }));

  useEffect(() => {
    setCurrent({ ...flags }); // sync in case flags loaded between render and effect
    const handler = (f: UserFlags) => setCurrent({ ...f });
    subscribers.add(handler);
    void ensureUserFlagsLoaded();
    return () => {
      subscribers.delete(handler);
    };
  }, []);

  return { flags: current, setFlag, updateFlags };
}
