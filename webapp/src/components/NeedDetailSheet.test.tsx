// @vitest-environment jsdom
// Лист потребности: связанные схемы — только домен этой потребности (схемы сверхбдительности висели
// и на «Выражении чувств», и на «Спонтанности»), советы — по зоне балла детства с порогами колеса.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NeedDetailSheet } from './NeedDetailSheet';
import { getNeedData } from '../../../shared/src/needs/needData';

afterEach(() => cleanup());

const ACTIVE = ['subjugation', 'negativity', 'emotional_inhibition'];

function renderSheet(needId: string, childhoodRating?: number) {
  return render(
    <MemoryRouter>
      <NeedDetailSheet needId={needId} childhoodRating={childhoodRating} activeSchemaIds={ACTIVE} onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('NeedDetailSheet — связанные схемы', () => {
  it('«Выражение чувств» — только схемы «Направленности на других»', () => {
    renderSheet('expression');
    expect(screen.getByText('Покорность')).toBeTruthy();
    expect(screen.queryByText('Негативизм / Пессимизм')).toBeNull();
    expect(screen.queryByText('Эмоциональная скованность')).toBeNull();
  });

  it('схемы сверхбдительности — у «Спонтанности»', () => {
    renderSheet('play');
    expect(screen.getByText('Негативизм / Пессимизм')).toBeTruthy();
    expect(screen.getByText('Эмоциональная скованность')).toBeTruthy();
    expect(screen.queryByText('Покорность')).toBeNull();
  });
});

describe('NeedDetailSheet — советы по зоне балла детства', () => {
  const need = getNeedData('ty').limits;

  it('4 — ещё дефицит, 7 — уже «хватало», 5 — середина', () => {
    renderSheet('limits', 4);
    expect(screen.getByText('Что поможет сейчас')).toBeTruthy();
    expect(screen.getByText(need.tips.low[0])).toBeTruthy();
    cleanup();
    renderSheet('limits', 7);
    expect(screen.getByText(need.tips.high[0])).toBeTruthy();
    cleanup();
    renderSheet('limits', 5);
    expect(screen.getByText(need.tips.medium[0])).toBeTruthy();
  });
});
