// Ручки пути клиента (#1522, только терапевт). Отдельным модулем, как planApi.ts: api.ts сайта упирается
// в лимит размера файла (правило №10). Ответ каждой ручки — путь целиком: экран просто заменяет его.
import type { UserId } from '../../userId';
import type { PathPhaseDraft, TherapyPath } from './pathModel';

interface PathTransport {
  get<T>(path: string): Promise<T>;
  postJson<T>(path: string, body: unknown): Promise<T>;
  patchJson<T>(path: string, body: unknown): Promise<T>;
  del(path: string): Promise<void>;
}

export interface PathPhasePatch {
  name?: string;
  goal?: string | null;
  weeks?: number;
  note?: string | null;
  criteriaDone?: number[];
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface PathResponse {
  path: TherapyPath | null;
}

const BASE = '/api/therapy/path';

export const createPathApi = (t: PathTransport) => ({
  /** Пути нет — `{ path: null }`. */
  getTherapyPath: (clientId: UserId) =>
    t.get<PathResponse>(`${BASE}/${clientId}`),
  /** Путь уже есть — 409. */
  createTherapyPath: (
    clientId: UserId,
    body: {
      startDate: string;
      templateId: string | null;
      phases: PathPhaseDraft[];
    },
  ) => t.postJson<PathResponse>(`${BASE}/${clientId}`, body),
  addPathPhase: (clientId: UserId, draft: PathPhaseDraft) =>
    t.postJson<PathResponse>(`${BASE}/${clientId}/phases`, draft),
  /** Новый порядок: ровно все id фаз пути. */
  reorderPathPhases: (clientId: UserId, ids: number[]) =>
    t.postJson<PathResponse>(`${BASE}/${clientId}/phases/order`, { ids }),
  updatePathPhase: (id: number, body: PathPhasePatch) =>
    t.patchJson<PathResponse>(`${BASE}/phases/${id}`, body),
  /** Закрывает фазу днём `date` и начинает следующую тем же днём. */
  advancePathPhase: (id: number, date: string) =>
    t.postJson<PathResponse>(`${BASE}/phases/${id}/advance`, { date }),
  /** DELETE ответа не читает (транспорт), поэтому путь перечитывается следом. */
  deletePathPhase: (clientId: UserId, id: number) =>
    t
      .del(`${BASE}/phases/${id}`)
      .then(() => t.get<PathResponse>(`${BASE}/${clientId}`)),
});

export type PathApi = ReturnType<typeof createPathApi>;
