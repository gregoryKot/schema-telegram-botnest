import { DiaryType } from '../types';

export const DRAFT_KEYS: Record<DiaryType, string> = {
  schema:    'diary_draft_schema',
  mode:      'diary_draft_mode',
  gratitude: 'diary_draft_gratitude',
};

export interface DiaryDraft<T> {
  startedAt: string; // ISO
  data: T;
}

export function saveDraft<T>(type: DiaryType, data: T) {
  const draft: DiaryDraft<T> = { startedAt: new Date().toISOString(), data };
  try { localStorage.setItem(DRAFT_KEYS[type], JSON.stringify(draft)); } catch {}
}

export function loadDraft<T>(type: DiaryType): DiaryDraft<T> | null {
  try {
    const s = localStorage.getItem(DRAFT_KEYS[type]);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clearDraft(type: DiaryType) {
  localStorage.removeItem(DRAFT_KEYS[type]);
}

export function hasDraft(type: DiaryType): boolean {
  return !!localStorage.getItem(DRAFT_KEYS[type]);
}

export function formatDraftAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (days > 0) return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} назад`;
  if (hours > 0) return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} назад`;
  if (mins > 0) return `${mins} мин. назад`;
  return 'только что';
}
