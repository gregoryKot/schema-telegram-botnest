// Параметр запуска (`start_param` Telegram/MAX, `?startapp=` в адресе):
// что он просит открыть. Чистый разбор, одинаковый для обоих фронтендов
// (правило №3). Значение подконтрольно отправителю ссылки, поэтому неизвестное
// не угадывается: оно игнорируется.
import { readLocal, removeLocal, writeLocal } from '../utils/safeLocalStorage';

export type StartAction =
  | { kind: 'join'; joinKind: 'pair' | 'therapy'; code: string }
  | { kind: 'diaries' }
  | { kind: 'tracker' }
  /** «Задания»; с taskId — сразу это задание (кнопка уведомления о новом задании). */
  | { kind: 'tasks'; taskId?: number }
  /** Тест на схемы (уведомление «терапевт просит пройти тест»). */
  | { kind: 'ysq' };

const JOIN_PREFIXES: ReadonlyArray<['pair' | 'therapy', string]> = [
  ['pair', 'pair_'],
  ['therapy', 'therapy_'],
];

const TASK_PREFIX = 'tasks_';

export function parseStartParam(
  raw: string | null | undefined,
): StartAction | null {
  if (!raw) return null;
  for (const [joinKind, prefix] of JOIN_PREFIXES) {
    if (raw.startsWith(prefix)) {
      const code = raw.slice(prefix.length);
      return code ? { kind: 'join', joinKind, code } : null;
    }
  }
  if (raw === 'diaries') return { kind: 'diaries' };
  if (raw === 'tracker') return { kind: 'tracker' };
  if (raw === 'ysq') return { kind: 'ysq' };
  if (raw === 'tasks') return { kind: 'tasks' };
  if (raw.startsWith(TASK_PREFIX)) {
    // Только целое положительное число: «tasks_1e3», «tasks_-1» — мусор.
    const id = raw.slice(TASK_PREFIX.length);
    return /^[1-9]\d{0,9}$/.test(id)
      ? { kind: 'tasks', taskId: Number(id) }
      : null;
  }
  return null;
}

/** Ключи адреса, которыми сайт принимает параметр запуска. */
export const LAUNCH_KEYS = ['startapp', 'start_param'] as const;

/**
 * Параметр запуска из строки адреса (`?startapp=…`). Внутри Telegram и MAX
 * кнопка уведомления (web_app) открывает адрес как есть: `start_param` хоста
 * пуст, и ссылка `/today?startapp=tasks` работает только через этот разбор.
 */
export function urlStartParam(search?: string): string | null {
  const s =
    search ?? (typeof window === 'undefined' ? '' : window.location.search);
  const q = new URLSearchParams(s);
  return q.get(LAUNCH_KEYS[0]) ?? q.get(LAUNCH_KEYS[1]);
}

// Ссылка, открытая без входа: сайт уводит на /login и теряет адрес, а вход по
// почте вообще приходит новой вкладкой. Параметр ждёт входа здесь — в
// localStorage, чтобы пережить и вкладку письма; час — с запасом к сроку ссылки
// из письма (30 минут), дальше ссылка считается брошенной.
export const PENDING_LAUNCH_KEY = 'launch_param_pending';
const PENDING_TTL_MS = 3_600_000;

/** Запомнить параметр из адреса до входа. Параметра нет — ничего не трогаем. */
export function rememberLaunchParam(search: string, now = Date.now()): void {
  const raw = urlStartParam(search);
  if (!raw || !parseStartParam(raw)) return;
  writeLocal(PENDING_LAUNCH_KEY, JSON.stringify({ raw, at: now }));
}

/** Забрать отложенный параметр (один раз): после чтения он стирается. */
export function takeLaunchParam(now = Date.now()): string | null {
  const stored = readLocal(PENDING_LAUNCH_KEY);
  if (stored === null) return null;
  removeLocal(PENDING_LAUNCH_KEY);
  try {
    const { raw, at } = JSON.parse(stored) as { raw?: unknown; at?: unknown };
    if (typeof raw !== 'string' || typeof at !== 'number') return null;
    return now - at <= PENDING_TTL_MS ? raw : null;
  } catch {
    return null; // битая запись — ссылки нет, гадать не о чем
  }
}
