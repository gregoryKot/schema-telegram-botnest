// DTO-рефактор inline-типов @Body() для карт режимов и кастомных режимов
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomModeDto } from './custom-mode.dto';
import { CreateModeMapDto, UpdateModeMapDto } from './mode-maps.dto';
import { stringsWithin } from './strings-within';
import { MODE_MAP_NODE_TEXT_MAX } from '../../utils/text-limits';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('CustomModeDto / CreateModeMapDto — слабые поля-строки', () => {
  it('пустое тело проходит', async () => {
    await expect(errorsFor(CustomModeDto, {})).resolves.toEqual([]);
    await expect(errorsFor(CreateModeMapDto, {})).resolves.toEqual([]);
  });

  it('неизвестный nodeType/kind не отклоняется (сервис фолбэкает на дефолт)', async () => {
    await expect(
      errorsFor(CustomModeDto, { name: 'Мой режим', nodeType: 'unknown' }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(CreateModeMapDto, { kind: 'unknown' }),
    ).resolves.toEqual([]);
  });

  it('новые типы карт concept и free проходят (#963)', async () => {
    for (const kind of ['concept', 'free']) {
      await expect(errorsFor(CreateModeMapDto, { kind })).resolves.toEqual([]);
    }
  });
});

describe('UpdateModeMapDto', () => {
  it('nodes больше 200 — отказ', async () => {
    const nodes = Array.from({ length: 201 }, (_, i) => ({ id: i }));
    await expect(errorsFor(UpdateModeMapDto, { nodes })).resolves.toContain(
      'nodes',
    );
  });

  it('edges больше 500 — отказ', async () => {
    const edges = Array.from({ length: 501 }, (_, i) => ({ id: i }));
    await expect(errorsFor(UpdateModeMapDto, { edges })).resolves.toContain(
      'edges',
    );
  });
});

// Карта шлётся целиком на каждое автосохранение: заметка без границы упирала
// тело в лимит 256 КБ (docs/open/backend.md, аудит 2026-07-20, L2).
describe('UpdateModeMapDto — строки внутри узлов и связей ограничены', () => {
  const node = (data: Record<string, unknown>) => ({
    id: 'n1',
    type: 'child',
    position: { x: 0, y: 0 },
    data: { label: 'Уязвимый Ребёнок', ...data },
  });
  const atLimit = 'я'.repeat(MODE_MAP_NODE_TEXT_MAX);
  const overLimit = `${atLimit}я`;

  it('заметка и ответ Здорового Взрослого ровно на пределе — проходят', async () => {
    const nodes = [node({ note: atLimit, healthyResponse: atLimit })];
    await expect(errorsFor(UpdateModeMapDto, { nodes })).resolves.toEqual([]);
  });

  it('заметка узла длиннее предела — отказ по nodes', async () => {
    const nodes = [node({ note: overLimit })];
    await expect(errorsFor(UpdateModeMapDto, { nodes })).resolves.toEqual([
      'nodes',
    ]);
  });

  it('подпись связи длиннее предела — отказ по edges', async () => {
    const edges = [{ id: 'e1', source: 'a', target: 'b', label: overLimit }];
    await expect(errorsFor(UpdateModeMapDto, { edges })).resolves.toEqual([
      'edges',
    ]);
  });

  it('неизвестное поле узла не срезается и тоже ограничено', async () => {
    const nodes = [node({ futureField: { deep: [overLimit] } })];
    await expect(errorsFor(UpdateModeMapDto, { nodes })).resolves.toEqual([
      'nodes',
    ]);
    const ok = [node({ futureField: { deep: ['short'] }, settle: true })];
    const dto = plainToInstance(UpdateModeMapDto, { nodes: ok });
    await expect(validate(dto, { whitelist: true })).resolves.toEqual([]);
    expect(dto.nodes).toEqual(ok);
  });
});

describe('stringsWithin', () => {
  it('ключ объекта длиннее предела — false', () => {
    expect(stringsWithin({ [`k${'x'.repeat(10)}`]: 1 }, 10)).toBe(false);
    expect(stringsWithin({ k: 'x'.repeat(10) }, 10)).toBe(true);
  });

  it('числа, null, булевы значения и пустые массивы не мешают', () => {
    expect(stringsWithin([1, null, true, [], {}, undefined], 1)).toBe(true);
  });

  it('глубокая вложенность не роняет стек', () => {
    let deep: unknown = 'x'.repeat(11);
    for (let i = 0; i < 100_000; i++) deep = [deep];
    expect(stringsWithin(deep, 10)).toBe(false);
  });
});
