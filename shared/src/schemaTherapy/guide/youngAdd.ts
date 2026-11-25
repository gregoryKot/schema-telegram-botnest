import type { GuideVoiceFields } from './types';

/** Что досбор по Янгу дописывает записи: новые пункты отдельными элементами, не правкой старых. */
export interface YoungAdd {
  steps?: string[];
  points?: string[];
  voice?: string[];
  more?: string[];
  /** Метка книги, если её ещё нет в источниках записи. */
  source?: string;
}

type Addable = GuideVoiceFields & {
  sources: string;
  steps?: string[];
  points?: string[];
};

const LISTS = ['steps', 'points', 'voice', 'more'] as const;

export function withYoung<T extends object>(item: T, add: YoungAdd): T {
  const out = { ...item } as T & Addable;
  for (const key of LISTS) {
    const extra = add[key];
    if (extra) out[key] = [...(out[key] ?? []), ...extra];
  }
  if (add.source && !out.sources.includes('[Янг')) {
    out.sources = `${out.sources}, ${add.source}`;
  }
  return out;
}

export function withYoungById<T extends { id: string }>(
  list: T[],
  adds: Record<string, YoungAdd>,
): T[] {
  return list.map((item) =>
    adds[item.id] ? withYoung(item, adds[item.id]) : item,
  );
}
