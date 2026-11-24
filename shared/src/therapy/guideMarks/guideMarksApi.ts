// Ручки отметок «Про клиента» из «Справочника» (#1484, только терапевт): отдельным модулем, как planApi.ts.
import type { UserId } from '../../userId';

/** Отметка раздела справочника у клиента (src/therapy/guide-marks.service.ts, GuideMarkView). */
export interface GuideMark {
  id: number;
  clientId: string;
  address: string;
  note: string | null;
  /** Текст раздела на момент отметки: покажется, если раздел переписан. */
  snapshot: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuideMarkInput {
  address: string;
  snapshot: string;
  note?: string;
}

interface GuideMarksTransport {
  get<T>(path: string): Promise<T>;
  putJson<T>(path: string, body: unknown): Promise<T>;
  del(path: string): Promise<void>;
}

const BASE = '/api/therapy/guide-marks';

export const createGuideMarksApi = (t: GuideMarksTransport) => ({
  getGuideMarks: (clientId: UserId) =>
    t.get<{ marks: GuideMark[] }>(`${BASE}/${clientId}`),
  /** Кому из клиентов терапевта раздел уже отмечен. */
  getGuideMarkClients: (address: string) =>
    t.get<{ clientIds: string[] }>(
      `${BASE}?address=${encodeURIComponent(address)}`,
    ),
  /** Повтор того же адреса тому же клиенту правит запись, а не плодит дубль. */
  saveGuideMark: (clientId: UserId, body: GuideMarkInput) =>
    t.putJson<{ mark: GuideMark; created: boolean }>(
      `${BASE}/${clientId}`,
      body,
    ),
  deleteGuideMark: (id: number) => t.del(`${BASE}/items/${id}`),
});
