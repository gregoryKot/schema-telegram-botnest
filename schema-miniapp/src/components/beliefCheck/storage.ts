// Хранилище проверок убеждений (вынесено из BeliefCheck.tsx).

export const STORAGE_KEY = 'belief_checks';

export interface BeliefEntry {
  id: string | number;
  date: string;
  belief: string;
  for: string[];
  against: string[];
  reframe: string;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
}

export function loadLocal(): BeliefEntry[] {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    ) as BeliefEntry[];
  } catch {
    return [];
  }
}
