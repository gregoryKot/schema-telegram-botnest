import { makeTable } from './fake-prisma-engine';

// Строго растущий момент: updatedAt концептуализации — версия строки для
// 409 (src/therapy/concept-save.ts), две записи в одну мс её бы не сдвинули.
let last = 0;
const tick = () => new Date((last = Math.max(Date.now(), last + 1)));

/**
 * Имитация `@updatedAt`: create/update/updateMany/upsert ставят updatedAt (явная
 * `data.updatedAt` сильнее). Код брони читает возраст строки (минимальный
 * возраст повтора в confirm(), крон-добор — security#21); без этого поле в
 * фейке было бы `undefined`, а Postgres его всегда заполняет.
 */
export function withUpdatedAt(table: ReturnType<typeof makeTable>) {
  const { create, update, updateMany, upsert } = table;
  const stamp = (data: any) => ({ updatedAt: tick(), ...data });
  table.upsert = jest.fn((args: any) =>
    upsert({ ...args, create: stamp(args.create), update: stamp(args.update) }),
  );
  table.create = jest.fn(({ data }: any) => create({ data: stamp(data) }));
  table.update = jest.fn((args: any) =>
    update({ ...args, data: stamp(args.data) }),
  );
  table.updateMany = jest.fn((args: any) =>
    updateMany({ ...args, data: stamp(args.data) }),
  );
  return table;
}

/**
 * Имитация `createdAt @default(now())`: create ставит момент вставки (явная
 * `data.createdAt` сильнее). Отчёт /stats считает события в окне по
 * createdAt (therapist-exit-metrics.service.ts) — без этого в фейке окно
 * было бы пустым всегда, а «сохранил → нашёл» проверял бы ничто.
 */
export function withCreatedAt(table: ReturnType<typeof makeTable>) {
  const { create } = table;
  table.create = jest.fn(({ data }: any) =>
    create({ data: { createdAt: new Date(), ...data } }),
  );
  return table;
}
