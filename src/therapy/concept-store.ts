// Хранение концептуализации клиента (ClientConceptualization): шифрование
// полей, расшифровка для ответа и запись со снимком истории. Один путь записи
// на «сохранить поля» (therapy-notes.service.ts) и «дописать с холста»
// (concept-append.service.ts): история и шифрование не разъезжаются.
import { Prisma, type ClientConceptualization } from '@prisma/client';
import { encrypt, decrypt, encryptJson, decryptJson } from '../utils/crypto';
import { nextConceptHistory } from './concept-history';

const CONCEPT_TEXT_FIELDS = [
  'earlyExperience',
  'unmetNeeds',
  'triggers',
  'copingStyles',
  'goals',
  'currentProblems',
  'modeTransitions',
] as const;

// JSON-массивы: метки схем/режимов, карта режимов (узлы и рёбра), связи
// режимов (alias, истоки, проявления, работа в терапии) и схем (убеждение,
// детский опыт) — клинические данные, шифруются целиком. Новое поле такого
// рода = строка здесь (и в encryption-policy / rotate-encryption/targets).
const CONCEPT_JSON_ARRAY_FIELDS = [
  'schemaIds',
  'modeIds',
  'modeMapNodes',
  'modeMapEdges',
  'modeLinks',
  'schemaLinks',
] as const;

/** Шифрует только пришедшие поля: undefined — «не трогать», в апдейт не идёт. */
export function encryptConceptFields(
  body: Record<string, unknown>,
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const f of CONCEPT_TEXT_FIELDS) {
    if (body[f] !== undefined) result[f] = encrypt(body[f] as string | null);
  }
  // Encrypted JSON string (plaintext-tolerant on read).
  for (const f of CONCEPT_JSON_ARRAY_FIELDS) {
    const v = body[f];
    if (Array.isArray(v)) result[f] = encryptJson(v) ?? JSON.stringify(v);
  }
  return result;
}

export function decryptConceptFields(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const f of CONCEPT_TEXT_FIELDS) {
    result[f] = row[f] != null ? decrypt(row[f] as string) : null;
  }
  // Legacy rows have plain JSON arrays; new rows have encrypted strings. Нет
  // значения (старый снапшот истории, строка до колонки modeLinks) — [].
  for (const f of CONCEPT_JSON_ARRAY_FIELDS) {
    const v = row[f];
    if (v == null) result[f] = [];
    else if (typeof v === 'string') result[f] = decryptJson<unknown[]>(v) ?? [];
    else result[f] = v;
  }
  return result;
}

/** Ответ GET/POST/append: строка с расшифрованными полями и историей. */
export function conceptView(row: ClientConceptualization, history: unknown) {
  const snaps = Array.isArray(history) ? history : [];
  return {
    ...row,
    ...decryptConceptFields(row),
    history: snaps.map((h: Record<string, unknown>) => ({
      ...h,
      ...decryptConceptFields(h),
    })),
  };
}

/**
 * Пишет уже зашифрованные поля `enc` в строку пары терапевт–клиент внутри
 * транзакции: снимок прежнего состояния в историю (окно склейки —
 * concept-history.ts, иначе автосохранение выжигает историю, #752),
 * частичный апдейт (только поля из `enc`), создание строки при первой записи.
 */
export async function writeConceptWithHistory(
  tx: Prisma.TransactionClient,
  key: { therapistId: bigint; clientId: bigint },
  existing: ClientConceptualization | null,
  enc: Record<string, string | null>,
  nowMs: number,
) {
  const hist = nextConceptHistory(
    existing && Array.isArray(existing.history) ? existing.history : [],
    existing,
    nowMs,
  );
  const row = await tx.clientConceptualization.upsert({
    where: { therapistId_clientId: key },
    create: {
      ...key,
      schemaIds: enc.schemaIds ?? [],
      modeIds: enc.modeIds ?? [],
      earlyExperience: enc.earlyExperience ?? null,
      unmetNeeds: enc.unmetNeeds ?? null,
      triggers: enc.triggers ?? null,
      copingStyles: enc.copingStyles ?? null,
      goals: enc.goals ?? null,
      currentProblems: enc.currentProblems ?? null,
      modeTransitions: enc.modeTransitions ?? null,
      modeMapNodes: enc.modeMapNodes ?? [],
      modeMapEdges: enc.modeMapEdges ?? [],
      modeLinks: enc.modeLinks ?? [],
      schemaLinks: enc.schemaLinks ?? [],
      history: [],
    },
    update: { ...enc, history: hist as Prisma.InputJsonValue },
  });
  return { row, history: hist };
}
