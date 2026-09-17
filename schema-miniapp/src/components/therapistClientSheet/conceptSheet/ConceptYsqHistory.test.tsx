// @vitest-environment jsdom
// ConceptYsqHistory — история теста на схемы (YSQ) клиента у терапевта (0%
// покрытия, 281 строка). Много арифметики без единого числового теста
// раньше: порог «выраженная» схема (>50%, ровно 50% — уже «остальные»),
// склонение «прохождение/-я/-й», дельта между последними двумя попытками
// (порог значимости ≥5%, знак и цвет), таймлайн с пропуском нулевой дельты.
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

describe('ConceptYsqHistory — выраженные vs остальные (порог 50%)', () => {
  it('pct5plus=51 — «Выраженные», ровно 50 — «Остальные»', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          {
            id: 1,
            completedAt: '2026-08-01T00:00:00.000Z',
            scores: [
              { id: 'emotional_deprivation', pct5plus: 51 },
              { id: 'abandonment', pct5plus: 50 },
            ],
          },
        ])}
      />,
    );
    expect(screen.getByText('Выраженные (1)')).toBeTruthy();
    expect(screen.getByText(/Эмоциональная депривация/)).toBeTruthy();
    expect(screen.getByText('Остальные')).toBeTruthy();
  });

  it('несколько выраженных схем — сортированы по убыванию pct5plus', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          {
            id: 1,
            completedAt: '2026-08-01T00:00:00.000Z',
            scores: [
              { id: 'emotional_deprivation', pct5plus: 60 },
              { id: 'abandonment', pct5plus: 90 },
            ],
          },
        ])}
      />,
    );
    const text = document.body.textContent ?? '';
    // Схема с 90% должна упоминаться раньше по тексту, чем схема с 60%.
    expect(text.indexOf('90%')).toBeLessThan(text.indexOf('60%'));
  });
});

describe('ConceptYsqHistory — дельта между последними двумя прохождениями', () => {
  it('изменение ≥5% — показывает знак и процент', () => {
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
            scores: [{ id: 'emotional_deprivation', pct5plus: 80 }],
          },
        ])}
      />,
    );
    // 60 - 80 = -20, показывается как «-20%»
    expect(screen.getByText('-20%')).toBeTruthy();
  });

  it('изменение <5% — дельта не показывается (шум)', () => {
    render(
      <ConceptYsqHistory
        detail={withHistory([
          {
            id: 2,
            completedAt: '2026-08-01T00:00:00.000Z',
            scores: [{ id: 'emotional_deprivation', pct5plus: 62 }],
          },
          {
            id: 1,
            completedAt: '2026-07-01T00:00:00.000Z',
            scores: [{ id: 'emotional_deprivation', pct5plus: 60 }],
          },
        ])}
      />,
    );
    expect(screen.queryByText('+2%')).toBeNull();
  });

  it('схемы не было в прошлом прохождении — дельта null, не падает', () => {
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
    expect(screen.getByText('60%')).toBeTruthy();
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
