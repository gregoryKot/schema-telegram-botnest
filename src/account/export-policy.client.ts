// Реестр выгрузки для моделей, где человек — КЛИЕНТ терапевта (ключ clientId, а
// не userId). Парный к EXPORT_POLICY (export-policy.ts): тот классифицирует
// модели с userId, и модели терапевтической стороны в нём не видны — раньше
// файл выгрузки молчал о них целиком (аудит 2026-10, D2). A-10: часть этих
// данных человек и так видит в приложении («Мой терапевт», свои карты режимов),
// значит, отдать их в файле — право на переносимость, а не уступка.
//
// Классификация полная и проверяется спеком (export-policy.client.spec.ts):
//   - каждая модель с clientId обязана быть здесь (export либо withhold);
//   - у export-модели каждая колонка либо в `select` (уходит в файл), либо в
//     `omit` с причиной — новая колонка не уедет в файл молча и не пропадёт
//     молча (тот же принцип, что USER_EXPORT_SELECT у модели User);
//   - enc-поля из `select` обязаны быть в `schema` (расшифровываются).
import type { EncryptSchema } from '../utils/crypto';
import { FIELD_POLICY } from '../utils/encryption-policy';

export type ClientExportDecision =
  | {
      status: 'export';
      select: Record<string, true>;
      /** Колонки модели, которых нет в файле, и почему. */
      omit: Record<string, string>;
      schema?: EncryptSchema;
    }
  | { status: 'withhold'; reason: string };

const THERAPIST_WORK_MATERIAL =
  'рабочие материалы специалиста о клиенте — решение об их выдаче ' +
  'принимает владелец проекта по отдельному запросу';

export const CLIENT_EXPORT_POLICY: Record<string, ClientExportDecision> = {
  // Клиент видит свои карты целиком (ModeMapsService.getMyModeMap), поэтому
  // в файл они уходят расшифрованными — теми же полями, что и в приложении.
  ModeMap: {
    status: 'export',
    select: {
      id: true,
      therapistId: true,
      title: true,
      kind: true,
      nodes: true,
      edges: true,
      createdAt: true,
      updatedAt: true,
    },
    omit: { clientId: 'это сам человек — ключ выборки, не данные' },
    // Те же поля, что MODE_MAP_SCHEMA в src/therapy/mode-maps.service.ts.
    schema: { strings: ['title'], jsonArrays: ['nodes', 'edges'] },
  },
  // Что клиент видит в «Мой терапевт»: кто, статус, ближайшая встреча.
  TherapyRelation: {
    status: 'export',
    select: {
      id: true,
      therapistId: true,
      status: true,
      nextSession: true,
      createdAt: true,
    },
    omit: {
      code: 'одноразовый код приглашения — секрет входа в связь, как токены входа',
      clientId: 'это сам человек — ключ выборки, не данные',
      clientAlias:
        'как терапевт подписал клиента — его личная пометка, не данные клиента',
      virtualClientName:
        'имя офлайн-клиента, которое задаёт терапевт, — пометка терапевта',
      therapyStartDate: 'рабочий реквизит терапевта, клиенту не показывается',
      meetingDays: 'рабочее расписание терапевта, клиенту не показывается',
    },
  },
  TherapistNote: {
    status: 'withhold',
    reason: `заметки психолога о сессиях — ${THERAPIST_WORK_MATERIAL}`,
  },
  ClientConceptualization: {
    status: 'withhold',
    reason: `концептуализация случая — ${THERAPIST_WORK_MATERIAL}`,
  },
};

/**
 * Рантайм-сверка перед выдачей (правило №4): enc-поле, которое уходит в файл,
 * но не расшифровывается, превратилось бы в шифротекст в файле человека.
 * Как assertSyncedWithEncryptionPolicy: зовётся на каждую выгрузку, радиус
 * отказа — сама выгрузка.
 */
export function assertClientExportSynced(): void {
  const broken: string[] = [];
  for (const [model, d] of Object.entries(CLIENT_EXPORT_POLICY)) {
    if (d.status !== 'export') continue;
    const declared = new Set([
      ...(d.schema?.strings ?? []),
      ...(d.schema?.jsonArrays ?? []),
    ]);
    const encSelected = Object.entries(FIELD_POLICY[model] ?? {})
      .filter(([f, p]) => 'enc' in p && f in d.select)
      .map(([f]) => f);
    for (const f of encSelected)
      if (!declared.has(f)) broken.push(`${model}.${f}`);
    for (const f of declared)
      if (!(f in d.select))
        broken.push(`${model}.${f} (в schema, но не в select)`);
  }
  if (broken.length)
    throw new Error(
      'export-policy.client рассинхронизирован с FIELD_POLICY: ' +
        broken.join(', '),
    );
}
