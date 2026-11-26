// Комнаты Zoom для разовой чистки (foreign-scrub.ts, zoom-orphans.ts): чтение,
// переименование, удаление, список. В запрос уходит только id комнаты и ZOOM_TOPIC.
export type ZoomRoomResult = 'ok' | 'missing' | 'limited' | 'failed';
export type ZoomDeleteResult = ZoomRoomResult | 'forbidden';
export type ZoomListResult = 'ok' | 'limited' | 'forbidden' | 'failed';

export interface ZoomMeetingRow {
  id: string;
  topic: string;
  type: number | null;
}

export interface ZoomListed {
  result: ZoomListResult;
  meetings: ZoomMeetingRow[];
  /** Почему список не получен: HTTP-статус и код ошибки Zoom — для отчёта. */
  detail?: string;
}

const ZOOM_API = 'https://api.zoom.us/v2/';
const PAGE_SIZE = 300; // максимум страницы List meetings
const MAX_PAGES = 50; // страховка от токена, который не кончается
// Отказ списка: 403 — нет права, 429 — лимит площадки, прочее — сбой.
const LIST_REFUSAL: Record<number, ZoomListResult> = {
  403: 'forbidden',
  429: 'limited',
};

// 404 — комнату удалили в Zoom; 429 — лимит площадки (у PATCH ещё и дневной).
function classify(status: number): ZoomRoomResult {
  if (status === 404) return 'missing';
  if (status === 429) return 'limited';
  return 'failed';
}

async function zoomCall(
  token: string,
  path: string,
  init: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(ZOOM_API + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return null;
  }
}

const meetingPath = (id: string) => `meetings/${encodeURIComponent(id)}`;

/** Текущее название комнаты; GET в дневной лимит изменений не входит. */
export async function readZoomTopic(
  token: string,
  id: string,
): Promise<{ result: ZoomRoomResult; topic?: string }> {
  const res = await zoomCall(token, meetingPath(id), { method: 'GET' });
  if (!res) return { result: 'failed' };
  if (!res.ok) return { result: classify(res.status) };
  const data = (await res.json().catch(() => ({}))) as { topic?: unknown };
  return {
    result: 'ok',
    topic: typeof data.topic === 'string' ? data.topic : undefined,
  };
}

/** PATCH названия; Zoom отвечает 204 без тела. */
export async function renameZoomRoom(
  token: string,
  id: string,
  topic: string,
): Promise<ZoomRoomResult> {
  const res = await zoomCall(token, meetingPath(id), {
    method: 'PATCH',
    body: JSON.stringify({ topic }),
  });
  if (!res) return 'failed';
  return res.ok ? 'ok' : classify(res.status);
}

/** DELETE комнаты: 204 — удалена, 404 — её уже нет. Письмо об отмене не шлётся. */
export async function deleteZoomRoom(
  token: string,
  id: string,
): Promise<ZoomDeleteResult> {
  const path = `${meetingPath(id)}?schedule_for_reminder=false`;
  const res = await zoomCall(token, path, { method: 'DELETE' });
  if (!res) return 'failed';
  if (res.ok) return 'ok';
  return res.status === 403 ? 'forbidden' : classify(res.status);
}

function toRow(raw: unknown): ZoomMeetingRow | null {
  const m = (raw ?? {}) as { id?: unknown; topic?: unknown; type?: unknown };
  const id =
    typeof m.id === 'number' || typeof m.id === 'string' ? String(m.id) : '';
  if (!/^\d+$/.test(id)) return null;
  const topic = typeof m.topic === 'string' ? m.topic : '';
  return { id, topic, type: typeof m.type === 'number' ? m.type : null };
}

/** Тело ответа объектом; не JSON — null, и вызывающий сам отчитывается о сбое. */
async function jsonBody(
  res: Response,
): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await res.json();
    return typeof data === 'object' && data
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const listFailed = (detail: string): ZoomListed => ({
  result: 'failed',
  meetings: [],
  detail,
});

async function failure(res: Response): Promise<ZoomListed> {
  const code = (await jsonBody(res))?.code;
  return {
    result: LIST_REFUSAL[res.status] ?? 'failed',
    meetings: [],
    detail:
      `HTTP ${res.status}` + (typeof code === 'number' ? `, код ${code}` : ''),
  };
}

/** Все встречи того же users/me, что создаёт комнаты (meeting.service.ts), постранично. */
export async function listZoomMeetings(token: string): Promise<ZoomListed> {
  const meetings: ZoomMeetingRow[] = [];
  let next = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({
      type: 'scheduled',
      page_size: String(PAGE_SIZE),
    });
    if (next) q.set('next_page_token', next);
    const res = await zoomCall(token, `users/me/meetings?${q.toString()}`, {
      method: 'GET',
    });
    if (!res) return listFailed('нет ответа');
    if (!res.ok) return failure(res);
    const data = await jsonBody(res);
    if (!data || !Array.isArray(data.meetings))
      return listFailed('ответ без списка');
    for (const raw of data.meetings as unknown[]) {
      const row = toRow(raw);
      if (row) meetings.push(row);
    }
    next = typeof data.next_page_token === 'string' ? data.next_page_token : '';
    if (!next) return { result: 'ok', meetings };
  }
  return listFailed(`больше ${MAX_PAGES} страниц`);
}
