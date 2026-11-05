// Блок «Приглашения клиентов» для /stats (правило №8): воронка «терапевт
// создал код → клиент подключился → терапевт отозвал» за 30 дней, отдельно
// считаем приглашения из офлайн-карточки (при подключении её данные переезжают
// на аккаунт). До этого воронка не считалась (docs/open/therapy.md): сколько
// кодов доходят до клиента, не видел никто. Чистый форматтер, покрыт тестом,
// включая пустую БД. Язык простой, безличный: отчёт админский.

export interface TherapyInviteBucket {
  /** Обычное приглашение («Новый клиент», «Ссылка»). */
  new: number;
  /** Приглашение из карточки офлайн-клиента. */
  offline: number;
}

export interface TherapyInviteMetrics {
  created: TherapyInviteBucket;
  joined: TherapyInviteBucket;
  revoked: TherapyInviteBucket;
}

const total = (b: TherapyInviteBucket) => b.new + b.offline;

function line(label: string, b: TherapyInviteBucket): string | null {
  const all = total(b);
  if (all <= 0) return null;
  const tail = b.offline > 0 ? `, из них из офлайн-карточки ${b.offline}` : '';
  return `${label}: ${all}${tail}.`;
}

export function formatTherapyInviteMetrics(m: TherapyInviteMetrics): string {
  const title = '✉️ <b>Приглашения клиентов</b> (за 30 дней)';
  const lines = [
    line('Создали приглашений', m.created),
    line('Подключились по коду', m.joined),
    line('Отозвали', m.revoked),
  ].filter((s): s is string => s !== null);
  if (lines.length === 0) lines.push('Пока ничего.');
  return [title, ...lines].join('\n');
}
