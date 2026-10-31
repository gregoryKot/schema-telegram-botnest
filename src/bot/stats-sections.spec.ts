// Сверка (правило №4): разделы /stats ↔ реальные блоки отчёта. Новый блок
// без раздела (или раздел с несуществующим блоком) красит этот тест.
import { StatsReportService } from './stats-report.service';
import { statsBlocks, type StatsBlockDeps } from './stats-report.blocks';
import { infraBlocks } from './stats-infra-blocks';
import {
  findStatsSection,
  POOL_BLOCK_NAME,
  STATS_ALL_ID,
  STATS_MAIN_ID,
  STATS_SECTIONS,
  statsKeyboard,
} from './stats-sections';

const stubDeps = new Proxy(
  {},
  { get: () => ({ render: () => '' }) },
) as StatsBlockDeps;

const serviceNames = statsBlocks(stubDeps).map((b) => b.name);
const allNames = [
  ...serviceNames,
  ...infraBlocks().map((b) => b.name),
  POOL_BLOCK_NAME,
];

describe('STATS_SECTIONS ↔ блоки отчёта', () => {
  it('blockNames() сервиса совпадает со списком statsBlocks', () => {
    const stubs = Array.from({ length: StatsReportService.length }, () => ({}));
    const service = Reflect.construct(StatsReportService, stubs);
    expect(service.blockNames()).toEqual(serviceNames);
  });

  it('каждый блок отчёта (продуктовый, инфра, запас фраз) — ровно в одном разделе', () => {
    const inSections = STATS_SECTIONS.flatMap((s) => s.blocks);
    for (const name of allNames) {
      expect({
        name,
        раз: inSections.filter((n) => n === name).length,
      }).toEqual({ name, раз: 1 });
    }
  });

  it('инфра-блоки и запас фраз лежат именно в «system»: их рисует только его ветка', () => {
    const system = findStatsSection('system')?.blocks ?? [];
    for (const b of infraBlocks()) expect(system).toContain(b.name);
    expect(system).toContain(POOL_BLOCK_NAME);
  });

  it('в разделах нет имён, которых нет в отчёте', () => {
    const known = new Set(allNames);
    const unknown = STATS_SECTIONS.flatMap((s) => s.blocks).filter(
      (n) => !known.has(n),
    );
    expect(unknown).toEqual([]);
  });

  it('имена блоков в отчёте уникальны', () => {
    expect(new Set(allNames).size).toBe(allNames.length);
  });

  it('id уникальны, латиница, не заняты служебными main/all', () => {
    const ids = STATS_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
    expect(ids).not.toContain(STATS_MAIN_ID);
    expect(ids).not.toContain(STATS_ALL_ID);
  });

  it('у каждого раздела есть заголовок и блоки', () => {
    for (const s of STATS_SECTIONS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.blocks.length).toBeGreaterThan(0);
    }
  });

  it('findStatsSection: известный id находит, чужой — нет', () => {
    expect(findStatsSection('money')?.title).toContain('Деньги');
    expect(findStatsSection('nope')).toBeUndefined();
  });
});

describe('StatsReportService.renderSection', () => {
  type Mock = { render: jest.Mock };
  const build = () => {
    const mocks: Mock[] = Array.from(
      { length: StatsReportService.length },
      () => ({ render: jest.fn() }),
    );
    const service: StatsReportService = Reflect.construct(
      StatsReportService,
      mocks,
    );
    const blocks = statsBlocks(service);
    for (const b of blocks) {
      b.svc.render.mockResolvedValue(`тело ${b.name}`);
    }
    return { service, blocks };
  };

  it.each(STATS_SECTIONS.map((s) => [s.id, s] as const))(
    'раздел %s: рендерятся ровно сервисы его блоков, заголовок первой строкой, порядок как в отчёте',
    async (_id, section) => {
      const { service, blocks } = build();
      const out = await service.renderSection(section.id);

      const mine = blocks.filter((b) => section.blocks.includes(b.name));
      for (const b of blocks) {
        expect(b.svc.render).toHaveBeenCalledTimes(mine.includes(b) ? 1 : 0);
      }
      expect(out.split('\n')[0]).toBe(`<b>${section.title}</b>`);
      expect(out).toBe(
        [`<b>${section.title}</b>`, ...mine.map((b) => `тело ${b.name}`)].join(
          '\n\n',
        ),
      );
    },
  );

  it('неизвестный раздел: ошибка, ни один сервис не вызван', async () => {
    const { service, blocks } = build();
    await expect(service.renderSection('nope')).rejects.toThrow(
      'Нет раздела /stats «nope»',
    );
    for (const b of blocks) {
      expect(b.svc.render).toHaveBeenCalledTimes(0);
    }
  });
});

describe('statsKeyboard', () => {
  const data = (k: ReturnType<typeof statsKeyboard>) =>
    k.inline_keyboard.map((row) => row.map((b) => b.callback_data));

  it('главный экран: разделы по две в ряд и «Всё целиком»', () => {
    const rows = data(statsKeyboard());
    expect(rows).toEqual([
      ['stats:product', 'stats:people'],
      ['stats:money', 'stats:entry'],
      ['stats:data', 'stats:system'],
      ['stats:all'],
    ]);
  });

  it('экран раздела: «← Главное» и остальные разделы без текущего', () => {
    const k = statsKeyboard('money');
    const rows = data(k);
    expect(rows[0]).toEqual(['stats:main']);
    expect(k.inline_keyboard[0][0].text).toBe('← Главное');
    const flat = rows.flat();
    expect(flat).not.toContain('stats:money');
    expect(flat).not.toContain('stats:all');
    expect(flat).toHaveLength(1 + STATS_SECTIONS.length - 1);
  });

  it('current=main — как главный экран', () => {
    expect(statsKeyboard('main')).toEqual(statsKeyboard());
  });

  it('callback_data укладывается в 64 байта и проходит regex хендлера', () => {
    for (const row of statsKeyboard().inline_keyboard) {
      for (const b of row) {
        expect(Buffer.byteLength(b.callback_data)).toBeLessThanOrEqual(64);
        expect(b.callback_data).toMatch(/^stats:([a-z]+)$/);
      }
    }
  });
});
