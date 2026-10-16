import { ClientErrorLogGate } from './client-error-log-gate';

// Вердикт «что писать про отчёт фронтенда» — чистая логика с явным now.
// Сквозная проверка через контроллер — в client-errors.controller.spec.ts.
describe('ClientErrorLogGate', () => {
  const T0 = 1_800_000_000_000;

  it('первый отчёт ключа — подробный, без повторов', () => {
    const gate = new ClientErrorLogGate();
    expect(gate.take('webapp|diary|1.1.1.1', T0)).toEqual({
      kind: 'full',
      repeats: 0,
    });
  });

  it('повтор того же ключа в окне — repeat, а не ещё одна подробная строка', () => {
    const gate = new ClientErrorLogGate();
    gate.take('k', T0);
    expect(gate.take('k', T0 + 1_000)).toEqual({ kind: 'repeat' });
    expect(gate.take('k', T0 + 4 * 60_000)).toEqual({ kind: 'repeat' });
  });

  it('после окна ключ снова подробный и сообщает число проглоченных', () => {
    const gate = new ClientErrorLogGate();
    gate.take('k', T0);
    gate.take('k', T0 + 1);
    gate.take('k', T0 + 2);
    expect(gate.take('k', T0 + 5 * 60_000)).toEqual({
      kind: 'full',
      repeats: 2,
    });
  });

  it('сверх бюджета в минуту — unlogged, но число повторов не теряется', () => {
    const gate = new ClientErrorLogGate();
    gate.take('k', T0);
    gate.take('k', T0 + 1);
    for (let i = 0; i < 19; i += 1) gate.take(`other${i}`, T0 + 2);
    // Бюджет 20 исчерпан (k + 19 других); k после окна — повтор с хвостом 1.
    expect(gate.take('k', T0 + 5 * 60_000 - 1)).toEqual({ kind: 'repeat' });
    expect(gate.take('late', T0 + 3)).toEqual({ kind: 'unlogged', repeats: 0 });
    expect(gate.take('k', T0 + 5 * 60_000)).toEqual({
      kind: 'full',
      repeats: 2,
    });
  });

  it('unlogged несёт repeats прошлого окна', () => {
    const gate = new ClientErrorLogGate();
    gate.take('k', T0);
    gate.take('k', T0 + 1);
    const later = T0 + 5 * 60_000;
    for (let i = 0; i < 20; i += 1) gate.take(`other${i}`, later);
    expect(gate.take('k', later)).toEqual({ kind: 'unlogged', repeats: 1 });
  });
});
