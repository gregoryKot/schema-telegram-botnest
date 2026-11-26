import { requireFound } from '../utils/require-affected';

// Страница дневника для «Записей» (R6, аудит 2026-11). Список отдавал только
// последние 30 записей, и старые было не открыть. Теперь «Показать ещё» берёт
// следующую страницу по курсору `before=<id>` — записи старше той, что уже
// показана последней. Признак «есть ещё» сервер считает сам: берёт на одну
// строку больше страницы, поэтому лишнего пустого запроса у клиента нет.

export const DIARY_PAGE_SIZE = 30;
export const DIARY_KINDS = ['schema', 'mode', 'gratitude'] as const;
export type DiaryKind = (typeof DIARY_KINDS)[number];

export interface DiaryPage<T> {
  items: T[];
  hasMore: boolean;
}

interface CreatedCursor {
  id: number;
  createdAt: Date;
}
type OlderThan =
  { createdAt: { lt: Date } } | { createdAt: Date; id: { lt: number } };

// Дневники схем и режимов: «новые сверху», при равном моменте — по id, чтобы
// граница страницы не теряла и не повторяла записи одного момента.
interface CreatedAtDelegate<R> {
  findFirst(args: {
    where: { id: number; userId: bigint };
    select: { id: true; createdAt: true };
  }): PromiseLike<CreatedCursor | null>;
  findMany(args: {
    where: { userId: bigint; OR?: OlderThan[] };
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }];
    take: number;
  }): PromiseLike<R[]>;
}

function toPage<R, O>(rows: R[], read: (row: R) => O): DiaryPage<O> {
  return {
    items: rows.slice(0, DIARY_PAGE_SIZE).map(read),
    hasMore: rows.length > DIARY_PAGE_SIZE,
  };
}

/** Чужой или удалённый курсор — 404: по ответу не узнать, чья это запись. */
export async function createdAtPage<R, O>(
  d: CreatedAtDelegate<R>,
  userId: bigint,
  before: number | undefined,
  read: (row: R) => O,
): Promise<DiaryPage<O>> {
  const c =
    before === undefined
      ? undefined
      : await requireFound(
          d.findFirst({
            where: { id: before, userId },
            select: { id: true, createdAt: true },
          }),
        );
  const older: OlderThan[] | undefined = c && [
    { createdAt: { lt: c.createdAt } },
    { createdAt: c.createdAt, id: { lt: c.id } },
  ];
  const rows = await d.findMany({
    where: older ? { userId, OR: older } : { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: DIARY_PAGE_SIZE + 1,
  });
  return toPage(rows, read);
}

// Благодарности: одна запись на день (@@unique userId+date), курсор — её день.
interface DateDelegate<R> {
  findFirst(args: {
    where: { id: number; userId: bigint };
    select: { date: true };
  }): PromiseLike<{ date: string } | null>;
  findMany(args: {
    where: { userId: bigint; date?: { lt: string } };
    orderBy: { date: 'desc' };
    take: number;
  }): PromiseLike<R[]>;
}

export async function datePage<R, O>(
  d: DateDelegate<R>,
  userId: bigint,
  before: number | undefined,
  read: (row: R) => O,
): Promise<DiaryPage<O>> {
  const c =
    before === undefined
      ? undefined
      : await requireFound(
          d.findFirst({
            where: { id: before, userId },
            select: { date: true },
          }),
        );
  const rows = await d.findMany({
    where: c ? { userId, date: { lt: c.date } } : { userId },
    orderBy: { date: 'desc' },
    take: DIARY_PAGE_SIZE + 1,
  });
  return toPage(rows, read);
}
