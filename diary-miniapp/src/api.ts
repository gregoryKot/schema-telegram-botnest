import { SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, EmotionEntry } from './types';

const rawBase = (import.meta.env.VITE_API_URL as string) ?? '';
const BASE = rawBase && !rawBase.startsWith('http') ? `https://${rawBase}` : rawBase;

function authHeaders(): Record<string, string> {
  return {
    'x-telegram-init-data': window.Telegram?.WebApp?.initData ?? '',
    'Content-Type': 'application/json',
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T = void>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export const api = {
  init: () => post('/api/init', {}),

  // Schema diary
  getSchemaDiary: () => get<SchemaDiaryEntry[]>('/api/diary/schema'),
  createSchemaDiary: (data: {
    situation: string;
    emotions: EmotionEntry[];
    emotionNote?: string;
    bodyFeelings?: string;
    thoughts?: string;
    schemaIds: string[];
    copingModeId?: string;
    healthyAdult?: string;
  }) => post<SchemaDiaryEntry>('/api/diary/schema', data),
  deleteSchemaDiary: (id: number) => del(`/api/diary/schema/${id}`),

  // Mode diary
  getModeDiary: () => get<ModeDiaryEntry[]>('/api/diary/mode'),
  createModeDiary: (data: {
    modeId: string;
    trigger: string;
    intensity: number;
    healthyAdult?: string;
  }) => post<ModeDiaryEntry>('/api/diary/mode', data),
  deleteModeDiary: (id: number) => del(`/api/diary/mode/${id}`),

  // Gratitude diary
  getGratitudeDiary: () => get<GratitudeDiaryEntry[]>('/api/diary/gratitude'),
  createGratitudeDiary: (date: string, items: string[]) =>
    post<GratitudeDiaryEntry>('/api/diary/gratitude', { date, items }),
  deleteGratitudeDiary: (id: number) => del(`/api/diary/gratitude/${id}`),
};
