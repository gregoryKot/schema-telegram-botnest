// DTO календаря слотов в админке (контракт «Календарь слотов», правило №6
// CLAUDE.md). Стиль — как booking-admin.dto.spec.ts/site-content-admin.dto.spec.ts.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminCalendarQueryDto,
  SlotOverrideItemDto,
  SlotOverridesDto,
} from './booking-calendar-admin.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('AdminCalendarQueryDto', () => {
  it('валидные from/to (YYYY-MM-DD) проходят', async () => {
    await expect(
      errorsFor(AdminCalendarQueryDto, {
        from: '2026-07-13',
        to: '2026-07-20',
      }),
    ).resolves.toEqual([]);
  });

  it('from с временем/лишними символами — отказ', async () => {
    await expect(
      errorsFor(AdminCalendarQueryDto, {
        from: '2026-07-13T00:00:00Z',
        to: '2026-07-20',
      }),
    ).resolves.toContain('from');
  });

  it('to пустой строкой — отказ', async () => {
    await expect(
      errorsFor(AdminCalendarQueryDto, { from: '2026-07-13', to: '' }),
    ).resolves.toContain('to');
  });
});

describe('SlotOverrideItemDto', () => {
  const VALID = {
    startsAt: '2026-07-13T09:00:00.000Z',
    durationMin: 50,
    kind: 'BLOCK',
  };

  it('валидный BLOCK-item проходит', async () => {
    await expect(errorsFor(SlotOverrideItemDto, VALID)).resolves.toEqual([]);
  });

  it('валидный OPEN-item проходит', async () => {
    await expect(
      errorsFor(SlotOverrideItemDto, { ...VALID, kind: 'OPEN' }),
    ).resolves.toEqual([]);
  });

  it('kind вне BLOCK/OPEN — отказ', async () => {
    await expect(
      errorsFor(SlotOverrideItemDto, { ...VALID, kind: 'FOO' }),
    ).resolves.toContain('kind');
  });

  it('startsAt не ISO8601 — отказ', async () => {
    await expect(
      errorsFor(SlotOverrideItemDto, { ...VALID, startsAt: 'завтра в 9' }),
    ).resolves.toContain('startsAt');
  });

  it('durationMin меньше 15 — отказ', async () => {
    await expect(
      errorsFor(SlotOverrideItemDto, { ...VALID, durationMin: 14 }),
    ).resolves.toContain('durationMin');
  });

  it('durationMin больше 180 — отказ', async () => {
    await expect(
      errorsFor(SlotOverrideItemDto, { ...VALID, durationMin: 181 }),
    ).resolves.toContain('durationMin');
  });

  it('durationMin ровно на границах 15/180 — проходит', async () => {
    await expect(
      errorsFor(SlotOverrideItemDto, { ...VALID, durationMin: 15 }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(SlotOverrideItemDto, { ...VALID, durationMin: 180 }),
    ).resolves.toEqual([]);
  });
});

describe('SlotOverridesDto', () => {
  it('валидные set и clear проходят', async () => {
    await expect(
      errorsFor(SlotOverridesDto, {
        set: [
          {
            startsAt: '2026-07-13T09:00:00.000Z',
            durationMin: 50,
            kind: 'BLOCK',
          },
        ],
        clear: ['2026-07-13T10:00:00.000Z'],
      }),
    ).resolves.toEqual([]);
  });

  it('пустое тело (ни set, ни clear) проходит DTO-валидацию — оба опциональны (400 решает контроллер)', async () => {
    await expect(errorsFor(SlotOverridesDto, {})).resolves.toEqual([]);
  });

  it('вложенный item с kind="FOO" — отказ по set (ValidateNested)', async () => {
    await expect(
      errorsFor(SlotOverridesDto, {
        set: [
          {
            startsAt: '2026-07-13T09:00:00.000Z',
            durationMin: 50,
            kind: 'FOO',
          },
        ],
      }),
    ).resolves.toContain('set');
  });

  it('clear с невалидной датой — отказ', async () => {
    await expect(
      errorsFor(SlotOverridesDto, { clear: ['не дата'] }),
    ).resolves.toContain('clear');
  });

  it('set длиннее 200 элементов — отказ', async () => {
    const set = Array.from({ length: 201 }, (_, i) => ({
      startsAt: `2026-07-${String((i % 27) + 1).padStart(2, '0')}T09:00:00.000Z`,
      durationMin: 50,
      kind: 'BLOCK' as const,
    }));
    await expect(errorsFor(SlotOverridesDto, { set })).resolves.toContain(
      'set',
    );
  });

  it('clear длиннее 200 элементов — отказ', async () => {
    const clear = Array.from(
      { length: 201 },
      (_, i) =>
        `2026-07-${String((i % 27) + 1).padStart(2, '0')}T09:00:00.000Z`,
    );
    await expect(errorsFor(SlotOverridesDto, { clear })).resolves.toContain(
      'clear',
    );
  });
});
