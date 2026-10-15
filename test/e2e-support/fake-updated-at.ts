import { makeTable } from './fake-prisma-engine';

/**
 * Имитация `@updatedAt`: create/update/updateMany ставят updatedAt (явная
 * `data.updatedAt` сильнее). Код брони читает возраст строки (минимальный
 * возраст повтора в confirm(), крон-добор — security#21); без этого поле в
 * фейке было бы `undefined`, а Postgres его всегда заполняет.
 */
export function withUpdatedAt(table: ReturnType<typeof makeTable>) {
  const { create, update, updateMany } = table;
  const stamp = (data: any) => ({ updatedAt: new Date(), ...data });
  table.create = jest.fn(({ data }: any) => create({ data: stamp(data) }));
  table.update = jest.fn((args: any) =>
    update({ ...args, data: stamp(args.data) }),
  );
  table.updateMany = jest.fn((args: any) =>
    updateMany({ ...args, data: stamp(args.data) }),
  );
  return table;
}
