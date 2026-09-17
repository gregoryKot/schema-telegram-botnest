// Тест гейта check-deploy-lag.mjs (правило №14 CLAUDE.md — «Отставший деплой
// виден без рук», инцидент 2026-09-16). Проверяет ОБА исхода: гейт краснеет
// на настоящем отставании и на битом вводе, и зеленеет на свежем деплое И на
// деплое, который ещё в процессе (иначе ложно-красный гейт красил бы смок
// прода на каждом свежем мерже и его отключили бы в первую же неделю).
import { runGate } from './gate-sandbox';

describe('check-deploy-lag.mjs', () => {
  it('свежий деплой: builtAt после commitAt — exit 0', () => {
    const res = runGate(
      'check-deploy-lag.mjs',
      {},
      {
        args: [
          '--built-at=2026-09-16T11:00:00Z',
          '--commit-at=2026-09-16T10:08:00Z',
          '--now=2026-09-16T11:05:00Z',
        ],
      },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('не старее');
  });

  it('сборка ещё идёт: builtAt до commitAt, коммит 10 минут назад — exit 0, в stdout про «идёт»', () => {
    const res = runGate(
      'check-deploy-lag.mjs',
      {},
      {
        args: [
          '--built-at=2026-09-16T09:50:00Z',
          '--commit-at=2026-09-16T10:00:00Z',
          '--now=2026-09-16T10:10:00Z',
        ],
      },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('идёт');
  });

  it('отстал: builtAt до commitAt, коммит 3 часа назад — exit 1, в stderr обе метки и Amvera', () => {
    const res = runGate(
      'check-deploy-lag.mjs',
      {},
      {
        args: [
          '--built-at=2026-09-16T07:00:00Z',
          '--commit-at=2026-09-16T10:00:00Z',
          '--now=2026-09-16T13:00:00Z',
        ],
      },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('2026-09-16T07:00:00.000Z');
    expect(res.stderr).toContain('2026-09-16T10:00:00.000Z');
    expect(res.stderr).toContain('Amvera');
  });

  // Регресс инцидента 2026-09-16: #494/#495 смержены в main, а образ на
  // проде всё ещё собран днём раньше — тот самый разрыв, который сутки
  // никто не заметил.
  it('регресс инцидента 2026-09-16 — exit 1', () => {
    const res = runGate(
      'check-deploy-lag.mjs',
      {},
      {
        args: [
          '--built-at=2026-09-15T16:51:45Z',
          '--commit-at=2026-09-16T10:08:00Z',
          '--now=2026-09-16T12:30:00Z',
        ],
      },
    );
    expect(res.status).toBe(1);
  });

  it('пустой --built-at — exit 1 с текстом про отсутствие метки сборки', () => {
    const res = runGate(
      'check-deploy-lag.mjs',
      {},
      {
        args: [
          '--built-at=',
          '--commit-at=2026-09-16T10:00:00Z',
          '--now=2026-09-16T10:10:00Z',
        ],
      },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не отдаёт время сборки');
  });

  it('мусор в --built-at — exit 1', () => {
    const res = runGate(
      'check-deploy-lag.mjs',
      {},
      {
        args: [
          '--built-at=не-дата',
          '--commit-at=2026-09-16T10:00:00Z',
          '--now=2026-09-16T10:10:00Z',
        ],
      },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не отдаёт время сборки');
  });

  it('мусор в --commit-at — exit 1', () => {
    const res = runGate(
      'check-deploy-lag.mjs',
      {},
      {
        args: [
          '--built-at=2026-09-16T09:00:00Z',
          '--commit-at=не-дата',
          '--now=2026-09-16T10:10:00Z',
        ],
      },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не удалось разобрать время');
  });

  it('--grace-min=5 при коммите 10 минут назад уважается — exit 1', () => {
    const res = runGate(
      'check-deploy-lag.mjs',
      {},
      {
        args: [
          '--built-at=2026-09-16T09:00:00Z',
          '--commit-at=2026-09-16T10:00:00Z',
          '--now=2026-09-16T10:10:00Z',
          '--grace-min=5',
        ],
      },
    );
    expect(res.status).toBe(1);
  });

  it('мусор в --grace-min — exit 1, а не молчаливый дефолт', () => {
    const res = runGate(
      'check-deploy-lag.mjs',
      {},
      {
        args: [
          '--built-at=2026-09-16T09:00:00Z',
          '--commit-at=2026-09-16T10:00:00Z',
          '--now=2026-09-16T10:10:00Z',
          '--grace-min=много',
        ],
      },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не удалось разобрать грейс');
  });

  it('тот же ввод с дефолтным грейсом (45 мин) — exit 0', () => {
    const res = runGate(
      'check-deploy-lag.mjs',
      {},
      {
        args: [
          '--built-at=2026-09-16T09:00:00Z',
          '--commit-at=2026-09-16T10:00:00Z',
          '--now=2026-09-16T10:10:00Z',
        ],
      },
    );
    expect(res.status).toBe(0);
  });
});
