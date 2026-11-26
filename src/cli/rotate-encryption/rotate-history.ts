// ClientConceptualization.history — JSON-массив снапшотов, у каждого поля
// зашифрованы ОТДЕЛЬНЫМИ строками (а не одна строка-колонка), поэтому общий
// цикл (rotate-all.ts) их не видит: значение колонки — массив, не строка.
// Ротируем вложенно: у каждого снапшота перешифровываем каждое строковое поле.
// reencrypt безопасен на не-шифртексте (дата, версия) — возвращает как есть.
import type { Prisma, PrismaClient } from '@prisma/client';
import { StepResult, rotateValue } from './rotate-value';

type Snapshot = Record<string, unknown>;

function rotateSnapshot(snap: unknown): {
  snap: unknown;
  changed: boolean;
  unreadable: number;
} {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap))
    return { snap, changed: false, unreadable: 0 };
  const out: Snapshot = { ...(snap as Snapshot) };
  let changed = false;
  let unreadable = 0;
  for (const [k, v] of Object.entries(out)) {
    if (typeof v !== 'string') continue;
    const r = rotateValue(v);
    if (r.unreadable) unreadable++;
    if (r.next !== null) {
      out[k] = r.next;
      changed = true;
    }
  }
  return { snap: out, changed, unreadable };
}

export async function rotateConceptHistory(
  prisma: PrismaClient,
  log: (line: string) => void,
): Promise<StepResult> {
  const rows = await prisma.clientConceptualization.findMany({
    select: { id: true, history: true },
  });
  let touched = 0;
  let unreadable = 0;
  for (const c of rows) {
    if (!Array.isArray(c.history)) continue;
    const parts = c.history.map(rotateSnapshot);
    unreadable += parts.reduce((n, p) => n + p.unreadable, 0);
    if (!parts.some((p) => p.changed)) continue;
    // Условие несёт прежнюю историю — тот же приём, что в rotate-all.ts: правка,
    // сделанная приложением за время ротации, не затирается.
    const { count } = await prisma.clientConceptualization.updateMany({
      where: {
        id: c.id,
        history: { equals: c.history },
      },
      data: { history: parts.map((p) => p.snap) as Prisma.InputJsonValue },
    });
    if (count > 0) touched++;
  }
  log(
    touched > 0
      ? `✓ clientConceptualization.history: ${touched}`
      : '  clientConceptualization.history: менять нечего',
  );
  return { touched, unreadable };
}
