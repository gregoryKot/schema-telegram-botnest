// @vitest-environment jsdom
// Ветвления опций шаринга записи режима (парный тест мини-аппа —
// ModeEntryShare.test.tsx там же). getContext замокан по образцу
// practiceCard.test.ts — canvas 2d-контекст в jsdom не реализован.
// MemoryRouter — ShareCardSheet (webapp) держит useHistorySheet.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModeEntryShare } from './ModeEntryShare';
import type { ModeEntryMode } from '../../../../shared/src/share/cards/modeEntryCard';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

function mockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((s: string) => ({ width: s.length * 7 })),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
  };
}

vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
  mockCtx() as unknown as RenderingContext,
);

afterEach(cleanup);

const MODE: ModeEntryMode = {
  name: 'Уязвимый ребёнок',
  emoji: '🥹',
  groupName: 'Ребёнок',
  groupColor: '#5aa8f7',
};

function renderShare(props: Partial<Parameters<typeof ModeEntryShare>[0]>) {
  return render(
    <MemoryRouter>
      <ModeEntryShare mode={MODE} {...props} />
    </MemoryRouter>,
  );
}

describe('ModeEntryShare', () => {
  it('нет ни healthyResponse, ни заполненного entry → ничего не рендерит', () => {
    const { container } = renderShare({ entry: { situation: '' } });
    expect(container.textContent).toBe('');
  });

  it('без mode → ничего не рендерит, даже если данные есть', () => {
    const { container } = render(
      <MemoryRouter>
        <ModeEntryShare healthyResponse="я имею право на отдых" />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe('');
  });

  it('только healthyResponse → кнопка краткой карточки, без «всей записи»', () => {
    renderShare({ healthyResponse: 'я имею право на отдых' });
    expect(screen.getByText('Сохранить карточку')).toBeTruthy();
    expect(screen.queryByText('Поделиться всей записью')).toBeNull();
  });

  it('healthyResponse + заполненный entry → обе опции', () => {
    renderShare({
      healthyResponse: 'я имею право на отдых',
      entry: { situation: 'Позвонил папа', healthyResponse: 'я имею право на отдых' },
    });
    expect(screen.getByText('Сохранить карточку')).toBeTruthy();
    expect(screen.getByText('Поделиться всей записью')).toBeTruthy();
  });

  it('entry без healthyResponse → только опция полной записи', () => {
    renderShare({ entry: { situation: 'Позвонил папа' } });
    expect(screen.queryByText('Сохранить карточку')).toBeNull();
    expect(screen.getByText('Поделиться всей записью')).toBeTruthy();
  });

  it('клик по «Поделиться всей записью» открывает шит полной карточки', () => {
    renderShare({ entry: { situation: 'Позвонил папа' } });
    fireEvent.click(screen.getByText('Поделиться всей записью'));
    expect(screen.getByText('Поделиться записью')).toBeTruthy();
  });
});
