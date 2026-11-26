import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createFakeTable } from '../test-support/fake-prisma.spec-helper';
import {
  copingAddress,
  fragmentKeyOf,
  GuideMarksService,
} from './guide-marks.service';
import { encryptConceptFields } from './concept-store';

const T1 = 11n;
const T2 = 12n;
const C1 = 21n;
const ADDRESS = 'mode:vulnerable_child/experiential';

function make() {
  const guideMark = createFakeTable([], {
    defaults: () => ({
      fragmentKey: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });
  const prisma = { guideMark } as never;
  const assertHasClient = jest.fn(async (t: bigint) => {
    if (t !== T1) throw new Error('No active relation');
  });
  const track = jest.fn(async () => undefined);
  const service = new GuideMarksService(
    prisma,
    { assertHasClient } as never,
    { track } as never,
  );
  return { service, guideMark, track };
}

describe('GuideMarksService', () => {
  // Шифрование в базе с настоящим ключом — encrypted-write-response.spec.ts и e2e.
  it('сохранил → нашёл: список клиента и «уже отмечено» по адресу', async () => {
    const { service } = make();
    const { mark, created } = await service.save(T1, C1, {
      address: ADDRESS,
      snapshot: 'текст раздела',
      note: '  как это у неё ',
    });
    expect(created).toBe(true);
    expect(mark).toMatchObject({ address: ADDRESS, note: 'как это у неё' });
    expect(await service.list(T1, C1)).toEqual([mark]);
    expect(await service.clientsWithAddress(T1, ADDRESS)).toEqual([String(C1)]);
  });

  it('повтор того же адреса — правка, не дубль; событие только при создании', async () => {
    const { service, guideMark, track } = make();
    await service.save(T1, C1, { address: ADDRESS, snapshot: 'v1' });
    const again = await service.save(T1, C1, {
      address: ADDRESS,
      snapshot: 'v2',
      note: 'уточнение',
    });
    expect(again.created).toBe(false);
    expect(guideMark._rows).toHaveLength(1);
    expect(again.mark).toMatchObject({ snapshot: 'v2', note: 'уточнение' });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(T1, 'guide_mark_added', {
      kind: 'mode',
    });
  });

  it('фрагменты лежат рядом с разделом; тот же текст — правка, другой — новая запись', async () => {
    const { service, guideMark, track } = make();
    await service.save(T1, C1, { address: ADDRESS, snapshot: 'раздел' });
    const a = await service.save(T1, C1, {
      address: ADDRESS,
      snapshot: 'кусок один',
      fragment: true,
    });
    const again = await service.save(T1, C1, {
      address: ADDRESS,
      snapshot: ' кусок   один ',
      fragment: true,
      note: 'правка',
    });
    await service.save(T1, C1, {
      address: ADDRESS,
      snapshot: 'кусок два',
      fragment: true,
    });
    expect(again.created).toBe(false);
    expect(again.mark.id).toBe(a.mark.id);
    expect(guideMark._rows).toHaveLength(3);
    const list = await service.list(T1, C1);
    expect(list.map((m) => m.fragment)).toEqual([false, true, true]);
    expect(track).toHaveBeenLastCalledWith(T1, 'guide_mark_added', {
      kind: 'mode',
      fragment: true,
    });
    // «уже отмечено» — только раздел целиком
    await service
      .save(T1, 22n, {
        address: ADDRESS,
        snapshot: 'x',
        fragment: true,
      })
      .catch(() => undefined);
    expect(await service.clientsWithAddress(T1, ADDRESS)).toEqual([String(C1)]);
  });

  it('слишком длинный фрагмент — 400', async () => {
    const { service } = make();
    await expect(
      service.save(T1, C1, {
        address: ADDRESS,
        snapshot: 'я'.repeat(3001),
        fragment: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ключ фрагмента не зависит от пробелов', () => {
    expect(fragmentKeyOf('а  б\n')).toBe(fragmentKeyOf(' а б'));
    expect(fragmentKeyOf('а')).not.toBe('');
  });

  it.each([
    ['копинг схемы идёт в schemaLinks', 'schema:subjugation/coping.surrender'],
    ['чужой вид', 'tab:safety/text'],
    ['не адрес', 'mode:/x'],
  ])('%s — 400, ничего не записано', async (_n, address) => {
    const { service, guideMark } = make();
    await expect(
      service.save(T1, C1, { address, snapshot: 's' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(guideMark._rows).toHaveLength(0);
  });

  it('прочие разделы схемы — в GuideMark', async () => {
    const { service } = make();
    const r = await service.save(T1, C1, {
      address: 'schema:subjugation/belief',
      snapshot: 's',
    });
    expect(r.created).toBe(true);
  });

  it('чужой терапевт: список — отказ связи, снятие по id — 404', async () => {
    const { service, guideMark } = make();
    const { mark } = await service.save(T1, C1, {
      address: ADDRESS,
      snapshot: 's',
    });
    await expect(service.list(T2, C1)).rejects.toThrow('No active relation');
    await expect(service.remove(T2, mark.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(guideMark._rows).toHaveLength(1);
    await service.remove(T1, mark.id);
    expect(guideMark._rows).toHaveLength(0);
  });

  it('событие копинга (PR 3) — тот же метод с kind coping', async () => {
    const { service, track } = make();
    await service.trackAdded(T1, 'coping');
    expect(track).toHaveBeenCalledWith(T1, 'guide_mark_added', {
      kind: 'coping',
    });
  });
});

// Копинг схемы живёт в schemaLinks (#1484): «уже отмечено» ищется по схеме случая, не по GuideMark.
describe('GuideMarksService.clientsWithAddress — копинг схемы', () => {
  it('находит клиентов, у которых стиль отмечен на этой схеме', async () => {
    const row = (clientId: bigint, coping: string[]) => ({
      clientId,
      ...encryptConceptFields({
        schemaLinks: [{ schemaId: 'subjugation', coping }],
      }),
    });
    const findMany = jest.fn(async () => [
      row(C1, ['surrender']),
      row(22n, ['avoidance']),
    ]);
    const service = new GuideMarksService(
      { clientConceptualization: { findMany } } as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.clientsWithAddress(T1, 'schema:subjugation/coping.surrender'),
    ).resolves.toEqual([String(C1)]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { therapistId: T1 } }),
    );
    expect(copingAddress('schema:subjugation/coping.denial')).toBeNull();
    expect(copingAddress('mode:x/coping.surrender')).toBeNull();
  });
});
