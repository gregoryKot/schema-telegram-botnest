import { BASE, fetchWithTimeout } from '../../../apiClient';
import type {
  AdminAnalyticsDays, AdminOverview, AdminPersonRow, AdminStatsSectionInfo,
  AdminStatsSectionText, AdminTherapistRow,
} from '../../../../../shared/src/analytics/adminAnalytics';

// Ключ админа — в заголовке x-admin-key, как у остальных админ-запросов (не в URL).
async function getAdmin<T>(path: string, key: string): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}/api/analytics/admin${path}`, { headers: { 'x-admin-key': key } });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Нет доступа: ключ не подошёл' : 'Не удалось загрузить данные');
  return res.json() as Promise<T>;
}

export const analyticsApi = {
  overview: (key: string, days: AdminAnalyticsDays) => getAdmin<AdminOverview>(`/overview?days=${days}`, key),
  therapists: (key: string, days: AdminAnalyticsDays) => getAdmin<AdminTherapistRow[]>(`/therapists?days=${days}`, key),
  people: (key: string, days: AdminAnalyticsDays) => getAdmin<AdminPersonRow[]>(`/people?days=${days}`, key),
  sections: (key: string) => getAdmin<AdminStatsSectionInfo[]>('/sections', key),
  section: (key: string, id: string) => getAdmin<AdminStatsSectionText>(`/sections/${encodeURIComponent(id)}`, key),
};
