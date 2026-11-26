// Блок «Приглашения клиентов» для /stats (правило №8): воронка «создали код →
// подключились → отозвали» за 30 дней, отдельно — коды из офлайн-карточки и
// сверка «тот же человек?» (S8). Чистый форматтер, тест — с пустой БД.
import type { TherapyInviteStep as Step } from '../analytics/therapy-invite-events.constants';

export interface TherapyInviteBucket {
  new: number; // обычное приглашение («Новый клиент», «Ссылка»)
  offline: number; // из карточки офлайн-клиента
}

export type TherapyInviteMetrics = Record<Step, TherapyInviteBucket>;

const total = (b: TherapyInviteBucket) => b.new + b.offline;

function line(label: string, b: TherapyInviteBucket): string | null {
  const all = total(b);
  if (all <= 0) return null;
  const tail = b.offline > 0 ? `, из них из офлайн-карточки ${b.offline}` : '';
  return `${label}: ${all}${tail}.`;
}

function claimLine(m: TherapyInviteMetrics): string | null {
  const [yes, no] = [total(m.confirmed), total(m.denied)];
  if (yes + no <= 0) return null;
  return `Код из офлайн-карточки ввёл тот же человек: да ${yes}, нет ${no}.`;
}

export function formatTherapyInviteMetrics(m: TherapyInviteMetrics): string {
  const title = '✉️ <b>Приглашения клиентов</b> (за 30 дней)';
  const lines = [
    line('Создали приглашений', m.created),
    line('Подключились по коду', m.joined),
    line('Отозвали', m.revoked),
    claimLine(m),
  ].filter((s): s is string => s !== null);
  if (lines.length === 0) lines.push('Пока ничего.');
  return [title, ...lines].join('\n');
}
