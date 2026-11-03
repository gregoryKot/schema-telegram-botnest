// @vitest-environment jsdom
// ConceptYsqHistory — история теста на схемы (YSQ) клиента у терапевта (0%
// покрытия, 281 строка). Много арифметики без единого числового теста
// раньше: «выраженная» схема (флаг бэкенда, без него — общий критерий),
// склонение «прохождение/-я/-й», дельта среднего балла между последними двумя
// попытками (порог значимости ≥0.3, знак и цвет), таймлайн с пропуском нулевой дельты.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ConceptYsqHistory } from './ConceptYsqHistory';
import type { ClientDetail } from '../types';

afterEach(() => {
  cleanup();
});

// clientData целиком — большой тип с полями, не читаемыми этим компонентом
// (только ysqHistory); кастуем через unknown, как в остальных тестах пакета.
function withHistory(ysqHistory: unknown[]): ClientDetail {
  return {
    clientData: { ysqHistory },
  } as unknown as ClientDetail;
}

function noClientData(): ClientDetail {
  return { clientData: null } as unknown as ClientDetail;
}

describe('ConceptYsqHistory — гейт видимости', () => {
  it('нет clientData — ничего не рендерит', () => {
    const { container } = render(<ConceptYsqHistory detail={noClientData()} />);
    expect(container.textContent).toBe('');
  });

  it('ysqHistory пуст — ничего не рендерит', () => {
    const { container } = render(
      <ConceptYsqHistory detail={withHistory([])} />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('ConceptYsqHistory — склонение «прохождение»', () => {
  it('1 прохождение — «1 прохождение»', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          { id: 1, completedAt: '2026-08-01T00:00:00.000Z', scores: [] },
        ])}
      />,
    );
    expect(screen.getByText(/1 прохождение/)).toBeTruthy();
  });

  it('2 прохождения — «2 прохождения»', () => {
    const entry = { completedAt: '2026-08-01T00:00:00.000Z', scores: [] };
    render(
      <ConceptYsqHistory
        detail={withHistory([
          { ...entry, id: 1 },
          { ...entry, id: 2 },
        ])}
      />,
    );
    expect(screen.getByText(/2 прохождения/)).toBeTruthy();
  });

  it('5 прохождений — «5 прохождений»', () => {
    const entry = { completedAt: '2026-08-01T00:00:00.000Z', scores: [] };
    render(
      <ConceptYsqHistory
        detail={withHistory(
          Array.from({ length: 5 }, (_, i) => ({ ...entry, id: i })),
        )}
      />,
    );
    expect(screen.getByText(/5 прохождений/)).toBeTruthy();
  });
});

describe('ConceptYsqHistory — выраженные vs остальные (флаг бэкенда)', () => {
  // QA 2026-10-26: своё `pct5plus > 50` уводило в «Остальные» схему из
  // сплошных «4» (0% ответов 5–6, средний 4), которую клиент видит выраженной.
  it('выраженная по среднему баллу при 0% «5–6» — в «Выраженных», с баллом', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          {
            id: 1,
            completedAt: '2026-08-01T00:00:00.000Z',
            scores: [
              { id: 'self_sacrifice', pct5plus: 0, avg: 4, active: true },
              { id: 'abandonment', pct5plus: 50, avg: 3.6, active: false },
            ],
          },
        ])}
      />,
    );
    expect(screen.getByText('Выраженные (1)')).toBeTruthy();
    expect(screen.getByText('4/6 · 0%')).toBeTruthy();
    expect(screen.getByText('Остальные')).toBeTruthy();
  });

  it('ответ без флага (кэш прошлой версии) — тот же критерий', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          {
            id: 1,
            completedAt: '2026-08-01T00:00:00.000Z',
            scores: [{ id: 'emotional_deprivation', pct5plus: 51 }],
          },
        ])}
      />,
    );
    expect(screen.getByText('Выраженные (1)')).toBeTruthy();
  });

  it('выраженные — по убыванию среднего балла, как у клиента', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          {
            id: 1,
            completedAt: '2026-08-01T00:00:00.000Z',
            scores: [
              {
                id: 'emotional_deprivation',
                pct5plus: 90,
                avg: 4.2,
                active: true,
              },
              { id: 'abandonment', pct5plus: 60, avg: 5.1, active: true },
            ],
          },
        ])}
      />,
    );
    const text = document.body.textContent ?? '';
    expect(text.indexOf('5.1/6')).toBeLessThan(text.indexOf('4.2/6'));
  });
});

describe('ConceptYsqHistory — дельта между последними двумя прохождениями', () => {
  it('изменение среднего балла ≥0.3 — показывает знак и число', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          {
            id: 2,
            completedAt: '2026-08-01T00:00:00.000Z',
            scores: [
              {
                id: 'emotional_deprivation',
                pct5plus: 60,
                avg: 4.2,
                active: true,
              },
            ],
          },
          {
            id: 1,
            completedAt: '2026-07-01T00:00:00.000Z',
            scores: [
              {
                id: 'emotional_deprivation',
                pct5plus: 80,
                avg: 5,
                active: true,
              },
            ],
          },
        ])}
      />,
    );
    expect(screen.getByText('-0.8')).toBeTruthy();
  });

  it('изменение <0.3 — дельта не показывается (шум)', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          {
            id: 2,
            completedAt: '2026-08-01T00:00:00.000Z',
            scores: [
              {
                id: 'emotional_deprivation',
                pct5plus: 62,
                avg: 4.2,
                active: true,
              },
            ],
          },
          {
            id: 1,
            completedAt: '2026-07-01T00:00:00.000Z',
            scores: [
              {
                id: 'emotional_deprivation',
                pct5plus: 60,
                avg: 4.1,
                active: true,
              },
            ],
          },
        ])}
      />,
    );
    expect(screen.queryByText('+0.1')).toBeNull();
  });

  it('схемы не было в прошлом прохождении — дельта null, не падает', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          {
            id: 2,
            completedAt: '2026-08-01T00:00:00.000Z',
            scores: [
              {
                id: 'emotional_deprivation',
                pct5plus: 60,
                avg: 4.5,
                active: true,
              },
            ],
          },
          {
            id: 1,
            completedAt: '2026-07-01T00:00:00.000Z',
            scores: [],
          },
        ])}
      />,
    );
    expect(screen.getByText('4.5/6 · 60%')).toBeTruthy();
  });
});

describe('ConceptYsqHistory — таймлайн', () => {
  it('одно прохождение — таймлайна нет (нужно минимум 2)', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          { id: 1, completedAt: '2026-08-01T00:00:00.000Z', scores: [] },
        ])}
      />,
    );
    expect(screen.queryByText('История')).toBeNull();
  });

  it('два+ прохождения — таймлайн виден, последнее помечено «· сейчас»', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          {
            id: 2,
            completedAt: '2026-08-01T00:00:00.000Z',
            scores: [{ id: 'emotional_deprivation', pct5plus: 60 }],
          },
          {
            id: 1,
            completedAt: '2026-07-01T00:00:00.000Z',
            scores: [],
          },
        ])}
      />,
    );
    expect(screen.getByText('История')).toBeTruthy();
    expect(screen.getByText(/· сейчас/)).toBeTruthy();
  });
});
