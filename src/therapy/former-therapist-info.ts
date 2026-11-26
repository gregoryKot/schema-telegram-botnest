import { PrismaService } from '../prisma/prisma.service';
import {
  CLIENT_LEFT,
  RelationEndReason,
  THERAPIST_REMOVED,
  THERAPIST_RESIGNED,
} from './relation-end-reason';
import { therapistName } from './therapist-name';

// Бывший терапевт клиента (GET /api/therapy/former-therapist): вместо пустого
// «Мой терапевт» клиент видит строку о том, чем закончилась связь. Причин три
// (relation-end-reason.ts), у каждой свой текст на фронте
// (shared/src/therapy/formerTherapist.ts): терапевт отказался от роли
// (решение владельца 2026-10-22), терапевт убрал клиента, клиент отключился
// сам (2026-11-05). GET /api/therapy/relation не трогаем: его null по всему
// фронту значит «терапевта нет».
//
// null, когда строка не нужна: у клиента есть живая связь (active или
// pending — подключён новый терапевт) либо завершённых связей с известной
// причиной нет. Иначе — последняя такая связь. Отказ от роли считается, только
// если терапевт сейчас не THERAPIST (та же сверка, что в бэкфиле миграции
// 20261022150000): «больше не работает» про вернувшегося было бы неправдой.
// `ended` без причины — дубль пары из миграции 20261016100000, не история.
// Строк у клиента — по одной на бывшую связь, поэтому фильтр и порядок
// считаются здесь, а не в SQL: NULLS LAST по endedAt (у старых связей даты нет)
// одинаков на Postgres и фейке.
export interface FormerTherapistInfo {
  name: string;
  endedAt: string | null;
  reason: RelationEndReason;
}

export async function getFormerTherapistInfo(
  prisma: PrismaService,
  clientId: bigint,
): Promise<FormerTherapistInfo | null> {
  const live = await prisma.therapyRelation.count({
    where: { clientId, status: { in: ['active', 'pending'] } },
  });
  if (live > 0) return null;
  const rows = await prisma.therapyRelation.findMany({
    where: { clientId, status: 'ended', endReason: { in: REASONS } },
    include: { therapist: { select: { firstName: true, role: true } } },
  });
  const latest = rows.filter(isShown).sort(byLatestEnd)[0];
  if (!latest) return null;
  return {
    name: therapistName(latest.therapist) ?? '',
    endedAt: latest.endedAt ? latest.endedAt.toISOString() : null,
    reason: latest.endReason as RelationEndReason,
  };
}

const REASONS: RelationEndReason[] = [
  THERAPIST_RESIGNED,
  THERAPIST_REMOVED,
  CLIENT_LEFT,
];

// Роль сверяется после выборки: фильтр по связанной записи внутри OR фейковая
// Prisma e2e не исполняет (test/e2e-support/fake-user-join.ts), а строк у
// одного клиента единицы.
function isShown(r: {
  endReason: string | null;
  therapist: { role: string } | null;
}): boolean {
  if (r.endReason !== THERAPIST_RESIGNED) return true;
  return r.therapist !== null && r.therapist.role !== 'THERAPIST';
}

type Ended = { endedAt?: Date | null; createdAt?: Date | null };

const ms = (d: Date | null | undefined): number | null =>
  d ? d.getTime() : null;

/** endedAt по убыванию, пустые в конце; при равенстве — createdAt по убыванию. */
export function byLatestEnd(a: Ended, b: Ended): number {
  const ea = ms(a.endedAt);
  const eb = ms(b.endedAt);
  if (ea !== eb) {
    if (ea === null) return 1;
    if (eb === null) return -1;
    return eb - ea;
  }
  return (ms(b.createdAt) ?? 0) - (ms(a.createdAt) ?? 0);
}
