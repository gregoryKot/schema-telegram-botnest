// Воронка теста схем для /stats: «начали → хоть раз дошли до конца».
//
// Находка аудита 2026-10-11 (docs/AUDIT_2026-10_FINDINGS.md, «Воронка теста
// схем»): «начали» считались по YsqProgress, а клиент удаляет прогресс, как
// только результат сохранён (useYsqTest → deleteYsqProgress). Каждый, кто
// дошёл до конца, пропадал из «начали», и отчёт писал «Начали: 1 · дошли до
// конца: 3 (300%)». «Дошли» по одному YsqResult тоже врали: повторное
// прохождение (handleRetake) удаляет YsqResult, и человек выпадал из числа
// прошедших, хотя уже проходил тест.
//
// Поэтому оба числа — разные люди из таблиц, которые переживают переход на
// следующий шаг: прошедший тест всегда оставляет строку в YsqResultHistory
// (saveYsqResult пишет её в той же транзакции), YsqResult — для строк до
// появления истории. «Начали» = прошедшие ∪ те, у кого сейчас есть прогресс,
// так что completed ≤ started выполняется по построению; проверка в
// ysqFunnelLine — защита на случай, если источник снова разойдётся.
//
// Кнопка «Удалить результаты теста» в настройках (DELETE /api/ysq-data,
// YsqService.deleteAllYsqData) стирает все три таблицы — человек законно
// выпадает и из «начали», и из «дошли» (решение владельца 2026-10-22).
import type { PrismaService } from '../prisma/prisma.service';

export interface YsqFunnel {
  started: number;
  completed: number;
}

/** Один сырой запрос: UNION сам убирает повторы userId между таблицами. */
export async function countYsqFunnel(
  prisma: Pick<PrismaService, '$queryRaw'>,
): Promise<YsqFunnel> {
  const rows = await prisma.$queryRaw<
    Array<{ started: bigint; completed: bigint }>
  >`
    SELECT
      (SELECT count(*) FROM (
         SELECT "userId" FROM "YsqProgress"
         UNION SELECT "userId" FROM "YsqResult"
         UNION SELECT "userId" FROM "YsqResultHistory"
       ) s)::bigint AS started,
      (SELECT count(*) FROM (
         SELECT "userId" FROM "YsqResult"
         UNION SELECT "userId" FROM "YsqResultHistory"
       ) c)::bigint AS completed`;
  return {
    started: Number(rows[0]?.started ?? 0n),
    completed: Number(rows[0]?.completed ?? 0n),
  };
}

/** Строка отчёта: пусто словами, процент не выше 100, расхождение — честно. */
export function ysqFunnelLine({ started, completed }: YsqFunnel): string {
  if (started === 0 && completed === 0) return 'Пока тест никто не начинал';
  const head = `Начали: ${started} · дошли до конца: ${completed}`;
  if (completed > started) return `${head} — данные не сходятся`;
  return `${head} (${Math.round((completed / started) * 100)}%)`;
}
