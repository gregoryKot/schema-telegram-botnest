/**
 * Отчёт журнала отправок для владельца (`/zv log`). Чистый форматтер: его
 * читают в чате, поэтому язык простой — «дошло / не дошло», а не «delivery
 * status». Время — московское, как и расписание канала.
 */
import { mskParts } from '../bot/healthy-adult.schedule';

export interface DeliveryRow {
  source: string;
  platform: string;
  destination: string;
  ok: boolean;
  reason: string | null;
  /** Фраза публикации — по ней повтор досылает то же самое. */
  text?: string | null;
  createdAt: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** «31.07 10:07» по Москве. */
function when(at: Date): string {
  const { dateKey, hour, minute } = mskParts(at);
  return `${dateKey.slice(8)}.${dateKey.slice(5, 7)} ${pad(hour)}:${pad(minute)}`;
}

/** Длинную причину режем: в отчёте важно «что за площадка и что стряслось». */
const clip = (reason: string | null): string => {
  const first = (reason ?? 'причина не записана').split('\n')[0];
  return first.length > 90 ? `${first.slice(0, 90)}…` : first;
};

/**
 * Первая строка отчёта — когда собран работающий сейчас образ. Без неё вопрос
 * «доехал ли фикс до сервера» решался сравнением текстов ошибок (31.07.2026:
 * хостинг не смог подтянуть коммит, пересборка собрала старое, и полдня ушло
 * на выяснение этого).
 */
export function formatBuildLine(at: Date | null): string {
  return at
    ? `Сервер собран ${when(at)}.`
    : 'Сервер собран неизвестно когда — в образе нет метки сборки.';
}

export function formatDeliveryLog(rows: DeliveryRow[]): string {
  if (rows.length === 0)
    return 'Журнал пуст: с момента запуска канал ещё ничего не отправлял.';
  const lines = rows.map((r) => {
    const tail = r.ok ? 'дошло' : `не дошло — ${clip(r.reason)}`;
    return `${when(r.createdAt)} · ${r.source} · ${r.platform} — ${tail}`;
  });
  return `Последние отправки (время московское, новые сверху):\n${lines.join('\n')}`;
}
