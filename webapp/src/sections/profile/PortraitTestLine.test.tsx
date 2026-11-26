// @vitest-environment jsdom
// Строка теста в герое листа «Мой портрет» (переехала с карточки профиля, b21): дата и дельта — из данных.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { buildPortrait } from '../../../../shared/src/portrait/portraitData';
import { PortraitTestLine } from './PortraitTestLine';

afterEach(cleanup);

const at = '2026-08-01T10:00:00.000Z';
const portrait = buildPortrait({ manualSchemaIds: ['abandonment', 'mistrust'] });

describe('PortraitTestLine', () => {
  it('дата теста — из данных', () => {
    render(<PortraitTestLine portrait={portrait} ysqCompletedAt={at} />);
    expect(screen.getByText(/Тест на схемы · /)).toBeTruthy();
  });

  it('дельта: улучшение со знаком минус, рост с плюсом, ноль и null скрыты', () => {
    const r1 = render(<PortraitTestLine portrait={{ ...portrait, delta: -2 }} ysqCompletedAt={at} />);
    expect(screen.getByText('-2 с прошлого теста').className).toContain('is-better');
    r1.unmount();
    const r2 = render(<PortraitTestLine portrait={{ ...portrait, delta: 3 }} ysqCompletedAt={at} />);
    expect(screen.getByText('+3 с прошлого теста')).toBeTruthy();
    r2.unmount();
    render(<PortraitTestLine portrait={{ ...portrait, delta: 0 }} ysqCompletedAt={at} />);
    expect(screen.queryByText(/с прошлого теста/)).toBeNull();
  });

  it('без теста или без данных портрета — строки нет (без выдуманной даты)', () => {
    const { container, rerender } = render(<PortraitTestLine portrait={portrait} ysqCompletedAt={null} />);
    expect(container.innerHTML).toBe('');
    rerender(<PortraitTestLine portrait={buildPortrait({})} ysqCompletedAt={at} />);
    expect(container.innerHTML).toBe('');
  });
});
