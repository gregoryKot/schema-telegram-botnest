// Чтение и переименование комнаты Zoom по id (разовая чистка, foreign-scrub.ts).
// В запрос уходит только id комнаты и общее название ZOOM_TOPIC.
export type ZoomRoomResult = 'ok' | 'missing' | 'limited' | 'failed';

const ZOOM_MEETINGS = 'https://api.zoom.us/v2/meetings/';

// 404 — комнату удалили в Zoom; 429 — лимит площадки (у PATCH ещё и дневной).
function classify(status: number): ZoomRoomResult {
  if (status === 404) return 'missing';
  if (status === 429) return 'limited';
  return 'failed';
}

async function zoomCall(
  token: string,
  id: string,
  init: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(ZOOM_MEETINGS + encodeURIComponent(id), {
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

/** Текущее название комнаты; GET в дневной лимит изменений не входит. */
export async function readZoomTopic(
  token: string,
  id: string,
): Promise<{ result: ZoomRoomResult; topic?: string }> {
  const res = await zoomCall(token, id, { method: 'GET' });
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
  const res = await zoomCall(token, id, {
    method: 'PATCH',
    body: JSON.stringify({ topic }),
  });
  if (!res) return 'failed';
  return res.ok ? 'ok' : classify(res.status);
}
